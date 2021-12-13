import { NormalizedOutputOptions, OutputClient } from '../../types';
import {
  GeneratorOperation,
  GeneratorOperations,
  GeneratorTarget,
  GeneratorTargetFull,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import {
  generateClientFooter,
  generateClientHeader,
} from '../generators/client';

const addDefaultTagIfEmpty = (operation: GeneratorOperation) => ({
  ...operation,
  tags: operation.tags.length ? operation.tags : ['default'],
});

const generateTargetTags = (
  currentAcc: { [key: string]: GeneratorTargetFull },
  operation: GeneratorOperation,
): {
  [key: string]: GeneratorTargetFull;
} =>
  operation.tags.reduce((acc, tag) => {
    const currentOperation = acc[tag];
    if (!currentOperation) {
      return {
        ...acc,
        [tag]: {
          imports: operation.imports,
          importsMSW: operation.importsMSW,
          mutators: operation.mutator ? [operation.mutator] : [],
          formData: operation.formData ? [operation.formData] : [],
          formUrlEncoded: operation.formUrlEncoded
            ? [operation.formUrlEncoded]
            : [],
          implementation: operation.implementation,
          implementationMSW: {
            function: operation.implementationMSW.function,
            handler: operation.implementationMSW.handler,
          },
        },
      };
    }

    return {
      ...acc,
      [tag]: {
        implementation:
          currentOperation.implementation + operation.implementation,
        imports: [...currentOperation.imports, ...operation.imports],
        importsMSW: [...currentOperation.importsMSW, ...operation.importsMSW],
        implementationMSW: {
          function:
            currentOperation.implementationMSW.function +
            operation.implementationMSW.function,
          handler:
            currentOperation.implementationMSW.handler +
            operation.implementationMSW.handler,
        },
        mutators: operation.mutator
          ? [...(currentOperation.mutators || []), operation.mutator]
          : currentOperation.mutators,
        formData: operation.formData
          ? [...(currentOperation.formData || []), operation.formData]
          : currentOperation.formData,
        formUrlEncoded: operation.formUrlEncoded
          ? [
              ...(currentOperation.formUrlEncoded || []),
              operation.formUrlEncoded,
            ]
          : currentOperation.formUrlEncoded,
      },
    };
  }, currentAcc);

export const generateTargetForTags = (
  operations: GeneratorOperations,
  options: NormalizedOutputOptions,
) => {
  const operationNames = Object.values(operations).map(
    ({ operationName }) => operationName,
  );
  const isAngularClient = options.client === OutputClient.ANGULAR;

  const allTargetTags = Object.values(operations)
    .map(addDefaultTagIfEmpty)
    .reduce((acc, operation, index, arr) => {
      const targetTags = generateTargetTags(acc, operation);

      if (index === arr.length - 1) {
        const footer = generateClientFooter(options?.client, operationNames);

        return Object.entries(targetTags).reduce((acc, [tag, target]) => {
          const isMutator = !!target.mutators?.some(
            (mutator) => mutator.mutatorFn.length > (isAngularClient ? 2 : 1),
          );
          const header = generateClientHeader({
            outputClient: options.client,
            isRequestOptions: options.override.requestOptions !== false,
            isMutator,
            isGlobalMutator: !!options.override.mutator,
            title: pascal(tag),
            customTitleFunc: options.override.title,
            provideInRoot: !!options.override.angular.provideIn,
            provideIn: options.override.angular.provideIn,
          });
          return {
            ...acc,
            [tag]: {
              implementation:
                header.implementation +
                target.implementation +
                footer.implementation,
              implementationMSW: {
                function: target.implementationMSW.function,
                handler:
                  header.implementationMSW +
                  target.implementationMSW.handler +
                  footer.implementationMSW,
              },
              imports: target.imports,
              importsMSW: target.importsMSW,
              mutators: target.mutators,
              formData: target.formData,
              formUrlEncoded: target.formUrlEncoded,
            },
          };
        }, {});
      }

      return targetTags;
    }, {} as { [key: string]: GeneratorTargetFull });

  return Object.entries(allTargetTags).reduce((acc, [tag, target]) => {
    return {
      ...acc,
      [tag]: {
        ...target,
        implementationMSW:
          target.implementationMSW.function + target.implementationMSW.handler,
      },
    };
  }, {} as { [key: string]: GeneratorTarget });
};
