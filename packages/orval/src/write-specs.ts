import path from 'node:path';

import {
  createSuccessMessage,
  fixCrossDirectoryImports,
  fixRegularSchemaImports,
  getFileInfo,
  getMockFileExtensionByTypeName,
  isObject,
  isString,
  jsDoc,
  logWarning,
  type NormalizedOptions,
  type OpenApiInfoObject,
  OutputMode,
  splitSchemasByType,
  SupportedFormatter,
  upath,
  writeSchemas,
  writeSingleMode,
  type WriteSpecBuilder,
  writeSplitMode,
  writeSplitTagsMode,
  writeTagsMode,
} from '@orval/core';
import { execa, ExecaError } from 'execa';
import fs from 'fs-extra';
import { unique } from 'remeda';
import type { TypeDocOptions } from 'typedoc';

import { formatWithPrettier } from './formatters/prettier';
import { executeHook } from './utils';
import {
  generateZodSchemasInline,
  writeZodSchemas,
  writeZodSchemasFromVerbs,
} from './write-zod-specs';

async function runExternalFormatter(
  bin: string,
  args: string[],
  projectTitle?: string,
): Promise<void> {
  try {
    await execa(bin, args);
  } catch (error) {
    let message: string;
    if (error instanceof ExecaError) {
      message =
        error.code === 'ENOENT'
          ? `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}${bin} not found`
          : error.message;
    } else if (error instanceof Error) {
      message = error.message;
    } else {
      message = `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}${bin} failed`;
    }
    logWarning(message);
  }
}

export async function runFormatter(
  formatter: SupportedFormatter | undefined,
  paths: string[],
  projectTitle?: string,
): Promise<void> {
  switch (formatter) {
    case SupportedFormatter.PRETTIER: {
      await formatWithPrettier(paths, projectTitle);
      break;
    }
    case SupportedFormatter.BIOME: {
      await runExternalFormatter(
        SupportedFormatter.BIOME,
        ['check', '--write', ...paths],
        projectTitle,
      );
      break;
    }
    case SupportedFormatter.OXFMT: {
      await runExternalFormatter(SupportedFormatter.OXFMT, paths, projectTitle);
      break;
    }
  }
}

function getHeader(
  option: false | ((info: OpenApiInfoObject) => string | string[]),
  info: OpenApiInfoObject,
): string {
  if (!option) {
    return '';
  }

  const header = option(info);
  return Array.isArray(header) ? jsDoc({ description: header }) : header;
}

/**
 * Add re-export of operation schemas from the main schemas index file.
 * Handles the case where the index file doesn't exist (no regular schemas).
 */
async function addOperationSchemasReExport(
  schemaPath: string,
  operationSchemasPath: string,
  header: string,
): Promise<void> {
  const schemaIndexPath = path.join(schemaPath, `index.ts`);
  const esmImportPath = upath.getRelativeImportPath(
    schemaIndexPath,
    operationSchemasPath,
  );
  const exportLine = `export * from '${esmImportPath}';\n`;

  const indexExists = await fs.pathExists(schemaIndexPath);
  if (indexExists) {
    // Check if export already exists to prevent duplicates on re-runs
    // Use regex to handle both single and double quotes
    const existingContent = await fs.readFile(schemaIndexPath, 'utf8');
    const exportPattern = new RegExp(
      String.raw`export\s*\*\s*from\s*['"]${esmImportPath.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}['"]`,
    );
    if (!exportPattern.test(existingContent)) {
      await fs.appendFile(schemaIndexPath, exportLine);
    }
  } else {
    // Create index with header if file doesn't exist (no regular schemas case)
    const content =
      header && header.trim().length > 0
        ? `${header}\n${exportLine}`
        : exportLine;
    await fs.outputFile(schemaIndexPath, content);
  }
}

export async function writeSpecs(
  builder: WriteSpecBuilder,
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
) {
  const { info, schemas, target } = builder;
  const { output } = options;
  const projectTitle = projectName ?? info.title;

  const header = getHeader(output.override.header, info);

  if (output.schemas) {
    if (isString(output.schemas)) {
      const fileExtension = output.fileExtension || '.ts';
      const schemaPath = output.schemas;

      // Split schemas if operationSchemas path is configured
      if (output.operationSchemas) {
        const { regularSchemas, operationSchemas: opSchemas } =
          splitSchemasByType(schemas);

        // Fix cross-directory imports before writing (both directions)
        const regularSchemaNames = new Set(regularSchemas.map((s) => s.name));
        const operationSchemaNames = new Set(opSchemas.map((s) => s.name));
        fixCrossDirectoryImports(
          opSchemas,
          regularSchemaNames,
          schemaPath,
          output.operationSchemas,
          output.namingConvention,
          fileExtension,
          output.tsconfig,
        );
        fixRegularSchemaImports(
          regularSchemas,
          operationSchemaNames,
          schemaPath,
          output.operationSchemas,
          output.namingConvention,
          fileExtension,
          output.tsconfig,
        );

        // Write regular schemas to schemas path
        if (regularSchemas.length > 0) {
          await writeSchemas({
            schemaPath,
            schemas: regularSchemas,
            target,
            namingConvention: output.namingConvention,
            fileExtension,
            header,
            indexFiles: output.indexFiles,
            tsconfig: output.tsconfig,
            factoryOutputDirectory: output.factoryMethods.outputDirectory,
          });
        }

        // Write operation schemas to operationSchemas path
        if (opSchemas.length > 0) {
          await writeSchemas({
            schemaPath: output.operationSchemas,
            schemas: opSchemas,
            target,
            namingConvention: output.namingConvention,
            fileExtension,
            header,
            indexFiles: output.indexFiles,
            tsconfig: output.tsconfig,
            factoryOutputDirectory: output.factoryMethods.outputDirectory,
          });

          // Add re-export from operations in the main schemas index
          if (output.indexFiles) {
            await addOperationSchemasReExport(
              schemaPath,
              output.operationSchemas,
              header,
            );
          }
        }
      } else {
        await writeSchemas({
          schemaPath,
          schemas,
          target,
          namingConvention: output.namingConvention,
          fileExtension,
          header,
          indexFiles: output.indexFiles,
          tsconfig: output.tsconfig,
          factoryOutputDirectory: output.factoryMethods.outputDirectory,
        });
      }
    } else {
      const schemaType = output.schemas.type;

      if (schemaType === 'typescript') {
        const fileExtension = output.fileExtension || '.ts';

        // Split schemas if operationSchemas path is configured
        if (output.operationSchemas) {
          const { regularSchemas, operationSchemas: opSchemas } =
            splitSchemasByType(schemas);

          // Fix cross-directory imports before writing (both directions)
          const regularSchemaNames = new Set(regularSchemas.map((s) => s.name));
          const operationSchemaNames = new Set(opSchemas.map((s) => s.name));
          fixCrossDirectoryImports(
            opSchemas,
            regularSchemaNames,
            output.schemas.path,
            output.operationSchemas,
            output.namingConvention,
            fileExtension,
            output.tsconfig,
          );
          fixRegularSchemaImports(
            regularSchemas,
            operationSchemaNames,
            output.schemas.path,
            output.operationSchemas,
            output.namingConvention,
            fileExtension,
            output.tsconfig,
          );

          if (regularSchemas.length > 0) {
            await writeSchemas({
              schemaPath: output.schemas.path,
              schemas: regularSchemas,
              target,
              namingConvention: output.namingConvention,
              fileExtension,
              header,
              indexFiles: output.indexFiles,
              tsconfig: output.tsconfig,
              factoryOutputDirectory: output.factoryMethods.outputDirectory,
            });
          }

          if (opSchemas.length > 0) {
            await writeSchemas({
              schemaPath: output.operationSchemas,
              schemas: opSchemas,
              target,
              namingConvention: output.namingConvention,
              fileExtension,
              header,
              indexFiles: output.indexFiles,
              tsconfig: output.tsconfig,
              factoryOutputDirectory: output.factoryMethods.outputDirectory,
            });

            // Add re-export from operations in the main schemas index
            if (output.indexFiles) {
              await addOperationSchemasReExport(
                output.schemas.path,
                output.operationSchemas,
                header,
              );
            }
          }
        } else {
          await writeSchemas({
            schemaPath: output.schemas.path,
            schemas,
            target,
            namingConvention: output.namingConvention,
            fileExtension,
            header,
            indexFiles: output.indexFiles,
            tsconfig: output.tsconfig,
            factoryOutputDirectory: output.factoryMethods.outputDirectory,
          });
        }
      } else {
        // schemaType === 'zod'
        const fileExtension = '.zod.ts';

        await writeZodSchemas(
          builder,
          output.schemas.path,
          fileExtension,
          header,
          output,
        );

        await writeZodSchemasFromVerbs(
          builder.verbOptions,
          output.schemas.path,
          fileExtension,
          header,
          output,
          {
            spec: builder.spec,
            target: builder.target,
            workspace,
            output,
          },
        );
      }
    }
  }

  let implementationPaths: string[] = [];

  if (output.target) {
    const writeMode = getWriteMode(output.mode);
    const isZodClient = output.client === 'zod';
    const hasOperations = Object.keys(builder.operations).length > 0;
    const needZodSchemasInline =
      isZodClient && !output.schemas && !hasOperations;

    implementationPaths = await writeMode({
      builder,
      workspace,
      output,
      projectName,
      header,
      needSchema: (!output.schemas && !isZodClient) || needZodSchemasInline,
      generateSchemasInline: needZodSchemasInline
        ? () => generateZodSchemasInline(builder, output)
        : undefined,
    });
  }

  if (output.workspace) {
    const workspacePath = output.workspace;
    const indexFile = path.join(workspacePath, 'index.ts');
    const imports = implementationPaths
      .filter(
        (p) =>
          !output.mock ||
          !p.endsWith(`.${getMockFileExtensionByTypeName(output.mock)}.ts`),
      )
      .map((p) =>
        upath.getRelativeImportPath(
          indexFile,
          getFileInfo(p).pathWithoutExtension,
          true,
        ),
      );

    if (output.schemas) {
      const schemasPath = isString(output.schemas)
        ? output.schemas
        : output.schemas.path;
      imports.push(
        upath.getRelativeImportPath(
          indexFile,
          getFileInfo(schemasPath).dirname,
        ),
      );
    }

    if (output.operationSchemas) {
      imports.push(
        upath.getRelativeImportPath(
          indexFile,
          getFileInfo(output.operationSchemas).dirname,
        ),
      );
    }

    if (output.indexFiles) {
      if (await fs.pathExists(indexFile)) {
        const data = await fs.readFile(indexFile, 'utf8');
        const importsNotDeclared = imports.filter((imp) => !data.includes(imp));
        await fs.appendFile(
          indexFile,
          unique(importsNotDeclared)
            .map((imp) => `export * from '${imp}';\n`)
            .join(''),
        );
      } else {
        await fs.outputFile(
          indexFile,
          unique(imports)
            .map((imp) => `export * from '${imp}';`)
            .join('\n') + '\n',
        );
      }

      implementationPaths = [indexFile, ...implementationPaths];
    }
  }

  if (builder.extraFiles.length > 0) {
    await Promise.all(
      builder.extraFiles.map(async (file) =>
        fs.outputFile(file.path, file.content),
      ),
    );

    implementationPaths = [
      ...implementationPaths,
      ...builder.extraFiles.map((file) => file.path),
    ];
  }

  const paths = [
    ...(output.schemas
      ? [
          getFileInfo(
            isString(output.schemas) ? output.schemas : output.schemas.path,
          ).dirname,
        ]
      : []),
    ...(output.operationSchemas
      ? [getFileInfo(output.operationSchemas).dirname]
      : []),
    ...implementationPaths,
  ];

  if (options.hooks.afterAllFilesWrite) {
    await executeHook(
      'afterAllFilesWrite',
      options.hooks.afterAllFilesWrite,
      paths,
    );
  }

  await runFormatter(output.formatter, paths, projectTitle);

  if (output.docs) {
    try {
      let config: Partial<TypeDocOptions> = {};
      let configPath: string | undefined;
      if (isObject(output.docs)) {
        ({ configPath, ...config } = output.docs);
        if (configPath) {
          config.options = configPath;
        }
      }

      const getTypedocApplication = async () => {
        const { Application } = await import('typedoc');
        return Application;
      };

      const Application = await getTypedocApplication();
      const app = await Application.bootstrapWithPlugins({
        entryPoints: paths.map((x) => upath.toUnix(x)),
        theme: 'markdown',
        // Skip TypeScript diagnostics on the consuming project: TypeDoc would
        // otherwise pick up the user's tsconfig and surface errors from files
        // unrelated to the generated entry points (e.g. a demo `App.tsx`
        // with an unused `React` default import under the new JSX transform —
        // see #3338). User-overridable via the `docs` option below.
        skipErrorChecking: true,
        // Set the custom config location if it has been provided.
        ...config,
        plugin: ['typedoc-plugin-markdown', ...(config.plugin ?? [])],
      });
      // Set defaults if the have not been provided by the external config.
      if (!app.options.isSet('readme')) {
        app.options.setValue('readme', 'none');
      }
      if (!app.options.isSet('logLevel')) {
        app.options.setValue('logLevel', 'None');
      }
      const project = await app.convert();
      if (project) {
        const outputPath = app.options.getValue('out');
        await app.generateDocs(project, outputPath);

        await runFormatter(output.formatter, [outputPath], projectTitle);
      } else {
        throw new Error('TypeDoc not initialized');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}Unable to generate docs`;

      logWarning(message);
    }
  }

  createSuccessMessage(projectTitle);
}

function getWriteMode(mode: OutputMode) {
  switch (mode) {
    case OutputMode.SPLIT: {
      return writeSplitMode;
    }
    case OutputMode.TAGS: {
      return writeTagsMode;
    }
    case OutputMode.TAGS_SPLIT: {
      return writeSplitTagsMode;
    }
    default: {
      return writeSingleMode;
    }
  }
}
