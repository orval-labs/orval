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

  const target: Required<GeneratorTargetFull> = {
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
  };
  const operations = Object.values(builder.operations);
  for (const [index, operation] of operations.entries()) {
    target.imports.push(...operation.imports);
    target.importsMock.push(...operation.importsMock);
    target.implementation += operation.implementation + '\n';
    target.implementationMock.function += operation.implementationMock.function;
    target.implementationMock.handler += operation.implementationMock.handler;

    const handlerNameSeparator =
      target.implementationMock.handlerName.length > 0 ? ',\n  ' : '  ';
    target.implementationMock.handlerName +=
      handlerNameSeparator + operation.implementationMock.handlerName + '()';

    if (operation.mutator) {
      target.mutators.push(operation.mutator);
    }

    if (operation.formData) {
      target.formData.push(operation.formData);
    }
    if (operation.formUrlEncoded) {
      target.formUrlEncoded.push(operation.formUrlEncoded);
    }
    if (operation.paramsSerializer) {
      target.paramsSerializer.push(operation.paramsSerializer);
    }

    if (operation.clientMutators) {
      target.clientMutators.push(...operation.clientMutators);
    }

    if (operation.fetchReviver) {
      target.fetchReviver.push(operation.fetchReviver);
    }

    if (index === operations.length - 1) {
      const isMutator = target.mutators.some((mutator) =>
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
        clientImplementation: target.implementation,
      });

      target.implementation = header.implementation + target.implementation;
      target.implementationMock.handler =
        target.implementationMock.handler +
        header.implementationMock +
        target.implementationMock.handlerName;

      const footer = builder.footer({
        outputClient: options.client,
        operationNames,
        hasMutator: target.mutators.length > 0,
        hasAwaitedType,
        titles,
        output: options,
      });
      target.implementation += footer.implementation;
      target.implementationMock.handler += footer.implementationMock;
    }
  }

  return {
    ...target,
    implementationMock:
      target.implementationMock.function + target.implementationMock.handler,
  };
}
