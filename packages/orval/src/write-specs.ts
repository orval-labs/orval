import {
  createSuccessMessage,
  fixCrossDirectoryImports,
  fixRegularSchemaImports,
  getFileInfo,
  getMockFileExtensionByTypeName,
  isString,
  jsDoc,
  log,
  type NormalizedOptions,
  type OpenApiInfoObject,
  OutputMode,
  splitSchemasByType,
  upath,
  writeSchemas,
  writeSingleMode,
  type WriteSpecBuilder,
  writeSplitMode,
  writeSplitTagsMode,
  writeTagsMode,
} from '@orval/core';
import chalk from 'chalk';
import { execa, ExecaError } from 'execa';
import fs from 'fs-extra';
import { unique } from 'remeda';
import type { TypeDocOptions } from 'typedoc';

import { executeHook } from './utils';
import { writeZodSchemas, writeZodSchemasFromVerbs } from './write-zod-specs';

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
        );
        fixRegularSchemaImports(
          regularSchemas,
          operationSchemaNames,
          schemaPath,
          output.operationSchemas,
          output.namingConvention,
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
          });

          // Add re-export from operations in the main schemas index
          if (output.indexFiles) {
            const relativePath = upath.relativeSafe(
              schemaPath,
              output.operationSchemas,
            );
            const schemaIndexPath = upath.join(
              schemaPath,
              `/index${fileExtension}`,
            );
            await fs.appendFile(
              schemaIndexPath,
              `export * from '${relativePath}';\n`,
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
          );
          fixRegularSchemaImports(
            regularSchemas,
            operationSchemaNames,
            output.schemas.path,
            output.operationSchemas,
            output.namingConvention,
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
            });

            // Add re-export from operations in the main schemas index
            if (output.indexFiles) {
              const relativePath = upath.relativeSafe(
                output.schemas.path,
                output.operationSchemas,
              );
              const schemaIndexPath = upath.join(
                output.schemas.path,
                `/index${fileExtension}`,
              );
              await fs.appendFile(
                schemaIndexPath,
                `export * from '${relativePath}';\n`,
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
          });
        }
      } else if (schemaType === 'zod') {
        const fileExtension = '.zod.ts';

        await writeZodSchemas(
          builder,
          output.schemas.path,
          fileExtension,
          header,
          output,
        );

        if (builder.verbOptions) {
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
  }

  let implementationPaths: string[] = [];

  if (output.target) {
    const writeMode = getWriteMode(output.mode);
    implementationPaths = await writeMode({
      builder,
      workspace,
      output,
      projectName,
      header,
      needSchema: !output.schemas && output.client !== 'zod',
    });
  }

  if (output.workspace) {
    const workspacePath = output.workspace;
    const imports = implementationPaths
      .filter(
        (path) =>
          !output.mock ||
          !path.endsWith(`.${getMockFileExtensionByTypeName(output.mock)}.ts`),
      )
      .map((path) =>
        upath.relativeSafe(
          workspacePath,
          getFileInfo(path).pathWithoutExtension,
        ),
      );

    if (output.schemas) {
      const schemasPath =
        typeof output.schemas === 'string'
          ? output.schemas
          : output.schemas.path;
      imports.push(
        upath.relativeSafe(workspacePath, getFileInfo(schemasPath).dirname),
      );
    }

    if (output.operationSchemas) {
      imports.push(
        upath.relativeSafe(
          workspacePath,
          getFileInfo(output.operationSchemas).dirname,
        ),
      );
    }

    if (output.indexFiles) {
      const indexFile = upath.join(workspacePath, '/index.ts');

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
            typeof output.schemas === 'string'
              ? output.schemas
              : output.schemas.path,
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

  if (output.prettier) {
    try {
      await execa('prettier', ['--write', ...paths]);
    } catch {
      log(
        chalk.yellow(
          `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}Globally installed prettier not found`,
        ),
      );
    }
  }

  if (output.biome) {
    try {
      await execa('biome', ['check', '--write', ...paths]);
    } catch (error) {
      let message = `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}biome not found`;
      if (error instanceof ExecaError && error.exitCode === 1)
        message = error.message;

      log(chalk.yellow(message));
    }
  }

  if (output.docs) {
    try {
      let config: Partial<TypeDocOptions> = {};
      let configPath: string | null = null;
      if (typeof output.docs === 'object') {
        ({ configPath = null, ...config } = output.docs);
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
        entryPoints: paths,
        theme: 'markdown',
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
        await app.generateDocs(project, app.options.getValue('out') as string);
      } else {
        throw new Error('TypeDoc not initialized');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `⚠️  ${projectTitle ? `${projectTitle} - ` : ''}Unable to generate docs`;

      log(chalk.yellow(message));
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
    case OutputMode.SINGLE:
    default: {
      return writeSingleMode;
    }
  }
}
