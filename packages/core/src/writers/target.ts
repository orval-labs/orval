import {
  GeneratorTarget,
  GeneratorTargetFull,
  NormalizedOutputOptions,
  OutputClient,
  WriteSpecsBuilder,
} from '../types';
import { compareVersions, pascal } from '../utils';

export const generateTarget = (
  builder: WriteSpecsBuilder,
  options: NormalizedOutputOptions,
): GeneratorTarget => {
  const operationNames = Object.values(builder.operations).map(
    ({ operationName }) => operationName,
  );
  const isAngularClient = options?.client === OutputClient.ANGULAR;

  const titles = builder.title({
    outputClient: options.client,
    title: pascal(builder.info.title),
    customTitleFunc: options.override.title,
  });

  const target = Object.values(builder.operations).reduce(
    (acc, operation, index, arr) => {
      acc.imports.push(...operation.imports);
      acc.importsMSW.push(...operation.importsMSW);
      acc.implementation += operation.implementation + '\n';
      acc.implementationMSW.function += operation.implementationMSW.function;
      acc.implementationMSW.handler += operation.implementationMSW.handler;
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

      if (index === arr.length - 1) {
        const isMutator = acc.mutators.some((mutator) =>
          isAngularClient ? mutator.hasThirdArg : mutator.hasSecondArg,
        );

        const typescriptVersion =
          options.packageJson?.dependencies?.['typescript'] ??
          options.packageJson?.devDependencies?.['typescript'] ??
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
        });
        acc.implementation = header.implementation + acc.implementation;
        acc.implementationMSW.handler =
          header.implementationMSW + acc.implementationMSW.handler;

        const footer = builder.footer({
          outputClient: options?.client,
          operationNames,
          hasMutator: !!acc.mutators.length,
          hasAwaitedType,
          titles,
        });
        acc.implementation += footer.implementation;
        acc.implementationMSW.handler += footer.implementationMSW;
      }
      return acc;
    },
    {
      imports: [],
      implementation: '',
      implementationMSW: {
        function: '',
        handler: '',
      },
      importsMSW: [],
      mutators: [],
      clientMutators: [],
      formData: [],
      formUrlEncoded: [],
      paramsSerializer: [],
    } as Required<GeneratorTargetFull>,
  );

  return {
    ...target,
    implementationMSW:
      target.implementationMSW.function + target.implementationMSW.handler,
  };
};
