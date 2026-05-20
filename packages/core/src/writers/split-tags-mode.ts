import path from 'node:path';

import fs from 'fs-extra';

import { generateModelsInline, generateMutatorImports } from '../generators';
import {
  type GlobalMockOptions,
  OutputClient,
  OutputMockType,
  type WriteModeProps,
} from '../types';
import {
  conventionName,
  getFileInfo,
  isFunction,
  isString,
  isSyntheticDefaultImportsAllow,
  pascal,
  upath,
} from '../utils';
import { getMockFileExtensionByTypeName } from '../utils/file-extensions';
import { writeGeneratedFile } from './file';
import { generateImportsForBuilder } from './generate-imports-for-builder';
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

  // Resolve concrete (non-function) generator entries so we can iterate over
  // them when writing per-entry index files.
  const generatorEntries = output.mocks.generators.filter(
    (g): g is GlobalMockOptions => !isFunction(g),
  );

  // Pre-create per-generator-entry index files (one per entry, e.g.
  // `index.msw.ts` and `index.faker.ts`) so they can be appended to during
  // the per-tag write loop.
  const indexFilePathsByType = new Map<string, string>();
  if (output.mocks.indexMockFiles) {
    for (const entry of generatorEntries) {
      const ext = getMockFileExtensionByTypeName(entry);
      const indexPath = path.join(dirname, `index.${ext}${extension}`);
      indexFilePathsByType.set(ext, indexPath);
      await fs.outputFile(indexPath, '');
    }
  }

  const tagEntries = Object.entries(target);

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

        const importerPath = path.join(dirname, tag, tag + extension);
        const relativeSchemasPath = output.schemas
          ? upath.getRelativeImportPath(
              importerPath,
              getFileInfo(
                isString(output.schemas) ? output.schemas : output.schemas.path,
                { extension: output.fileExtension },
              ).dirname,
            )
          : '../' + filename + '.schemas' + extension.replace(/\.ts$/, '');

        // In tags-split mode, each tag lives in its own subdirectory
        // (dirname/tag/tag.ext). Imports with a custom `importPath` (from the
        // `file` option in mutationInvalidates) are specified relative to the
        // output root (dirname) but the consuming file is one level deeper.
        // Resolve these paths so that the generated import is correct.
        const tagNames = new Set(tagEntries.map(([t]) => t));
        const serviceSuffix =
          OutputClient.ANGULAR === output.client ? '.service' : '';

        const adjustedImports = imports.map((imp) => {
          if (!imp.importPath) return imp;

          // Only adjust relative paths (./foo, ../bar). Package imports
          // like 'rxjs' or '@tanstack/react-query' must be left as-is.
          if (!imp.importPath.startsWith('.')) return imp;

          const resolvedPath = path.resolve(dirname, imp.importPath);
          const targetBasename = path.basename(resolvedPath);

          let targetFile: string;
          if (tagNames.has(targetBasename)) {
            // Target is a known tag directory. Use the real generated
            // filename which includes the Angular `.service` suffix when
            // applicable (e.g. dirname/health/health.service.ts).
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

        // Emit one mock file per configured generator entry. Per the
        // current design only non-function generator entries get their own
        // file; ClientMockBuilder functions are not yet supported here.
        const mockPaths: string[] = [];
        for (const [index, mockOutput] of mockOutputs.entries()) {
          const entry = output.mocks.generators[index];
          if (isFunction(entry)) continue;

          const importsMockForBuilder = generateImportsForBuilder(
            output,
            mockOutput.imports,
            relativeSchemasPath,
          );

          let mockData = header;
          mockData += builder.importsMock({
            implementation: mockOutput.implementation,
            imports: importsMockForBuilder,
            projectName,
            hasSchemaDir: !!output.schemas,
            isAllowSyntheticDefaultImports,
            options: entry,
          });
          mockData += `\n${mockOutput.implementation}`;

          const mockPath = path.join(
            dirname,
            tag,
            tag + '.' + getMockFileExtensionByTypeName(entry) + extension,
          );
          await writeGeneratedFile(mockPath, mockData);
          mockPaths.push(mockPath);
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

  // Write per-generator-entry index files after Promise.all to ensure
  // deterministic export order. MSW entries re-export the aggregated
  // `get<Tag>Mock` handler function; Faker entries use `export *` since
  // faker has no aggregate handler.
  if (output.mocks.indexMockFiles) {
    for (const entry of generatorEntries) {
      const ext = getMockFileExtensionByTypeName(entry);
      const indexFilePath = indexFilePathsByType.get(ext);
      if (!indexFilePath) continue;

      const indexContent = tagEntries
        .map(([tag]) => {
          const localMockPath = upath.joinSafe('./', tag, tag + '.' + ext);
          // MSW entries use the named re-export shape so existing
          // `import { get<Tag>Mock } from './api/index.msw'` consumers keep
          // working unchanged.
          return ext === OutputMockType.MSW
            ? `export { get${pascal(tag)}Mock } from '${localMockPath}'\n`
            : `export * from '${localMockPath}'\n`;
        })
        .join('');
      await fs.appendFile(indexFilePath, indexContent);
    }
  }

  return [
    ...new Set([
      ...indexFilePathsByType.values(),
      ...generatedFilePathsArray.flat(),
    ]),
  ];
}
