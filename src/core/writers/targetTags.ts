import { OutputOptions } from '../../types';
import {
  GeneratorOperation,
  GeneratorOperations,
  GeneratorTarget,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { generalTypesFilter } from '../../utils/filters';
import {
  generateClientFooter,
  generateClientHeader,
} from '../generators/client';

const addDefaultTagIfEmpty = (operation: GeneratorOperation) => ({
  ...operation,
  tags: operation.tags.length ? operation.tags : ['default'],
});

const generateTargetTags = (
  currentAcc: { [key: string]: GeneratorTarget },
  operation: GeneratorOperation,
  options?: OutputOptions,
): { [key: string]: GeneratorTarget } =>
  operation.tags.reduce((acc, tag) => {
    const currentOperation = acc[tag];
    if (!currentOperation) {
      const header = generateClientHeader(
        options?.client,
        pascal(tag),
        options?.override?.title,
      );

      return {
        ...acc,
        [tag]: {
          imports: operation.imports,
          importsMSW: operation.importsMSW,
          mutators: operation.mutator ? [operation.mutator] : [],
          implementation: header.implementation + operation.implementation,
          implementationMSW:
            header.implementationMSW + operation.implementationMSW,
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
        implementationMSW:
          currentOperation.implementationMSW + operation.implementationMSW,
        mutators: operation.mutator
          ? [...(currentOperation.mutators || []), operation.mutator]
          : currentOperation.mutators,
      },
    };
  }, currentAcc);

export const generateTargetForTags = (
  operations: GeneratorOperations,
  options?: OutputOptions,
) =>
  Object.values(operations)
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
              implementationMSW:
                target.implementationMSW + footer.implementationMSW,
              imports: generalTypesFilter(target.imports),
              importsMSW: generalTypesFilter(target.importsMSW),
              mutators: target.mutators,
            },
          };
        }, {});
      }

      return targetTags;
    }, {} as { [key: string]: GeneratorTarget });
