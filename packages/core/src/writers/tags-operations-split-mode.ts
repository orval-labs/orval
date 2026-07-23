import path from 'node:path';

import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputMockType, type WriteModeProps } from '../types';
import {
  conventionName,
  getFileInfo,
  getImportExtension,
  getSchemasImportPath,
  isFunction,
  isString,
  isSyntheticDefaultImportsAllow,
  kebab,
  pascal,
  upath,
} from '../utils';
import { getMockFileExtensionByTypeName } from '../utils/file-extensions';
import { assertClientSupportsTagsOperations } from './tags-operations-mode';
import { writeGeneratedFile } from './file';
import {
  filterLocalStrictMockTypeImports,
  getFinalizeMockImplementationOptions,
} from './finalize-mock-implementation';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import {
  collectRecoveredSchemaFactoryImports,
  mergeGeneratorImports,
} from './mock-imports';
import { getMockDir, resolveMockSchemasPath } from './mock-utils';
import {
  buildTagHelpersImport,
  generateTargetForTagsOperations,
  resolveTransitiveSchemas,
} from './target-tags-operations';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

/**
 * `tags-operations-split` mode: two files per operation, nested under a
 * per-tag directory (`<dir>/<tag>/<operation><ext>` for the runtime
 * implementation, `<dir>/<tag>/<operation>.schemas<ext>` for the component
 * schemas that operation's implementation references), plus a per-tag
 * barrel (`<dir>/<tag>/index<ext>`) re-exporting both files for every
 * operation so existing `import from '<build>/<tag>'`-style imports keep
 * working.
 */
export async function writeTagsOperationsSplitMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
  generateSchemasInline,
  schemaTagMap,
}: WriteModeProps): Promise<string[]> {
  assertClientSupportsTagsOperations(output.client, 'tags-operations-split');

  const { filename, dirname, extension } = getFileInfo(output.target, {
    backupFilename: conventionName(
      builder.info.title ?? 'filename',
      output.namingConvention,
    ),
    extension: output.fileExtension,
  });

  const target = generateTargetForTagsOperations(builder, output);

  const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
    output.tsconfig,
  );

  // Operation files live one directory deeper than `dirname` (under their
  // tag subdirectory), so relative import paths need an extra `../` step —
  // matching how `split-tags-mode.ts` resolves paths for its per-tag
  // subdirectories.
  const schemaCustomImportPath = getSchemasImportPath(output.schemas);
  const schemasPathRelative = output.schemas
    ? (schemaCustomImportPath ??
      upath.getRelativeImportPath(
        path.join(dirname, 'tag', filename + extension),
        getFileInfo(
          isString(output.schemas) ? output.schemas : output.schemas.path,
          { extension: output.fileExtension },
        ).dirname,
        true,
      ))
    : '../' +
      filename +
      '.schemas' +
      getImportExtension(extension, output.tsconfig);

  const schemasTarget = output.schemas
    ? getFileInfo(
        isString(output.schemas) ? output.schemas : output.schemas.path,
        { extension: output.fileExtension },
      ).dirname
    : path.join(
        dirname,
        filename + '.schemas' + getImportExtension(extension, output.tsconfig),
      );

  const globalSchemasPath =
    !output.schemas && needSchema
      ? path.join(dirname, filename + '.schemas' + extension)
      : undefined;

  if (globalSchemasPath) {
    const schemasData = generateSchemasInline
      ? header + generateSchemasInline()
      : header + generateModelsInline(builder.schemas);

    await writeGeneratedFile(globalSchemasPath, schemasData);
  }

  const tagEntries = Object.entries(target).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );

  interface MockIndexEntry {
    ext: OutputMockType;
    mockDir: string;
    operations: string[];
  }

  const generatedFilePathsArray = await Promise.all(
    tagEntries.map(async ([tag, { helpers, operations }]) => {
      try {
        const tagDir = path.join(dirname, tag);
        const helperFilename = `${tag}.helpers${extension}`;
        const helperPath = path.join(tagDir, helperFilename);
        const hasHelpers = helpers.implementation.trim().length > 0;
        const helperImportExtension = getImportExtension(
          extension,
          output.tsconfig,
        );
        const helperImportPath =
          './' + tag + '.helpers' + helperImportExtension;

        if (hasHelpers) {
          await writeGeneratedFile(helperPath, header + helpers.implementation);
        }

        const mockIndexEntries: MockIndexEntry[] = [];

        const operationFilePaths = await Promise.all(
          operations.map(async (operation) => {
            const operationFilename = kebab(operation.operationName);
            const implementationPath = path.join(
              tagDir,
              `${operationFilename}${extension}`,
            );
            const operationSchemasFilename = `${operationFilename}.schemas${extension}`;
            const operationSchemasPath = path.join(
              tagDir,
              operationSchemasFilename,
            );
            const operationSchemasImportPath =
              './' + operationFilename + '.schemas' + helperImportExtension;

            const implementationImports = operation.imports.filter((imp) => {
              const searchWords = [imp.alias, imp.name]
                .filter((part): part is string => Boolean(part?.length))
                .join('|');
              if (!searchWords) return false;
              return new RegExp(String.raw`\b(${searchWords})\b`, 'g').test(
                operation.implementation,
              );
            });

            // Component schemas this operation's implementation actually
            // references, scoped down from the full builder schema list —
            // including transitive dependencies (e.g. a `Pet` schema
            // composed from `Dog` / `Cat`) — so each operation's `.schemas`
            // file is self-contained.
            const directSchemaNames = implementationImports
              .filter((imp) => !imp.importPath)
              .map((imp) => imp.name);
            const operationSchemas = resolveTransitiveSchemas(
              directSchemaNames,
              builder.schemas,
            );
            const referencedSchemaNames = new Set(
              operationSchemas.map((s) => s.name),
            );
            const hasOperationSchemas = operationSchemas.length > 0;

            if (hasOperationSchemas) {
              const schemasData =
                header + generateModelsInline(operationSchemas);
              await writeGeneratedFile(operationSchemasPath, schemasData);
            }

            // Local component-schema imports are routed to the operation's
            // own `.schemas` file; every other import (schemas dir, cross-tag
            // helper types, etc.) keeps its existing resolution.
            const adjustedImports = implementationImports.map((imp) => {
              if (imp.importPath) return imp;
              if (!referencedSchemaNames.has(imp.name)) return imp;
              return { ...imp, importPath: operationSchemasImportPath };
            });

            const importsForBuilder = generateImportsForBuilder(
              output,
              adjustedImports,
              schemasPathRelative,
              schemaTagMap,
            );

            let data = header;

            if (hasHelpers) {
              data += buildTagHelpersImport(
                helpers,
                helperImportPath,
                operation.implementation,
              );
            }

            data += builder.imports({
              client: output.client,
              implementation: operation.implementation,
              imports: importsForBuilder,
              projectName,
              hasSchemaDir: !!output.schemas,
              isAllowSyntheticDefaultImports,
              hasGlobalMutator: !!output.override.mutator,
              hasTagsMutator: Object.values(output.override.tags).some(
                (tagOverride) => !!tagOverride?.mutator,
              ),
              hasParamsSerializerOptions:
                !!output.override.paramsSerializerOptions,
              packageJson: output.packageJson,
              output,
            });

            if (operation.mutators) {
              data += generateMutatorImports({
                mutators: operation.mutators,
                implementation: operation.implementation,
                oneMore: true,
              });
            }

            if (operation.clientMutators) {
              data += generateMutatorImports({
                mutators: operation.clientMutators,
                oneMore: true,
              });
            }

            if (operation.formData) {
              data += generateMutatorImports({
                mutators: operation.formData,
                oneMore: true,
              });
            }

            if (operation.formUrlEncoded) {
              data += generateMutatorImports({
                mutators: operation.formUrlEncoded,
                oneMore: true,
              });
            }

            if (operation.paramsSerializer) {
              data += generateMutatorImports({
                mutators: operation.paramsSerializer,
                oneMore: true,
              });
            }

            if (operation.paramsFilter) {
              data += generateMutatorImports({
                mutators: operation.paramsFilter,
                oneMore: true,
              });
            }

            if (operation.fetchReviver) {
              data += generateMutatorImports({
                mutators: operation.fetchReviver,
                oneMore: true,
              });
            }

            data += '\n\n';

            if (operation.implementation.includes('NonReadonly<')) {
              data += getOrvalGeneratedTypes();
              data += '\n';
            }

            if (operation.implementation.includes('TypedResponse<')) {
              data += getTypedResponse();
              data += '\n';
            }

            data += operation.implementation;

            await writeGeneratedFile(implementationPath, data);

            const extraPaths: string[] = [];

            for (const mockOutput of operation.mockOutputsFull) {
              if (!mockOutput.implementation.handlerName) continue;

              const rawEntry = output.mock.generators.find((g) => {
                if (isFunction(g))
                  return mockOutput.type === OutputMockType.MSW;
                return g.type === mockOutput.type;
              });
              if (!rawEntry) continue;

              const mockExtension = isFunction(rawEntry)
                ? OutputMockType.MSW
                : getMockFileExtensionByTypeName(rawEntry);
              const mockDir = getMockDir(rawEntry, output.mock) ?? dirname;

              const kebabOperation = kebab(operation.operationName);
              const mockFilePath = path.join(
                mockDir,
                tag,
                kebabOperation + '.' + mockExtension + extension,
              );

              const mockRelativeSchemasPath =
                schemaCustomImportPath ??
                resolveMockSchemasPath(mockFilePath, schemasTarget);

              const finalizeMockOptions = getFinalizeMockImplementationOptions(
                output,
                mockOutput,
              );

              const finalizedMockImplementation =
                builder.finalizeMockImplementation
                  ? builder.finalizeMockImplementation(
                      mockOutput.implementation.function +
                        mockOutput.implementation.handler,
                      finalizeMockOptions,
                    )
                  : mockOutput.implementation.function +
                    mockOutput.implementation.handler;

              const usesSchemaFactories =
                !isFunction(rawEntry) &&
                rawEntry.type === OutputMockType.FAKER &&
                rawEntry.schemas === true;
              const recoveredSchemaFactoryImports =
                usesSchemaFactories && output.schemas
                  ? collectRecoveredSchemaFactoryImports(
                      finalizedMockImplementation,
                      builder.schemas
                        .filter((s) => s.schema)
                        .map((s) => s.name),
                    )
                  : [];

              const importsMockForBuilder = generateImportsForBuilder(
                output,
                filterLocalStrictMockTypeImports(
                  mergeGeneratorImports(
                    mockOutput.imports,
                    recoveredSchemaFactoryImports,
                  ),
                  finalizeMockOptions.strictSchemaTypeNames,
                ),
                mockRelativeSchemasPath,
                schemaTagMap,
              );

              let mockData = header;
              mockData += builder.importsMock({
                implementation: finalizedMockImplementation,
                imports: importsMockForBuilder,
                projectName,
                hasSchemaDir: !!output.schemas,
                isAllowSyntheticDefaultImports,
                options: isFunction(rawEntry) ? undefined : rawEntry,
              });
              mockData += `\n${finalizedMockImplementation}`;

              await writeGeneratedFile(mockFilePath, mockData);
              extraPaths.push(mockFilePath);

              let indexEntry = mockIndexEntries.find(
                (e) => e.ext === mockExtension && e.mockDir === mockDir,
              );
              if (!indexEntry) {
                indexEntry = { ext: mockExtension, mockDir, operations: [] };
                mockIndexEntries.push(indexEntry);
              }
              if (!indexEntry.operations.includes(kebabOperation)) {
                indexEntry.operations.push(kebabOperation);
              }
            }

            return {
              operationFilename,
              hasOperationSchemas,
              operationSchemasFilename,
              paths: [
                implementationPath,
                ...(hasOperationSchemas ? [operationSchemasPath] : []),
                ...extraPaths,
              ],
            };
          }),
        );

        const indexPaths: string[] = [];
        if (output.indexFiles) {
          const importExtension = getImportExtension(
            extension,
            output.tsconfig,
          );
          // Re-export only the runtime files, not each operation's
          // `.schemas` file: two operations that both reference the same
          // component schema (e.g. `Error` on every error response) would
          // otherwise each declare it, and `export *`-ing both from this
          // barrel is an ambiguous re-export. A schema type needed outside
          // its own operation file can still be imported directly from
          // `./<operation>.schemas`.
          const barrelContent = operationFilePaths
            .map(
              ({ operationFilename }) =>
                `export * from './${operationFilename}${importExtension}';\n`,
            )
            .join('');
          const indexPath = path.join(tagDir, `index${extension}`);
          await writeGeneratedFile(indexPath, barrelContent);
          indexPaths.push(indexPath);
        }

        const mockIndexPaths: string[] = [];
        if (output.mock.indexMockFiles) {
          const mockImportExtension = getImportExtension(
            extension,
            output.tsconfig,
          );
          for (const {
            ext,
            mockDir,
            operations: opNames,
          } of mockIndexEntries) {
            const indexPath = path.join(mockDir, `index.${ext}${extension}`);
            const indexContent = opNames
              .toSorted((a, b) => a.localeCompare(b))
              .map((opName) => {
                const localMockPath = upath.joinSafe(
                  './',
                  tag,
                  opName + '.' + ext + mockImportExtension,
                );
                return ext === OutputMockType.MSW
                  ? `export { get${pascal(opName)}Mock } from '${localMockPath}'\n`
                  : `export * from '${localMockPath}'\n`;
              })
              .join('');
            await writeGeneratedFile(indexPath, indexContent);
            mockIndexPaths.push(indexPath);
          }
        }

        return [
          ...(hasHelpers ? [helperPath] : []),
          ...operationFilePaths.flatMap(({ paths }) => paths),
          ...indexPaths,
          ...mockIndexPaths,
        ];
      } catch (error) {
        throw new Error(
          `Oups... 🍻. An Error occurred while writing tag ${tag} => ${String(error)}`,
          { cause: error },
        );
      }
    }),
  );

  const allGeneratedPaths = generatedFilePathsArray.flat();

  let rootIndexPath: string | undefined;
  if (output.indexFiles) {
    const importExtension = getImportExtension(extension, output.tsconfig);
    const rootBarrelContent = tagEntries
      .map(([tag]) => `export * from './${tag}/index${importExtension}';\n`)
      .join('');
    rootIndexPath = path.join(dirname, `index${extension}`);
    await writeGeneratedFile(rootIndexPath, rootBarrelContent);
  }

  return [
    ...(globalSchemasPath ? [globalSchemasPath] : []),
    ...(rootIndexPath ? [rootIndexPath] : []),
    ...allGeneratedPaths,
  ];
}
