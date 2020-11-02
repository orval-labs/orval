import { InfoObject } from 'openapi3-ts';
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
) =>
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
          importsMocks: operation.importsMocks,
          definition: header.definition + operation.definition,
          implementation: header.implementation + operation.implementation,
          implementationMocks:
            header.implementationMock + operation.implementationMocks,
          implementationMSW:
            header.implementationMSW + operation.implementationMSW,
        },
      };
    }

    return {
      ...acc,
      [tag]: {
        definition: currentOperation.definition + operation.definition,
        implementation:
          currentOperation.implementation + operation.implementation,
        imports: [...currentOperation.imports, ...operation.imports],
        importsMocks: [
          ...currentOperation.importsMocks,
          ...operation.importsMocks,
        ],
        implementationMocks:
          currentOperation.implementationMocks + operation.implementationMocks,
        implementationMSW:
          currentOperation.implementationMSW + operation.implementationMSW,
      },
    };
  }, currentAcc);

export const generateTargetForTags = (
  operations: GeneratorOperations,
  info: InfoObject,
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
              definition: target.definition + footer.definition,
              implementation: target.implementation + footer.implementation,
              implementationMocks:
                target.implementationMocks + footer.implementationMock,
              implementationMSW:
                target.implementationMSW + footer.implementationMSW,
              imports: generalTypesFilter(target.imports),
              importsMocks: generalTypesFilter(target.importsMocks),
            },
          };
        }, {});
      }

      return targetTags;
    }, {} as { [key: string]: GeneratorTarget });
