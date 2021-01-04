import { InfoObject } from 'openapi3-ts';
import { OutputOptions } from '../../types';
import { GeneratorMutator, GeneratorOperations } from '../../types/generator';
import { pascal } from '../../utils/case';
import { generalTypesFilter } from '../../utils/filters';
import {
  generateClientFooter,
  generateClientHeader,
} from '../generators/client';

export const generateTarget = (
  operations: GeneratorOperations,
  info: InfoObject,
  options?: OutputOptions,
) =>
  Object.values(operations).reduce(
    (acc, operation, index, arr) => {
      if (!index) {
        const header = generateClientHeader(
          options?.client,
          pascal(info.title),
          options?.override?.title,
        );
        acc.implementation += header.implementation;
        acc.implementationMSW += header.implementationMSW;
      }
      acc.imports = [...acc.imports, ...operation.imports];
      acc.importsMSW = [...acc.importsMSW, ...operation.importsMSW];
      acc.implementation += operation.implementation;
      acc.implementationMSW += operation.implementationMSW;
      if (operation.mutator) {
        acc.mutators = [...acc.mutators, operation.mutator];
      }

      if (index === arr.length - 1) {
        const footer = generateClientFooter(options?.client);
        acc.implementation += footer.implementation;
        acc.implementationMSW += footer.implementationMSW;
        acc.imports = generalTypesFilter(acc.imports);
      }
      return acc;
    },
    {
      imports: [] as string[],
      implementation: '',
      implementationMSW: '',
      importsMSW: [] as string[],
      mutators: [] as GeneratorMutator[],
    },
  );
