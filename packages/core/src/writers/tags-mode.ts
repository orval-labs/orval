import path from 'node:path';

import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputMockType, type WriteModeProps } from '../types';
import {
  conventionName,
  getFileInfo,
  getSchemasImportPath,
  isFunction,
  isString,
  isSyntheticDefaultImportsAllow,
  kebab,
  pascal,
  upath,
} from '../utils';
import { getMockFileExtensionByTypeName } from '../utils/file-extensions';
import { escapeRegExp } from '../utils/string';
import { writeGeneratedFile } from './file';
import {
  getFinalizeMockImplementationOptions,
  filterLocalStrictMockTypeImports,
} from './finalize-mock-implementation';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { collapseInlineMockOutputs } from './mock-outputs';
import {
  getMockDir,
  hasAnyMockPath,
  resolveMockSchemasPath,
} from './mock-utils';
import { generateTargetForTags } from './target-tags';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

export async function writeTagsMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
  generateSchemasInline,
}: WriteModeProps): Promise<string[]> {
  const {
    path: targetPath,
    filename,
    dirname,
    extension,
  } = getFileInfo(output.target, {
    backupFilename: conventionName(
      builder.info.title ?? 'filename',
      output.namingConvention,
    ),
    extension: output.fileExtension,
  });

  const target = generateTargetForTags(builder, output);

  const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
    output.tsconfig,
  );

  const shouldDeinlineMocks = hasAnyMockPath(output.mock);

  interface MockIndexEntry {
    ext: OutputMockType;
    mockDir: string;
    tags: string[];
  }
  const mockIndexEntries: MockIndexEntry[] = [];
  const seenMockIndexKeys = new Set<string>();

  const schemaCustomImportPath = getSchemasImportPath(output.schemas);
  const schemasPathRelative = output.schemas
    ? (schemaCustomImportPath ??
      upath.getRelativeImportPath(
        targetPath,
        getFileInfo(
          isString(output.schemas) ? output.schemas : output.schemas.path,
          { extension: output.fileExtension },
        ).dirname,
      ))
    : './' + filename + '.schemas' + extension.replace(/\.ts$/, '');

  const schemasTarget = output.schemas
    ? getFileInfo(
        isString(output.schemas) ? output.schemas : output.schemas.path,
        { extension: output.fileExtension },
      ).dirname
    : path.join(
        dirname,
        filename + '.schemas' + extension.replace(/\.ts$/, ''),
      );

  const tagEntries = Object.entries(target).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );

  const generatedFilePathsArray = await Promise.all(
    tagEntries.map(async ([tag, target]) => {
      try {
        const {
          imports,
          implementation,
          mockOutputs: rawMockOutputs,
          mutators,
          clientMutators,
          formData,
          formUrlEncoded,
          fetchReviver,
          paramsSerializer,
          paramsFilter,
        } = target;

        const implementationImports = imports.filter((imp) => {
          const searchWords = [imp.alias, imp.name]
            .filter((part): part is string => Boolean(part?.length))
            .map((part) => escapeRegExp(part))
            .join('|');
          if (!searchWords) {
            return false;
          }

          return new RegExp(String.raw`\b(${searchWords})\b`, 'g').test(
            implementation,
          );
        });

        const normalizedImports = implementationImports.map((imp) => ({
          ...imp,
        }));

        const collapsedMockOutputs = shouldDeinlineMocks
          ? []
          : collapseInlineMockOutputs(rawMockOutputs);

        let data = header;

        if (!shouldDeinlineMocks) {
          const importsMock = collapsedMockOutputs.flatMap((m) => m.imports);

          for (const mockImport of importsMock) {
            const matchingImport = normalizedImports.find(
              (imp) =>
                imp.name === mockImport.name &&
                (imp.alias ?? '') === (mockImport.alias ?? ''),
            );
            if (!matchingImport) continue;

            const mockNeedsRuntimeValue =
              !!mockImport.values ||
              !!mockImport.isConstant ||
              !!mockImport.default ||
              !!mockImport.namespaceImport ||
              !!mockImport.syntheticDefaultImport;
            if (mockNeedsRuntimeValue) {
              matchingImport.values = true;
            }
          }
        }

        const importsForBuilder = generateImportsForBuilder(
          output,
          normalizedImports,
          schemasPathRelative,
        );

        data += builder.imports({
          client: output.client,
          implementation,
          imports: importsForBuilder,
          projectName,
          hasSchemaDir: !!output.schemas,
          isAllowSyntheticDefaultImports,
          hasGlobalMutator: !!output.override.mutator,
          hasTagsMutator: Object.values(output.override.tags).some(
            (tag) => !!tag?.mutator,
          ),
          hasParamsSerializerOptions: !!output.override.paramsSerializerOptions,
          packageJson: output.packageJson,
          output,
        });

        if (!shouldDeinlineMocks) {
          for (const mockOutput of collapsedMockOutputs) {
            const entry = output.mock.generators.find(
              (g) => !isFunction(g) && g.type === mockOutput.type,
            );
            const importsMockForBuilder = generateImportsForBuilder(
              output,
              mockOutput.imports.filter(
                (impMock) =>
                  !normalizedImports.some(
                    (imp) =>
                      imp.name === impMock.name &&
                      (imp.alias ?? '') === (impMock.alias ?? ''),
                  ),
              ),
              schemasPathRelative,
            );

            data += builder.importsMock({
              implementation: mockOutput.implementation,
              imports: importsMockForBuilder,
              projectName,
              hasSchemaDir: !!output.schemas,
              isAllowSyntheticDefaultImports,
              options: entry && !isFunction(entry) ? entry : undefined,
            });
          }
        }

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

        if (mutators) {
          data += generateMutatorImports({ mutators, implementation });
        }

        if (clientMutators) {
          data += generateMutatorImports({
            mutators: clientMutators,
          });
        }

        if (formData) {
          data += generateMutatorImports({ mutators: formData });
        }

        if (formUrlEncoded) {
          data += generateMutatorImports({ mutators: formUrlEncoded });
        }

        if (paramsSerializer) {
          data += generateMutatorImports({ mutators: paramsSerializer });
        }

        if (paramsFilter) {
          data += generateMutatorImports({ mutators: paramsFilter });
        }

        if (fetchReviver) {
          data += generateMutatorImports({ mutators: fetchReviver });
        }

        data += '\n\n';

        if (implementation.includes('NonReadonly<')) {
          data += getOrvalGeneratedTypes();
          data += '\n';
        }

        if (implementation.includes('TypedResponse<')) {
          data += getTypedResponse();
          data += '\n';
        }

        data += implementation;

        if (!shouldDeinlineMocks) {
          const implementationMock = collapsedMockOutputs
            .map((m) => m.implementation)
            .join('\n\n');
          const finalizedImplementationMock = builder.finalizeMockImplementation
            ? builder.finalizeMockImplementation(
                implementationMock,
                getFinalizeMockImplementationOptions(
                  output,
                  collapsedMockOutputs,
                ),
              )
            : implementationMock;

          if (collapsedMockOutputs.length > 0) {
            data += '\n\n';
            data += finalizedImplementationMock;
          }
        }

        const kebabTag = kebab(tag);
        const implementationPath = path.join(
          dirname,
          `${kebabTag}${extension}`,
        );
        await writeGeneratedFile(implementationPath, data);

        const extraPaths: string[] = [];

        if (shouldDeinlineMocks) {
          for (const mockOutput of rawMockOutputs) {
            const rawEntry = output.mock.generators.find((g) => {
              if (isFunction(g)) return mockOutput.type === OutputMockType.MSW;
              return g.type === mockOutput.type;
            });
            if (!rawEntry) continue;

            const mockExtension = isFunction(rawEntry)
              ? OutputMockType.MSW
              : getMockFileExtensionByTypeName(rawEntry);
            const mockDir = getMockDir(rawEntry, output.mock) ?? dirname;

            const mockFilePath = path.join(
              mockDir,
              kebabTag,
              kebabTag + '.' + mockExtension + extension,
            );

            const mockRelativeSchemasPath =
              schemaCustomImportPath ??
              resolveMockSchemasPath(mockFilePath, schemasTarget);

            const finalizeMockOptions = getFinalizeMockImplementationOptions(
              output,
              mockOutput,
            );

            const importsMockForBuilder = generateImportsForBuilder(
              output,
              filterLocalStrictMockTypeImports(
                mockOutput.imports,
                finalizeMockOptions.strictSchemaTypeNames,
              ),
              mockRelativeSchemasPath,
            );

            let mockData = header;
            const finalizedMockImplementation =
              builder.finalizeMockImplementation
                ? builder.finalizeMockImplementation(
                    mockOutput.implementation,
                    finalizeMockOptions,
                  )
                : mockOutput.implementation;
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

            const indexKey = `${mockExtension}::${mockDir}`;
            let indexEntry = mockIndexEntries.find(
              (e) => e.ext === mockExtension && e.mockDir === mockDir,
            );
            if (!indexEntry) {
              indexEntry = { ext: mockExtension, mockDir, tags: [] };
              mockIndexEntries.push(indexEntry);
              seenMockIndexKeys.add(indexKey);
            }
            if (!indexEntry.tags.includes(kebabTag)) {
              indexEntry.tags.push(kebabTag);
            }
          }
        }

        return [
          implementationPath,
          ...(schemasPath ? [schemasPath] : []),
          ...extraPaths,
        ];
      } catch (error) {
        throw new Error(
          `Oups... 🍻. An Error occurred while writing tag ${tag} => ${String(error)}`,
          { cause: error },
        );
      }
    }),
  );

  if (shouldDeinlineMocks && output.mock.indexMockFiles) {
    for (const { ext, mockDir, tags } of mockIndexEntries) {
      const indexPath = path.join(mockDir, `index.${ext}${extension}`);
      const indexContent = tags
        .toSorted((a, b) => a.localeCompare(b))
        .map((kebabTag) => {
          const localMockPath = upath.joinSafe(
            './',
            kebabTag,
            kebabTag + '.' + ext,
          );
          return ext === OutputMockType.MSW
            ? `export { get${pascal(kebabTag)}Mock } from '${localMockPath}'\n`
            : `export * from '${localMockPath}'\n`;
        })
        .join('');
      await writeGeneratedFile(indexPath, indexContent);
      generatedFilePathsArray.push([indexPath]);
    }
  }

  return generatedFilePathsArray.flat();
}
