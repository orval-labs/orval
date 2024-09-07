import fs from 'fs-extra';
import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputClient, WriteModeProps } from '../types';
import {
  camel,
  getFileInfo,
  isFunction,
  isSyntheticDefaultImportsAllow,
  upath,
} from '../utils';
import { generateTargetForTags } from './target-tags';
import { getOrvalGeneratedTypes } from './types';
import { getMockFileExtensionByTypeName } from '../utils/fileExtensions';
import uniqBy from 'lodash.uniqby';

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

        const importsForBuilder =
          output.schemas && !output.indexFiles
            ? uniqBy(imports, 'name').map((i) => ({
                exports: [i],
                dependency: upath.join(relativeSchemasPath, camel(i.name)),
              }))
            : [{ exports: imports, dependency: relativeSchemasPath }];

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
        mockData += builder.importsMock({
          implementation: implementationMock,
          imports: [{ exports: importsMock, dependency: relativeSchemasPath }],
          specsName,
          hasSchemaDir: !!output.schemas,
          isAllowSyntheticDefaultImports,
          options: !isFunction(output.mock) ? output.mock : undefined,
        });

        const schemasPath = !output.schemas
          ? upath.join(dirname, filename + '.schemas' + extension)
          : undefined;

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

        if (implementation.includes('NonReadonly<')) {
          implementationData += getOrvalGeneratedTypes();
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
        }

        return [
          implementationPath,
          ...(schemasPath ? [schemasPath] : []),
          ...(mockPath ? [mockPath] : []),
        ];
      } catch (e) {
        throw `Oups... 🍻. An Error occurred while splitting tag ${tag} => ${e}`;
      }
    }),
  );

  return generatedFilePathsArray.flatMap((it) => it);
};
