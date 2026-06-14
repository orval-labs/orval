import path from 'node:path';

import {
  buildSchemaTagMap,
  type ContextSpec,
  createSuccessMessage,
  type FakerMockOptions,
  fixCrossDirectoryImports,
  fixRegularSchemaImports,
  generateDependencyImports,
  generateMutator,
  getFileInfo,
  getImportExtension,
  getMockFileExtensionByTypeName,
  isFunction,
  isObject,
  isString,
  jsDoc,
  logWarning,
  type NormalizedOptions,
  type OpenApiInfoObject,
  OutputMockType,
  OutputMode,
  splitSchemasByType,
  SupportedFormatter,
  upath,
  writeGeneratedFile,
  writeSchemas,
  writeSchemasTagsSplit,
  writeSingleMode,
  type WriteSpecBuilder,
  writeSplitMode,
  writeSplitTagsMode,
  writeTagsMode,
} from '@orval/core';
import { generateFakerForSchemas } from '@orval/mock';
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
  writeZodSchemaTagsSplitBarrel,
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

/**
 * Emit `<schemas-dir>/index.faker.ts` (or `<output-root>/schemas.faker.ts`
 * when `output.schemas` is not configured) when a faker generator entry has
 * `schemas: true`. Each `components/schemas` entry becomes a
 * `get<SchemaName>Mock(overrides)` factory in the file. Returns the written
 * file path so callers can include it in formatter / hook runs, or
 * `undefined` if no file was written.
 */
async function writeFakerSchemaMocks(
  builder: WriteSpecBuilder,
  options: NormalizedOptions,
  header: string,
): Promise<string | undefined> {
  const { output } = options;
  // Pick the opted-in faker entry directly. The duplicate-type guard in
  // `normalizeMocksOption` keeps this unambiguous today, and finding by
  // `schemas: true` also makes the intent obvious if that guard ever
  // loosens (so a `faker({ schemas: false })` entry can't accidentally
  // win the lookup).
  const fakerEntry = output.mock.generators.find(
    (g): g is FakerMockOptions =>
      !isFunction(g) && g.type === OutputMockType.FAKER && g.schemas === true,
  );
  if (!fakerEntry) {
    return undefined;
  }

  const schemasWithDef = builder.schemas.filter((s) => !!s.schema);
  if (schemasWithDef.length === 0) {
    return undefined;
  }

  const context: ContextSpec = {
    spec: builder.spec,
    target: builder.target,
    workspace: '',
    output,
  };

  const { implementation, imports, strictMockSchemaTypeNames } =
    generateFakerForSchemas(schemasWithDef, context, fakerEntry);

  if (!implementation.trim()) {
    return undefined;
  }

  const finalizedImplementation = builder.finalizeMockImplementation
    ? builder.finalizeMockImplementation(implementation, {
        mockOptions: output.override.mock,
        strictSchemaTypeNames: strictMockSchemaTypeNames,
      })
    : implementation;

  let filePath: string;
  let schemaImportPath: string | undefined;
  const fileExtension = output.fileExtension || '.ts';

  if (output.schemas) {
    const schemasDir = isString(output.schemas)
      ? output.schemas
      : output.schemas.path;
    filePath = path.join(schemasDir, `index.faker${fileExtension}`);
    schemaImportPath = '.';
  } else {
    const targetInfo = output.target
      ? getFileInfo(output.target, { extension: fileExtension })
      : undefined;
    const dir = targetInfo?.dirname ?? process.cwd();
    filePath = path.join(dir, `schemas.faker${fileExtension}`);
    // Without a dedicated schemas dir we have no separate types file to
    // import from; the factories will reference inline types declared in
    // the main output target. Append `getImportExtension` so NodeNext /
    // Node16 module resolution gets the required local-file extension.
    schemaImportPath = targetInfo
      ? `./${targetInfo.filename}${getImportExtension(
          fileExtension,
          output.tsconfig,
        )}`
      : undefined;
  }

  // Route every schema-related import (both type-only and runtime value
  // forms) onto the consolidated schemas path. Both `import { Foo }` and
  // `import type { Foo }` come from the same module here, so we treat
  // them uniformly — `generateDependencyImports` splits values vs types
  // back out into separate `import` / `import type` lines as needed.
  const reroutedImports = imports.map((imp) =>
    imp.importPath ? imp : { ...imp, importPath: schemaImportPath },
  );

  // `generateDependencyImports` expects a list of `{ exports, dependency }`
  // groups (one per source module). Bucket all rerouted imports by their
  // resolved `importPath` so each module emits a single `import type { ... }`
  // line.
  const grouped = new Map<string, typeof reroutedImports>();
  for (const imp of reroutedImports) {
    const key = imp.importPath ?? '';
    if (!key) continue;
    const bucket = grouped.get(key) ?? [];
    bucket.push(imp);
    grouped.set(key, bucket);
  }

  const importsHeader = generateDependencyImports(
    finalizedImplementation,
    [
      {
        exports: [{ name: 'faker', values: true }],
        dependency: fakerEntry.locale
          ? `@faker-js/faker/locale/${fakerEntry.locale}`
          : '@faker-js/faker',
      },
      ...[...grouped.entries()].map(([dependency, exports]) => ({
        exports,
        dependency,
      })),
    ],
    undefined,
    !!output.schemas,
    false,
  );

  const content = `${header}${importsHeader}\n\n${finalizedImplementation}`;
  await writeGeneratedFile(filePath, content);
  return filePath;
}

function isSchemaValidatorClient(
  client: NormalizedOptions['output']['client'],
): boolean {
  return client === 'zod' || client === 'effect';
}

function shouldGenerateZodSchemasInline(
  output: NormalizedOptions['output'],
  hasOperations: boolean,
): boolean {
  if (output.client !== 'zod' || output.schemas) {
    return false;
  }
  // With `generateReusableSchemas`, operations reference component schemas by
  // name, so the component definitions must be emitted inline alongside the
  // operations (otherwise the references are dangling). Without the flag,
  // operations inline their own schemas, so we only emit the component
  // schemas inline when there are no operations.
  // `NormalizedOutputOptions` types this as a required `boolean`, so use it
  // directly (a `=== true` compare trips no-unnecessary-boolean-literal-compare).
  if (output.override.zod.generateReusableSchemas) {
    return true;
  }
  return !hasOperations;
}

function shouldGenerateSchemas(
  output: NormalizedOptions['output'],
  hasOperations: boolean,
): boolean {
  return (
    (!output.schemas && !isSchemaValidatorClient(output.client)) ||
    shouldGenerateZodSchemasInline(output, hasOperations)
  );
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
    const schemasPath = isString(output.schemas)
      ? output.schemas
      : output.schemas.path;

    const shouldSplitSchemasByTags =
      isObject(output.schemas) && output.schemas.splitByTags;

    const isZodSchemas =
      (!isString(output.schemas) && output.schemas.type === 'zod') ||
      // Auto-promote a string `schemas:` to the zod writer when client is zod
      // and the reusable flag is on. We deliberately don't promote when the
      // user explicitly set `{ type: 'typescript' }` — that signals intent
      // to keep TS types, even alongside a zod client.
      (isString(output.schemas) &&
        output.client === 'zod' &&
        output.override.zod.generateReusableSchemas);

    if (shouldSplitSchemasByTags && output.operationSchemas) {
      throw new Error(
        'schemas.splitByTags cannot be used with output.operationSchemas. ' +
          'The tags-split schema mode handles operation type placement within tag directories.',
      );
    }

    if (isZodSchemas) {
      // Use the schema-specific extension so the global `fileExtension` (which
      // also drives client/mock outputs) isn't dragged into the zod world.
      const fileExtension = output.schemaFileExtension;

      // Reusable component schemas live as separate files under `schemasPath`,
      // so we resolve the user's `override.zod.params` mutator once relative
      // to that directory and pass it down. Each emitted schema file lives in
      // the same dir, so the relative import is identical across files.
      const schemasParamsMutator = output.override.zod.params
        ? await generateMutator({
            output: path.join(schemasPath, `__params__${fileExtension}`),
            mutator: output.override.zod.params,
            name: 'zodParams',
            workspace,
            tsconfig: output.tsconfig,
          })
        : undefined;

      if (shouldSplitSchemasByTags) {
        const operations = Object.values(builder.operations).map((op) => ({
          imports: op.imports,
          tags: op.tags,
        }));
        const schemaTagMap = buildSchemaTagMap(operations, schemas);

        const componentDirs = await writeZodSchemas(
          builder,
          schemasPath,
          fileExtension,
          header,
          output,
          schemasParamsMutator,
          schemaTagMap,
        );

        const verbDirs = await writeZodSchemasFromVerbs(
          builder.verbOptions,
          schemasPath,
          fileExtension,
          header,
          output,
          {
            spec: builder.spec,
            target: builder.target,
            workspace,
            output,
          },
          schemaTagMap,
        );

        if (output.indexFiles) {
          await writeZodSchemaTagsSplitBarrel(
            schemasPath,
            fileExtension,
            header,
            componentDirs,
            verbDirs,
            output.namingConvention,
            output.tsconfig,
          );
        }
      } else {
        await writeZodSchemas(
          builder,
          schemasPath,
          fileExtension,
          header,
          output,
          schemasParamsMutator,
        );

        await writeZodSchemasFromVerbs(
          builder.verbOptions,
          schemasPath,
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
    } else {
      const fileExtension = output.fileExtension || '.ts';

      // Split schemas by tag into subdirectories
      if (shouldSplitSchemasByTags) {
        const operations = Object.values(builder.operations).map((op) => ({
          imports: op.imports,
          tags: op.tags,
        }));

        await writeSchemasTagsSplit({
          schemaPath: schemasPath,
          schemas,
          target,
          namingConvention: output.namingConvention,
          fileExtension,
          header,
          indexFiles: output.indexFiles,
          tsconfig: output.tsconfig,
          factoryOutputDirectory: output.factoryMethods?.outputDirectory,
          operations,
        });
      } else if (output.operationSchemas) {
        const { regularSchemas, operationSchemas: opSchemas } =
          splitSchemasByType(schemas);

        // Fix cross-directory imports before writing (both directions)
        const regularSchemaNames = new Set(regularSchemas.map((s) => s.name));
        const operationSchemaNames = new Set(opSchemas.map((s) => s.name));
        fixCrossDirectoryImports(
          opSchemas,
          regularSchemaNames,
          schemasPath,
          output.operationSchemas,
          output.namingConvention,
          fileExtension,
          output.tsconfig,
        );
        fixRegularSchemaImports(
          regularSchemas,
          operationSchemaNames,
          schemasPath,
          output.operationSchemas,
          output.namingConvention,
          fileExtension,
          output.tsconfig,
        );

        // Write regular schemas to schemas path
        if (regularSchemas.length > 0) {
          await writeSchemas({
            schemaPath: schemasPath,
            schemas: regularSchemas,
            target,
            namingConvention: output.namingConvention,
            fileExtension,
            header,
            indexFiles: output.indexFiles,
            tsconfig: output.tsconfig,
            factoryOutputDirectory: output.factoryMethods?.outputDirectory,
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
            factoryOutputDirectory: output.factoryMethods?.outputDirectory,
          });

          // Add re-export from operations in the main schemas index
          if (output.indexFiles) {
            await addOperationSchemasReExport(
              schemasPath,
              output.operationSchemas,
              header,
            );
          }
        }
      } else {
        await writeSchemas({
          schemaPath: schemasPath,
          schemas,
          target,
          namingConvention: output.namingConvention,
          fileExtension,
          header,
          indexFiles: output.indexFiles,
          tsconfig: output.tsconfig,
          factoryOutputDirectory: output.factoryMethods?.outputDirectory,
        });
      }
    }
  }

  // Emit a consolidated faker mock file for `components/schemas` when the
  // faker generator opts in with `schemas: true`. Lives alongside the
  // generated TS schema types so factories can import them directly.
  const fakerSchemaPath = await writeFakerSchemaMocks(builder, options, header);

  let implementationPaths: string[] = [];

  if (output.target) {
    const writeMode = getWriteMode(output.mode);
    const hasOperations = Object.keys(builder.operations).length > 0;
    const needZodSchemasInline = shouldGenerateZodSchemasInline(
      output,
      hasOperations,
    );
    // The zod client's `import * as zod from 'zod'` is a *usage-gated* dependency
    // import: it's only emitted when an operation's generated schema actually
    // references the `zod` token. When every operation is a pure-`$ref` alias
    // (e.g. `export const FooResponse = Bar`), the client emits no zod import —
    // so the inline schema block (which always uses zod) must supply it itself.
    // When an operation does use zod the client already imports it, and a second
    // import would redeclare the `zod` binding — so the inline block omits it.
    const operationsUseZod = Object.values(builder.operations).some(
      (operation) => /\bzod\b/.test(operation.implementation),
    );
    const includeZodImport = !operationsUseZod;

    // Inline component schemas (when `generateReusableSchemas` is on without a
    // dedicated `output.schemas` dir) need their own `paramsMutator` resolved
    // relative to `output.target`. Per-operation mutators in `generateZodRoute`
    // don't cover the shared `export const Pet = …` definitions emitted here,
    // so without this the inlined components would silently skip injection.
    const inlineSchemasParamsMutator =
      needZodSchemasInline && output.override.zod.params
        ? await generateMutator({
            output: output.target,
            mutator: output.override.zod.params,
            name: 'zodParams',
            workspace,
            tsconfig: output.tsconfig,
          })
        : undefined;
    // Every non-`single` mode (`split` / `tags` / `tags-split`) writes inline
    // schemas to a separate `.schemas` file alongside the operation file(s),
    // so they need their own params-mutator import. Only in `single` mode do
    // the schemas concatenate into the operation file and inherit its import
    // (emitted via each verb's `mutators` array in `generateZodRoute`) — re-
    // emitting from inline would produce a duplicate `import` line there.
    // With no operations at all, even in `single` mode the file builder has
    // no operation mutators to lean on, so we still emit.
    const isSchemasInSeparateFile = output.mode !== OutputMode.SINGLE;
    const includeParamsImport = !hasOperations || isSchemasInSeparateFile;

    implementationPaths = await writeMode({
      builder,
      workspace,
      output,
      projectName,
      header,
      needSchema: shouldGenerateSchemas(output, hasOperations),
      generateSchemasInline: needZodSchemasInline
        ? () =>
            generateZodSchemasInline(
              builder,
              output,
              includeZodImport,
              inlineSchemasParamsMutator,
              includeParamsImport,
            )
        : undefined,
    });
  }

  if (output.workspace) {
    const workspacePath = output.workspace;
    const indexFile = path.join(workspacePath, 'index.ts');
    // Skip per-mock-entry output files when emitting the workspace index.
    // The cleanup pass removes any path matching `.<ext>.ts` for every
    // configured generator's extension (`msw`, `faker`, etc.).
    const mockExtensions = output.mock.generators.map((g) =>
      getMockFileExtensionByTypeName(g),
    );
    const imports = implementationPaths
      .filter(
        (p) =>
          mockExtensions.length === 0 ||
          !mockExtensions.some((ext) => p.endsWith(`.${ext}.ts`)),
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
    ...(fakerSchemaPath ? [fakerSchemaPath] : []),
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
