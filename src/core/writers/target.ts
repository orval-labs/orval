import { InfoObject } from 'openapi3-ts';
import { NormalizedOutputOptions, OutputClient } from '../../types';
import {
  GeneratorImport,
  GeneratorMutator,
  GeneratorOperations,
  GeneratorTarget,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import {
  generateClientFooter,
  generateClientHeader,
} from '../generators/client';

export const generateTarget = (
  operations: GeneratorOperations,
  info: InfoObject,
  options: NormalizedOutputOptions,
): GeneratorTarget => {
  const operationNames = Object.values(operations).map(
    ({ operationName }) => operationName,
  );
  const isAngularClient = options?.client === OutputClient.ANGULAR;

  const target = Object.values(operations).reduce(
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

      if (index === arr.length - 1) {
        const isMutator = acc.mutators.some((mutator) =>
          isAngularClient ? mutator.hasThirdArg : mutator.hasSecondArg,
        );
        const header = generateClientHeader({
          outputClient: options.client,
          isRequestOptions: options.override.requestOptions !== false,
          isMutator,
          isGlobalMutator: !!options.override.mutator,
          title: pascal(info.title),
          customTitleFunc: options.override.title,
          provideInRoot: !!options.override.angular.provideIn,
          provideIn: options.override.angular.provideIn,
        });
        acc.implementation = header.implementation + acc.implementation;
        acc.implementationMSW.handler =
          header.implementationMSW + acc.implementationMSW.handler;

        const footer = generateClientFooter({
          outputClient: options?.client,
          operationNames,
          title: pascal(info.title),
          customTitleFunc: options.override.title,
        });
        acc.implementation += footer.implementation;
        acc.implementationMSW.handler += footer.implementationMSW;
      }
      return acc;
    },
    {
      imports: [] as GeneratorImport[],
      implementation: '',
      implementationMSW: {
        function: '',
        handler: '',
      },
      importsMSW: [] as GeneratorImport[],
      mutators: [] as GeneratorMutator[],
      formData: [] as GeneratorMutator[],
      formUrlEncoded: [] as GeneratorMutator[],
    },
  );

  return {
    ...target,
    implementationMSW:
      target.implementationMSW.function + target.implementationMSW.handler,
  };
};
