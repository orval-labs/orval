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
    operations: { tag: string; opName: string; handlerName: string }[];
  }

  // Accumulated across every tag and written once after `Promise.all`
  // resolves. The mock index lives at a tag-independent `mockDir`-root path
  // whose entries reference `./<tag>/<op>`, so writing it per tag would let
  // concurrent tags overwrite each other, leaving only the last tag's
  // operations. This mirrors `split-tags-mode.ts`'s function-scoped
  // accumulation.
  const mockIndexEntries: MockIndexEntry[] = [];

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

        const operationFilePaths = await Promise.all(
          operations.map(async (operation) => {
            const operationFilename = kebab(operation.operationName);
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
              if (
                !indexEntry.operations.some(
                  (o) => o.tag === tag && o.opName === kebabOperation,
                )
              ) {
                indexEntry.operations.push({
                  tag,
                  opName: kebabOperation,
                  handlerName: mockOutput.implementation.handlerName,
                });
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

        return [
          ...(hasHelpers ? [helperPath] : []),
          ...operationFilePaths.flatMap(({ paths }) => paths),
          ...indexPaths,
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

  // Written once, after every tag has accumulated its operations into the
  // shared `mockIndexEntries`, so the tag-independent mock index at
  // `<mockDir>/index.<ext><ext>` lists operations from all tags rather than
  // just the last-completing one.
  const mockIndexPaths: string[] = [];
  if (output.mock.indexMockFiles) {
    const mockImportExtension = getImportExtension(extension, output.tsconfig);
    for (const { ext, mockDir, operations } of mockIndexEntries) {
      const indexPath = path.join(mockDir, `index.${ext}${extension}`);
      const indexContent = operations
        .toSorted(
          (a, b) =>
            a.tag.localeCompare(b.tag) || a.opName.localeCompare(b.opName),
        )
        .map(({ tag, opName, handlerName }) => {
          const localMockPath = upath.joinSafe(
            './',
            tag,
            opName + '.' + ext + mockImportExtension,
          );
          // Alias by `{tag, opName}` (this entry's dedup key, therefore
          // always unique) rather than re-exporting `handlerName` verbatim:
          // `handlerName` is derived from `operationName`, which a user's
          // `override.operationName` function can map to the same value for
          // multiple operations, producing two identically-named exports in
          // this shared barrel.
          const alias = `${pascal(tag)}${pascal(opName)}MockHandler`;
          return ext === OutputMockType.MSW
            ? `export { ${handlerName} as ${alias} } from '${localMockPath}'\n`
            : `export * from '${localMockPath}'\n`;
        })
        .join('');
      await writeGeneratedFile(indexPath, indexContent);
      mockIndexPaths.push(indexPath);
    }
  }

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
    ...(schemasPath ? [schemasPath] : []),
    ...(rootIndexPath ? [rootIndexPath] : []),
    ...allGeneratedPaths,
    ...mockIndexPaths,
  ];
}
