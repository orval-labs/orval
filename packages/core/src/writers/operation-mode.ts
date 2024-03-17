import fs from 'fs-extra';
import { generateModelsInline, generateMutatorImports } from '../generators';
import { OutputClient, WriteModeProps } from '../types';
import {
  camel,
  compareVersions,
  getFileInfo,
  isFunction,
  isSyntheticDefaultImportsAllow,
  pascal,
  upath,
} from '../utils';
import { getOrvalGeneratedTypes } from './types';

export const writeOperationMode = async ({
  builder,
  output,
  specsName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> => {
  try {
    const { dirname, filename, extension } = getFileInfo(output.target, {
      backupFilename: camel(builder.info.title),
    });

    const operationNames = Object.values(builder.operations).map(
      ({ operationName }) => operationName,
    );
    const isAngularClient = output?.client === OutputClient.ANGULAR;

    const typescriptVersion =
      output.packageJson?.dependencies?.['typescript'] ??
      output.packageJson?.devDependencies?.['typescript'] ??
      '4.4.0';

    const hasAwaitedType = compareVersions(typescriptVersion, '4.5.0');

    const titles = builder.title({
      outputClient: output.client,
      title: pascal(builder.info.title),
      customTitleFunc: output.override.title,
      output,
    });

    return Promise.all(
      Object.values(builder.operations).map(
        async ({
          mutator,
          implementation,
          imports,
          importsMock,
          implementationMock,
          clientMutators,
          formData,
          formUrlEncoded,
          paramsSerializer,
          operationName,
        }) => {
          const path = upath.join(dirname, filename + operationName + '.ts');

          const isMutator = !!(isAngularClient
            ? mutator?.hasThirdArg
            : mutator?.hasSecondArg);

          let data = header;

          const schemasPathRelative = output.schemas
            ? upath.relativeSafe(dirname, getFileInfo(output.schemas).dirname)
            : './' + filename + '.schemas';

          const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
            output.tsconfig,
          );

          const headerBuilder = builder.header({
            outputClient: output.client,
            isRequestOptions: output.override.requestOptions !== false,
            isMutator,
            isGlobalMutator: !!output.override.mutator,
            provideIn: output.override.angular.provideIn,
            hasAwaitedType,
            titles,
            output,
            verbOptions: builder.verbOptions,
            clientImplementation: implementation,
          });

          const footerBuilder = builder.footer({
            outputClient: output?.client,
            operationNames,
            hasMutator: !!mutator,
            hasAwaitedType,
            titles,
            output: output,
          });

          data += builder.imports({
            client: output.client,
            implementation:
              headerBuilder.implementation +
              implementation +
              footerBuilder.implementation,
            imports: [
              {
                exports: imports.filter(
                  (imp) =>
                    !importsMock.some((impMock) => imp.name === impMock.name),
                ),
                dependency: schemasPathRelative,
              },
            ],
            specsName,
            hasSchemaDir: !!output.schemas,
            isAllowSyntheticDefaultImports,
            hasGlobalMutator: !!output.override.mutator,
            hasParamsSerializerOptions:
              !!output.override.paramsSerializerOptions,
            packageJson: output.packageJson,
            output,
          });

          if (output.mock) {
            data += builder.importsMock({
              implementation:
                implementationMock.function +
                implementationMock.handler +
                headerBuilder.implementationMock +
                implementationMock.handlerName +
                footerBuilder.implementationMock,
              imports: [
                { exports: importsMock, dependency: schemasPathRelative },
              ],
              specsName,
              hasSchemaDir: !!output.schemas,
              isAllowSyntheticDefaultImports,
              options: !isFunction(output.mock) ? output.mock : undefined,
            });
          }

          const schemasPath = !output.schemas
            ? upath.join(dirname, filename + '.schemas' + extension)
            : undefined;

          if (schemasPath && needSchema) {
            const schemasData = header + generateModelsInline(builder.schemas);

            await fs.outputFile(schemasPath, schemasData);
          }

          if (mutator) {
            data += generateMutatorImports({
              mutators: [mutator],
              implementation,
            });
          }

          if (clientMutators) {
            data += generateMutatorImports({ mutators: clientMutators });
          }

          if (formData) {
            data += generateMutatorImports({ mutators: [formData] });
          }

          if (formUrlEncoded) {
            data += generateMutatorImports({ mutators: [formUrlEncoded] });
          }

          if (paramsSerializer) {
            data += generateMutatorImports({ mutators: [paramsSerializer] });
          }

          if (implementation.includes('NonReadonly<')) {
            data += getOrvalGeneratedTypes();
            data += '\n';
          }

          data += `\n\n${headerBuilder.implementation}${implementation}${footerBuilder.implementation}`;

          if (output.mock) {
            data += '\n\n';
            data += implementationMock;
          }

          await fs.outputFile(path, data);

          return path;
        },
      ),
    );
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing file => ${e}`;
  }
};
