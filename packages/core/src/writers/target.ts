import {
  type GeneratorTarget,
  type GeneratorTargetFull,
  type NormalizedOutputOptions,
  OutputClient,
  type WriteSpecBuilder,
} from '../types';
import { compareVersions, pascal } from '../utils';

export function generateTarget(
  builder: WriteSpecBuilder,
  options: NormalizedOutputOptions,
): GeneratorTarget {
  const operationNames = Object.values(builder.operations).map(
    ({ operationName }) => operationName,
  );
  const isAngularClient = options.client === OutputClient.ANGULAR;

  const titles = builder.title({
    outputClient: options.client,
    title: pascal(builder.info.title),
    customTitleFunc: options.override.title,
    output: options,
  });

  const target = Object.values(builder.operations).reduce<
    Required<GeneratorTargetFull>
  >(
    (acc, operation, index, arr) => {
      acc.imports.push(...operation.imports);
      acc.importsMock.push(...operation.importsMock);
      acc.implementation += operation.implementation + '\n';
      acc.implementationMock.function += operation.implementationMock.function;
      acc.implementationMock.handler += operation.implementationMock.handler;

      const handlerNameSeparator =
        acc.implementationMock.handlerName.length > 0 ? ',\n  ' : '  ';
      acc.implementationMock.handlerName +=
        handlerNameSeparator + operation.implementationMock.handlerName + '()';

      if (operation.mutator) {
        acc.mutators.push(operation.mutator);
      }

      if (operation.formData) {
        acc.formData.push(operation.formData);
      }
      if (operation.formUrlEncoded) {
        acc.formUrlEncoded.push(operation.formUrlEncoded);
      }
      if (operation.paramsSerializer) {
        acc.paramsSerializer.push(operation.paramsSerializer);
      }

      if (operation.clientMutators) {
        acc.clientMutators.push(...operation.clientMutators);
      }

      if (operation.fetchReviver) {
        acc.fetchReviver.push(operation.fetchReviver);
      }

      if (index === arr.length - 1) {
        const isMutator = acc.mutators.some((mutator) =>
          isAngularClient ? mutator.hasThirdArg : mutator.hasSecondArg,
        );

        const typescriptVersion =
          options.packageJson?.dependencies?.typescript ??
          options.packageJson?.devDependencies?.typescript ??
          '4.4.0';

        const hasAwaitedType = compareVersions(typescriptVersion, '4.5.0');

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
          clientImplementation: acc.implementation,
        });

        acc.implementation = header.implementation + acc.implementation;
        acc.implementationMock.handler =
          acc.implementationMock.handler +
          header.implementationMock +
          acc.implementationMock.handlerName;

        const footer = builder.footer({
          outputClient: options.client,
          operationNames,
          hasMutator: acc.mutators.length > 0,
          hasAwaitedType,
          titles,
          output: options,
        });
        acc.implementation += footer.implementation;
        acc.implementationMock.handler += footer.implementationMock;
      }
      return acc;
    },
    {
      imports: [],
      implementation: '',
      implementationMock: {
        function: '',
        handler: '',
        handlerName: '',
      },
      importsMock: [],
      mutators: [],
      clientMutators: [],
      formData: [],
      formUrlEncoded: [],
      paramsSerializer: [],
      fetchReviver: [],
    },
  );

  return {
    ...target,
    implementationMock:
      target.implementationMock.function + target.implementationMock.handler,
  };
}
