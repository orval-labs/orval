import {
  GeneratorOperation,
  GeneratorTarget,
  GeneratorTargetFull,
  NormalizedOutputOptions,
  OutputClient,
  WriteSpecsBuilder,
} from '../types';
import { compareVersions, kebab, pascal } from '../utils';

const addDefaultTagIfEmpty = (operation: GeneratorOperation) => ({
  ...operation,
  tags: operation.tags.length ? operation.tags : ['default'],
});

export const generateTargetForOperations = (
  builder: WriteSpecsBuilder,
  options: NormalizedOutputOptions,
) => {
  const isAngularClient = options.client === OutputClient.ANGULAR;
  return Object.values(builder.operations)
    .map(addDefaultTagIfEmpty)
    .reduce(
      (acc, operation, index, arr) => {
        const isMutator =
          !!operation.mutator &&
          (isAngularClient
            ? operation.mutator.hasThirdArg
            : operation.mutator.hasSecondArg);

        const typescriptVersion =
          options.packageJson?.dependencies?.['typescript'] ??
          options.packageJson?.devDependencies?.['typescript'] ??
          '4.4.0';

        const hasAwaitedType = compareVersions(typescriptVersion, '4.5.0');

        const titles = builder.title({
          outputClient: options.client,
          title: pascal(operation.operationName),
          customTitleFunc: options.override.title,
          output: options,
        });

        const footer = builder.footer({
          outputClient: options?.client,
          operationNames: [operation.operationName],
          hasMutator: !!operation.mutator,
          hasAwaitedType,
          titles,
          output: options,
        });

        const header = builder.header({
          outputClient: options.client,
          isRequestOptions: options.override.requestOptions !== false,
          isMutator,
          isGlobalMutator: !!options.override.mutator,
          provideIn: options.override.angular.provideIn,
          hasAwaitedType,
          titles,
          output: options,
          verbOptions: builder.verbOptions,
          tag: operation.tags[0],
          clientImplementation: operation.implementation,
        });

        if (!acc[operation.tags[0]]) {
          acc[operation.tags[0]] = {};
        }
        acc[operation.tags[0]][operation.operationName] = {
          implementation:
            header.implementation +
            operation.implementation +
            footer.implementation,
          implementationMock:
            operation.implementationMock.function +
            operation.implementationMock.handler +
            header.implementationMock +
            '  ' +
            operation.implementationMock.handlerName +
            '()' +
            footer.implementationMock,
          imports: operation.imports,
          importsMock: operation.importsMock,
          mutators: operation.mutator ? [operation.mutator] : [],
          clientMutators: operation.clientMutators,
          formData: operation.formData ? [operation.formData] : [],
          formUrlEncoded: operation.formUrlEncoded
            ? [operation.formUrlEncoded]
            : [],
          paramsSerializer: operation.paramsSerializer
            ? [operation.paramsSerializer]
            : [],
        };
        return acc;
      },
      {} as { [tag: string]: { [operation: string]: GeneratorTarget } },
    );
};
