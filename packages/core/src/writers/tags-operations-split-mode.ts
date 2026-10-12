import path from 'node:path';

import { generateModelsInline } from '../generators';
import { type WriteModeProps } from '../types';
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
  generateClientImports,
  generateOrvalHelperTypes,
  generateTargetMutatorImports,
} from './implementation-parts';
import {
  type TagsOperationsMockIndexEntry,
  writeTagsOperationsMockFiles,
  writeTagsOperationsMockIndexes,
} from './tags-operations-mocks';
import { assertClientSupportsTagsOperations } from './tags-operations-mode';
import {
  buildTagHelpersImport,
  generateTargetForTagsOperations,
  resolveTransitiveSchemas,
} from './target-tags-operations';

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
  schemaOutputPlan,
}: WriteModeProps): Promise<string[]> {
  assertClientSupportsTagsOperations(output.client, 'tags-operations-split');

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

  const globalSchemasPath =
    !output.schemas && needSchema
      ? path.join(dirname, filename + '.schemas' + output.schemaFileExtension)
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
            const operationSchemasFilename = `${operationFilename}.schemas${output.schemaFileExtension}`;
            const operationSchemasPath = path.join(
              tagDir,
              operationSchemasFilename,
            );
            const operationSchemasImportPath =
              './' +
              operationFilename +
              '.schemas' +
              getImportExtension(output.schemaFileExtension, output.tsconfig);

            const implementationImports = filterImportsUsedInImplementation(
              operation.imports,
              operation.implementation,
            );

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
    ...(globalSchemasPath ? [globalSchemasPath] : []),
    ...(rootIndexPath ? [rootIndexPath] : []),
    ...allGeneratedPaths,
    ...mockIndexPaths,
  ];
}
