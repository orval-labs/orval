import { OutputOptions } from '../../types';
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
  options?: OutputOptions,
): {
  [key: string]: GeneratorTargetFull;
} =>
  operation.tags.reduce((acc, tag) => {
    const currentOperation = acc[tag];
    if (!currentOperation) {
      const header = generateClientHeader({
        outputClient: options?.client,
        hasMutator: !!operation.mutator,
        globalMutator: !!options?.override?.mutator,
        title: pascal(tag),
        customTitleFunc: options?.override?.title,
      });

      return {
        ...acc,
        [tag]: {
          imports: operation.imports,
          importsMSW: operation.importsMSW,
          mutators: operation.mutator ? [operation.mutator] : [],
          implementation: header.implementation + operation.implementation,
          implementationMSW: {
            function: operation.implementationMSW.function,
            handler:
              header.implementationMSW + operation.implementationMSW.handler,
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
      },
    };
  }, currentAcc);

export const generateTargetForTags = (
  operations: GeneratorOperations,
  options?: OutputOptions,
) => {
  const allTargetTags = Object.values(operations)
    .map(addDefaultTagIfEmpty)
    .reduce((acc, operation, index, arr) => {
      const targetTags = generateTargetTags(acc, operation, options);

      if (index === arr.length - 1) {
        const footer = generateClientFooter(options?.client);

        return Object.entries(targetTags).reduce((acc, [tag, target]) => {
          return {
            ...acc,
            [tag]: {
              implementation: target.implementation + footer.implementation,
              implementationMSW: {
                function: target.implementationMSW.function,
                handler:
                  target.implementationMSW.handler + footer.implementationMSW,
              },
              imports: target.imports,
              importsMSW: target.importsMSW,
              mutators: target.mutators,
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
