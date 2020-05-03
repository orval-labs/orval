import { InfoObject } from 'openapi3-ts';
import { GeneratorOperations } from '../../types/generator';
import { pascal } from '../../utils/case';
import { generalTypesFilter } from '../../utils/filters';
import { generateClientFooter, generateClientHeader } from './client';

export const generateTarget = (
  operations: GeneratorOperations,
  info: InfoObject,
) =>
  Object.values(operations).reduce(
    (acc, operation, index, arr) => {
      if (!index) {
        const header = generateClientHeader(pascal(info.title));
        acc.definition += header.definition;
        acc.implementation += header.implementation;
        acc.implementationMocks += header.implementationMock;
      }

      acc.imports = [
        ...acc.imports,
        ...operation.imports,
        ...operation.importsMocks,
      ];
      acc.definition += operation.definition;
      acc.implementation += operation.implementation;
      acc.implementationMocks += operation.implementationMocks;

      if (index === arr.length - 1) {
        const footer = generateClientFooter();
        acc.definition += footer.definition;
        acc.implementation += footer.implementation;
        acc.implementationMocks += footer.implementationMock;
        acc.imports = generalTypesFilter(acc.imports);
      }
      return acc;
    },
    {
      imports: [] as string[],
      definition: '',
      implementation: '',
      implementationMocks: '',
    },
  );
