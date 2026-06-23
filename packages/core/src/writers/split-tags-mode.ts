import path from 'node:path';

import { generateModelsInline, generateMutatorImports } from '../generators';
import {
  OutputClient,
  OutputMockType,
  type SharedTypeDeclaration,
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
  pascal,
  upath,
} from '../utils';
import { getMockFileExtensionByTypeName } from '../utils/file-extensions';
import { writeGeneratedFile } from './file';
import {
  getFinalizeMockImplementationOptions,
  filterLocalStrictMockTypeImports,
} from './finalize-mock-implementation';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import {
  collectRecoveredSchemaFactoryImports,
  mergeGeneratorImports,
} from './mock-imports';
import { getMockDir, resolveMockSchemasPath } from './mock-utils';
import { generateTargetForTags } from './target-tags';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

export async function writeSplitTagsMode({
  builder,
  output,
  projectName,
  header,
  needSchema,
  generateSchemasInline,
}: WriteModeProps): Promise<string[]> {
  const { filename, dirname, extension } = getFileInfo(output.target, {
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

  interface MockIndexEntry {
    ext: OutputMockType;
    mockDir: string;
    tags: string[];
  }
  const mockIndexEntries: MockIndexEntry[] = [];
  const seenMockIndexKeys = new Set<string>();

  const schemasTarget = output.schemas
    ? // `output.schemas(.path)` already *is* the schemas directory. Use it
      // directly rather than `getFileInfo(...).dirname`, which collapses to the
      // parent directory when the name contains a dot, e.g. `*.schemas` (#3624)
      // — that broke the mock files' schema imports derived from `schemasTarget`
      // via `resolveMockSchemasPath`. For a dot-free name `getFileInfo(...)
      // .dirname` returns the same directory, so existing output is unchanged.
      isString(output.schemas)
      ? output.schemas
      : output.schemas.path
    : path.join(
        dirname,
        filename + '.schemas' + getImportExtension(extension, output.tsconfig),
      );

  const tagEntries = Object.entries(target).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );

  const deduplicationEnabled =
    output.tagsSplitDeduplication && !output.workspace;

  const collectedSharedTypes: SharedTypeDeclaration[] = [];
  const seenSharedTypeNames = new Set<string>();
  for (const [, target] of tagEntries) {
    if (!target.sharedTypes) continue;
    for (const t of target.sharedTypes) {
      if (!seenSharedTypeNames.has(t.name)) {
        seenSharedTypeNames.add(t.name);
        collectedSharedTypes.push(t);
      }
    }
  }

  const commonTypesImportExtension = getImportExtension(
    extension,
    output.tsconfig,
  );
  const commonTypesBasename = output.commonTypesFileName;
  const commonTypesPath = path.join(dirname, commonTypesBasename + extension);
  const commonTypesRelativeImport =
    '..' +
    '/' +
    commonTypesBasename +
    (deduplicationEnabled ? commonTypesImportExtension : '');

  const generatedFilePathsArray = await Promise.all(
    tagEntries.map(async ([tag, target]) => {
      try {
        const {
          imports,
          implementation,
          mockOutputs,
          mutators,
          clientMutators,
          formData,
          fetchReviver,
          formUrlEncoded,
          paramsSerializer,
          paramsFilter,
        } = target;

        let implementationData = header;

        if (
          deduplicationEnabled &&
          target.sharedTypes &&
          target.sharedTypes.length > 0
        ) {
          const typeNames = target.sharedTypes.map((t) => t.name).join(', ');
          implementationData += `import type { ${typeNames} } from '${commonTypesRelativeImport}';\n`;
        }

        const importerPath = path.join(dirname, tag, tag + extension);
        const schemaCustomImportPath = getSchemasImportPath(output.schemas);
        const relativeSchemasPath = output.schemas
          ? (schemaCustomImportPath ??
            // `output.schemas(.path)` is a directory. Resolve the relative
            // import to it directly (with the file extension kept) so the path
            // stays correct even when the directory does not exist on disk yet
            // and when its name contains a dot, e.g. `*.schemas` (#3624).
            // Deriving it from `getFileInfo(...).dirname` collapsed to `../.`
            // in those cases.
            upath.getRelativeImportPath(
              importerPath,
              isString(output.schemas) ? output.schemas : output.schemas.path,
              true,
            ))
          : '../' +
            filename +
            '.schemas' +
            getImportExtension(extension, output.tsconfig);

        const tagNames = new Set(tagEntries.map(([t]) => t));
        const serviceSuffix =
          OutputClient.ANGULAR === output.client ? '.service' : '';

        const adjustedImports = imports.map((imp) => {
          if (!imp.importPath) return imp;

          if (!imp.importPath.startsWith('.')) return imp;

          const resolvedPath = path.resolve(dirname, imp.importPath);
          const targetBasename = path.basename(resolvedPath);

          let targetFile: string;
          if (tagNames.has(targetBasename)) {
            const tagFilename = targetBasename + serviceSuffix + extension;
            targetFile = path.join(resolvedPath, tagFilename);
          } else {
            targetFile = resolvedPath + extension;
          }

          const adjustedPath = upath.getRelativeImportPath(
            importerPath,
            targetFile,
          );

          return { ...imp, importPath: adjustedPath };
        });

        const importsForBuilder = generateImportsForBuilder(
          output,
          adjustedImports,
          relativeSchemasPath,
        );

        implementationData += builder.imports({
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
          implementationData += generateMutatorImports({
            mutators,
            implementation,
            oneMore: true,
          });
        }

        if (clientMutators) {
          implementationData += generateMutatorImports({
            mutators: clientMutators,
            oneMore: true,
          });
        }

        if (formData) {
          implementationData += generateMutatorImports({
            mutators: formData,
            oneMore: true,
          });
        }
        if (formUrlEncoded) {
          implementationData += generateMutatorImports({
            mutators: formUrlEncoded,
            oneMore: true,
          });
        }
        if (paramsSerializer) {
          implementationData += generateMutatorImports({
            mutators: paramsSerializer,
            oneMore: true,
          });
        }
        if (paramsFilter) {
          implementationData += generateMutatorImports({
            mutators: paramsFilter,
            oneMore: true,
          });
        }

        if (fetchReviver) {
          implementationData += generateMutatorImports({
            mutators: fetchReviver,
            oneMore: true,
          });
        }

        if (implementation.includes('NonReadonly<')) {
          implementationData += getOrvalGeneratedTypes();
          implementationData += '\n';
        }

        if (implementation.includes('TypedResponse<')) {
          implementationData += getTypedResponse();
          implementationData += '\n';
        }

        implementationData += `\n${implementation}`;

        const implementationFilename =
          tag +
          (OutputClient.ANGULAR === output.client ? '.service' : '') +
          extension;

        const implementationPath = path.join(
          dirname,
          tag,
          implementationFilename,
        );
        await writeGeneratedFile(implementationPath, implementationData);

        const mockPaths: string[] = [];

        for (const mockOutput of mockOutputs) {
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
            tag,
            tag + '.' + mockExtension + extension,
          );

          const mockRelativeSchemasPath =
            schemaCustomImportPath ??
            resolveMockSchemasPath(mockFilePath, schemasTarget);

          const finalizeMockOptions = getFinalizeMockImplementationOptions(
            output,
            mockOutput,
          );

          const finalizedMockImplementation = builder.finalizeMockImplementation
            ? builder.finalizeMockImplementation(
                mockOutput.implementation,
                finalizeMockOptions,
              )
            : mockOutput.implementation;

          const usesSchemaFactories =
            !isFunction(rawEntry) &&
            rawEntry.type === OutputMockType.FAKER &&
            rawEntry.schemas === true;
          const recoveredSchemaFactoryImports =
            usesSchemaFactories && output.schemas
              ? collectRecoveredSchemaFactoryImports(
                  finalizedMockImplementation,
                  builder.schemas.filter((s) => s.schema).map((s) => s.name),
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
          mockPaths.push(mockFilePath);

          const indexKey = `${mockExtension}::${mockDir}`;
          let indexEntry = mockIndexEntries.find(
            (e) => e.ext === mockExtension && e.mockDir === mockDir,
          );
          if (!indexEntry) {
            indexEntry = { ext: mockExtension, mockDir, tags: [] };
            mockIndexEntries.push(indexEntry);
            seenMockIndexKeys.add(indexKey);
          }
          if (!indexEntry.tags.includes(tag)) {
            indexEntry.tags.push(tag);
          }
        }

        return [
          implementationPath,
          ...(schemasPath ? [schemasPath] : []),
          ...mockPaths,
        ];
      } catch (error) {
        throw new Error(
          `Oups... 🍻. An Error occurred while splitting tag ${tag} => ${String(error)}`,
          { cause: error },
        );
      }
    }),
  );

  if (output.mock.indexMockFiles) {
    const mockImportExtension = getImportExtension(extension, output.tsconfig);
    for (const { ext, mockDir, tags } of mockIndexEntries) {
      const indexPath = path.join(mockDir, `index.${ext}${extension}`);
      const indexContent = tags
        .toSorted((a, b) => a.localeCompare(b))
        .map((tag) => {
          const localMockPath = upath.joinSafe(
            './',
            tag,
            tag + '.' + ext + mockImportExtension,
          );
          return ext === OutputMockType.MSW
            ? `export { get${pascal(tag)}Mock } from '${localMockPath}'\n`
            : `export * from '${localMockPath}'\n`;
        })
        .join('');
      await writeGeneratedFile(indexPath, indexContent);
    }
  }

  let commonTypesFilePath: string | undefined;
  if (deduplicationEnabled && collectedSharedTypes.length > 0) {
    const commonTypesContent =
      collectedSharedTypes.map((t) => `export ${t.code}`).join('\n') + '\n';
    commonTypesFilePath = commonTypesPath;
    await writeGeneratedFile(commonTypesPath, commonTypesContent);
  }

  let indexFilePath: string | undefined;
  if (output.indexFiles && deduplicationEnabled && tagEntries.length > 0) {
    const importExtension = getImportExtension(
      output.fileExtension,
      output.tsconfig,
    );
    const serviceSuffix =
      OutputClient.ANGULAR === output.client ? '.service' : '';

    const publicSharedTypeNames = collectedSharedTypes
      .filter((t) => t.exported)
      .map((t) => t.name);

    const namedReExports =
      publicSharedTypeNames.length > 0
        ? `export type { ${publicSharedTypeNames.join(', ')} } from './${commonTypesBasename}${importExtension}';\n`
        : '';

    const tagReExports = tagEntries
      .map(([tag]) => {
        const tagFile = upath.joinSafe(
          './',
          tag,
          tag + serviceSuffix + importExtension,
        );
        return `export * from '${tagFile}';\n`;
      })
      .join('');

    const indexContent = namedReExports + tagReExports;
    indexFilePath = path.join(dirname, `index${extension}`);
    await writeGeneratedFile(indexFilePath, indexContent);
  }

  return [
    ...new Set([
      ...(output.mock.indexMockFiles
        ? mockIndexEntries.map(({ mockDir, ext }) =>
            path.join(mockDir, `index.${ext}${extension}`),
          )
        : []),
      ...(commonTypesFilePath ? [commonTypesFilePath] : []),
      ...(indexFilePath ? [indexFilePath] : []),
      ...generatedFilePathsArray.flat(),
    ]),
  ];
}
