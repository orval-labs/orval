import path from 'node:path';

import { generateModelsInline, generateMutatorImports } from '../generators';
import {
  OutputClient,
  type OutputClientFunc,
  OutputMockType,
  type WriteModeProps,
} from '../types';
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
} from './target-tags-operations';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

const SUPPORTED_CLIENTS = new Set<string>([
  OutputClient.REACT_QUERY,
  OutputClient.SVELTE_QUERY,
  OutputClient.VUE_QUERY,
  OutputClient.SWR,
  OutputClient.FETCH,
]);

export function assertClientSupportsTagsOperations(
  client: OutputClient | OutputClientFunc,
  mode: string,
): void {
  if (typeof client !== 'string' || !SUPPORTED_CLIENTS.has(client)) {
    const clientLabel = typeof client === 'string' ? client : 'custom';
    throw new Error(
      `Output mode '${mode}' is not supported with the '${clientLabel}' client. ` +
        `It requires operations that compile to standalone functions ` +
        `(react-query, svelte-query, vue-query, swr, fetch); '${clientLabel}' ` +
        `groups operations into a shared structure. Use 'tags' or ` +
        `'tags-split' instead.`,
    );
  }
}

/**
 * `tags-operations` mode: one file per operation, nested under a per-tag
 * directory (`<dir>/<tag>/<operation><ext>`), each containing both the
 * operation's types and its runtime implementation. A per-tag barrel
 * (`<dir>/<tag>/index<ext>`) re-exports every operation file so existing
 * `import from '<build>/<tag>'`-style imports keep working.
 */
export async function writeTagsOperationsMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
  generateSchemasInline,
  schemaTagMap,
}: WriteModeProps): Promise<string[]> {
  assertClientSupportsTagsOperations(output.client, 'tags-operations');

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
  // tag subdirectory), so relative import paths need an extra `../` step
  // compared to `tags-mode.ts`'s flat layout — matching how
  // `split-tags-mode.ts` resolves paths for its per-tag subdirectories.
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

  const schemasPath =
    !output.schemas && needSchema
      ? path.join(dirname, filename + '.schemas' + extension)
      : undefined;

  if (schemasPath) {
    const schemasData = generateSchemasInline
      ? header + generateSchemasInline()
      : header + generateModelsInline(builder.schemas);

    await writeGeneratedFile(schemasPath, schemasData);
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
            const operationFilename = conventionName(
              operation.operationName,
              output.namingConvention,
            );
            const implementationPath = path.join(
              tagDir,
              `${operationFilename}${extension}`,
            );

            const implementationImports = operation.imports.filter((imp) => {
              const searchWords = [imp.alias, imp.name]
                .filter((part): part is string => Boolean(part?.length))
                .join('|');
              if (!searchWords) return false;
              return new RegExp(String.raw`\b(${searchWords})\b`, 'g').test(
                operation.implementation,
              );
            });

            const importsForBuilder = generateImportsForBuilder(
              output,
              implementationImports,
              schemasPathRelative,
              schemaTagMap,
            );

            let data = header;

            if (hasHelpers) {
              data += buildTagHelpersImport(helpers, helperImportPath);
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
              });
            }

            if (operation.clientMutators) {
              data += generateMutatorImports({
                mutators: operation.clientMutators,
              });
            }

            if (operation.formData) {
              data += generateMutatorImports({ mutators: operation.formData });
            }

            if (operation.formUrlEncoded) {
              data += generateMutatorImports({
                mutators: operation.formUrlEncoded,
              });
            }

            if (operation.paramsSerializer) {
              data += generateMutatorImports({
                mutators: operation.paramsSerializer,
              });
            }

            if (operation.paramsFilter) {
              data += generateMutatorImports({
                mutators: operation.paramsFilter,
              });
            }

            if (operation.fetchReviver) {
              data += generateMutatorImports({
                mutators: operation.fetchReviver,
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
              paths: [implementationPath, ...extraPaths],
            };
          }),
        );

        const indexPaths: string[] = [];
        if (output.indexFiles) {
          const importExtension = getImportExtension(
            extension,
            output.tsconfig,
          );
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

  return [
    ...(schemasPath ? [schemasPath] : []),
    ...generatedFilePathsArray.flat(),
  ];
}
