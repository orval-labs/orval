import path from 'node:path';

import fs from 'fs-extra';

import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputClient, type WriteModeProps } from '../types';
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

  const mockOption =
    output.mock && !isFunction(output.mock) ? output.mock : undefined;
  const indexFilePath = mockOption?.indexMockFiles
    ? path.join(
        dirname,
        'index.' + getMockFileExtensionByTypeName(mockOption) + extension,
      )
    : undefined;
  if (indexFilePath) {
    await fs.outputFile(indexFilePath, '');
  }

  const tagEntries = Object.entries(target);

  const generatedFilePathsArray = await Promise.all(
    tagEntries.map(async ([tag, target]) => {
      try {
        const {
          imports,
          implementation,
          implementationMock,
          importsMock,
          mutators,
          clientMutators,
          formData,
          fetchReviver,
          formUrlEncoded,
          paramsSerializer,
        } = target;

        let implementationData = header;
        let mockData = header;

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

        const importsMockForBuilder = generateImportsForBuilder(
          output,
          importsMock,
          relativeSchemasPath,
        );

        mockData += builder.importsMock({
          implementation: implementationMock,
          imports: importsMockForBuilder,
          projectName,
          hasSchemaDir: !!output.schemas,
          isAllowSyntheticDefaultImports,
          options: isFunction(output.mock) ? undefined : output.mock,
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
        mockData += `\n${implementationMock}`;

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

        const mockPath = output.mock
          ? path.join(
              dirname,
              tag,
              tag +
                '.' +
                getMockFileExtensionByTypeName(output.mock) +
                extension,
            )
          : undefined;

        if (mockPath) {
          await writeGeneratedFile(mockPath, mockData);
        }

        return [
          implementationPath,
          ...(schemasPath ? [schemasPath] : []),
          ...(mockPath ? [mockPath] : []),
        ];
      } catch (error) {
        throw new Error(
          `Oups... 🍻. An Error occurred while splitting tag ${tag} => ${String(error)}`,
          { cause: error },
        );
      }
    }),
  );

  // Write mock index file after Promise.all to ensure deterministic export order.
  if (indexFilePath && mockOption) {
    const indexContent = tagEntries
      .map(([tag]) => {
        const localMockPath = upath.joinSafe(
          './',
          tag,
          tag + '.' + getMockFileExtensionByTypeName(mockOption),
        );
        return `export { get${pascal(tag)}Mock } from '${localMockPath}'\n`;
      })
      .join('');
    await fs.appendFile(indexFilePath, indexContent);
  }

  return [
    ...new Set([
      ...(indexFilePath ? [indexFilePath] : []),
      ...generatedFilePathsArray.flat(),
    ]),
  ];
}
