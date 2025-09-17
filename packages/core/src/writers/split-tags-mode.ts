import fs from 'fs-extra';

import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputClient, type WriteModeProps } from '../types';
import {
  camel,
  getFileInfo,
  isFunction,
  isSyntheticDefaultImportsAllow,
  pascal,
  upath,
} from '../utils';
import { getMockFileExtensionByTypeName } from '../utils/file-extensions';
import { generateImportsForBuilder } from './generate-imports-for-builder';
import { generateTargetForTags } from './target-tags';
import { getOrvalGeneratedTypes, getTypedResponse } from './types';

export const writeSplitTagsMode = async ({
  builder,
  output,
  specsName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> => {
  const { filename, dirname, extension } = getFileInfo(output.target, {
    backupFilename: camel(builder.info.title),
    extension: output.fileExtension,
  });

  const target = generateTargetForTags(builder, output);

  const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
    output.tsconfig,
  );

  const indexFilePath =
    output.mock && !isFunction(output.mock) && output.mock.indexMockFiles
      ? upath.join(
          dirname,
          'index.' + getMockFileExtensionByTypeName(output.mock!) + extension,
        )
      : undefined;
  if (indexFilePath) {
    await fs.outputFile(indexFilePath, '');
  }

  const generatedFilePathsArray = await Promise.all(
    Object.entries(target).map(async ([tag, target]) => {
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

        const relativeSchemasPath = output.schemas
          ? '../' +
            upath.relativeSafe(
              dirname,
              getFileInfo(output.schemas, { extension: output.fileExtension })
                .dirname,
            )
          : '../' + filename + '.schemas';

        const importsForBuilder = generateImportsForBuilder(
          output,
          imports,
          relativeSchemasPath,
        );

        implementationData += builder.imports({
          client: output.client,
          implementation,
          imports: importsForBuilder,
          specsName,
          hasSchemaDir: !!output.schemas,
          isAllowSyntheticDefaultImports,
          hasGlobalMutator: !!output.override.mutator,
          hasTagsMutator: Object.values(output.override.tags).some(
            (tag) => !!tag.mutator,
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
          specsName,
          hasSchemaDir: !!output.schemas,
          isAllowSyntheticDefaultImports,
          options: isFunction(output.mock) ? undefined : output.mock,
        });

        const schemasPath = output.schemas
          ? undefined
          : upath.join(dirname, filename + '.schemas' + extension);

        if (schemasPath && needSchema) {
          const schemasData = header + generateModelsInline(builder.schemas);

          await fs.outputFile(schemasPath, schemasData);
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

        const implementationPath = upath.join(
          dirname,
          tag,
          implementationFilename,
        );
        await fs.outputFile(implementationPath, implementationData);

        const mockPath = output.mock
          ? upath.join(
              dirname,
              tag,
              tag +
                '.' +
                getMockFileExtensionByTypeName(output.mock) +
                extension,
            )
          : undefined;

        if (mockPath) {
          await fs.outputFile(mockPath, mockData);
          if (indexFilePath) {
            const localMockPath = upath.joinSafe(
              './',
              tag,
              tag + '.' + getMockFileExtensionByTypeName(output.mock!),
            );
            fs.appendFile(
              indexFilePath,
              `export { get${pascal(tag)}Mock } from '${localMockPath}'\n`,
            );
          }
        }

        return [
          implementationPath,
          ...(schemasPath ? [schemasPath] : []),
          ...(mockPath ? [mockPath] : []),
        ];
      } catch (error) {
        throw `Oups... 🍻. An Error occurred while splitting tag ${tag} => ${error}`;
      }
    }),
  );

  return generatedFilePathsArray.flat();
};
