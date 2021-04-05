import { InfoObject } from 'openapi3-ts';
import { OutputOptions } from '../../types';
import {
  GeneratorImport,
  GeneratorMutator,
  GeneratorOperations,
} from '../../types/generator';
import { pascal } from '../../utils/case';
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
        acc.imports = acc.imports;
      }
      return acc;
    },
    {
      imports: [] as GeneratorImport[],
      implementation: '',
      implementationMSW: '',
      importsMSW: [] as GeneratorImport[],
      mutators: [] as GeneratorMutator[],
    },
  );
