import path from 'node:path';

import { generateModelsInline } from '../generators';
import {
  OutputClient,
  type OutputClientFunc,
  type WriteModeProps,
} from '../types';
import {
  conventionName,
  getFileInfo,
  getImportExtension,
  getSchemasImportPath,
  isString,
  isSyntheticDefaultImportsAllow,
  kebab,
  upath,
} from '../utils';
import { writeGeneratedFile } from './file';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import {
  filterImportsUsedInImplementation,
  rebaseRelativeImportPaths,
  generateClientImports,
  generateOrvalHelperTypes,
  generateTargetMutatorImports,
} from './implementation-parts';
import {
  type TagsOperationsMockIndexEntry,
  writeTagsOperationsMockFiles,
  writeTagsOperationsMockIndexes,
} from './tags-operations-mocks';
import {
  buildTagHelpersImport,
  generateTargetForTagsOperations,
} from './target-tags-operations';

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
  schemaOutputPlan,
}: WriteModeProps): Promise<string[]> {
  assertClientSupportsTagsOperations(output.client, 'tags-operations');

  const { filename, dirname, extension } = getFileInfo(output.target, {
    backupFilename: conventionName(
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      builder.info.title ?? 'filename',
      output.namingConvention,
    ),
    extension: output.fileExtension,
  });

  const target = await generateTargetForTagsOperations(builder, output);

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
      getImportExtension(output.schemaFileExtension, output.tsconfig);

  const schemasTarget = output.schemas
    ? getFileInfo(
        isString(output.schemas) ? output.schemas : output.schemas.path,
        { extension: output.fileExtension },
      ).dirname
    : path.join(
        dirname,
        filename +
          '.schemas' +
          getImportExtension(output.schemaFileExtension, output.tsconfig),
      );

  const schemasPath =
    !output.schemas && needSchema
      ? path.join(dirname, filename + '.schemas' + output.schemaFileExtension)
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

  // Accumulated across every tag and written once after `Promise.all`
  // resolves. The mock index lives at a tag-independent `mockDir`-root path
  // whose entries reference `./<tag>/<op>`, so writing it per tag would let
  // concurrent tags overwrite each other, leaving only the last tag's
  // operations. This mirrors `split-tags-mode.ts`'s function-scoped
  // accumulation.
  const mockIndexEntries: TagsOperationsMockIndexEntry[] = [];

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

            const implementationImports = rebaseRelativeImportPaths(
              filterImportsUsedInImplementation(
                operation.imports,
                operation.implementation,
              ),
              { dirname, importerPath: implementationPath, extension },
            );

            const importsForBuilder = generateImportsForBuilder(
              output,
              implementationImports,
              schemasPathRelative,
              schemaTagMap,
              schemaOutputPlan,
            );

            let data = header;

            if (hasHelpers) {
              data += buildTagHelpersImport(
                helpers,
                helperImportPath,
                operation.implementation,
              );
            }

            data += await generateClientImports({
              builder,
              output,
              implementation: operation.implementation,
              imports: importsForBuilder,
              projectName,
              isAllowSyntheticDefaultImports,
            });

            data += generateTargetMutatorImports(
              operation,
              operation.implementation,
              true,
            );

            data += '\n\n';

            data += generateOrvalHelperTypes(operation.implementation);

            data += operation.implementation;

            await writeGeneratedFile(implementationPath, data);

            const extraPaths = await writeTagsOperationsMockFiles({
              builder,
              output,
              projectName,
              header,
              schemaTagMap,
              schemaOutputPlan,
              isAllowSyntheticDefaultImports,
              tag,
              operation,
              dirname,
              extension,
              schemasTarget,
              schemaCustomImportPath,
              mockIndexEntries,
            });

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
  const mockIndexPaths = await writeTagsOperationsMockIndexes(
    mockIndexEntries,
    output,
    extension,
  );

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
