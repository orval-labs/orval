import { InfoObject } from 'openapi3-ts';
import { OutputOptions } from '../../types';
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
  options?: OutputOptions,
): GeneratorTarget => {
  const operationNames = Object.values(operations).map(
    ({ operationName }) => operationName,
  );
  const target = Object.values(operations).reduce(
    (acc, operation, index, arr) => {
      if (!index) {
        const header = generateClientHeader({
          outputClient: options?.client,
          isRequestOptions: options?.override?.requestOptions !== false,
          isMutator: !!operation.mutator,
          isGlobalMutator: !!options?.override?.mutator,
          title: pascal(info.title),
          customTitleFunc: options?.override?.title,
        });
        acc.implementation += header.implementation;
        acc.implementationMSW.handler += header.implementationMSW;
      }
      acc.imports = [...acc.imports, ...operation.imports];
      acc.importsMSW = [...acc.importsMSW, ...operation.importsMSW];
      acc.implementation += operation.implementation;
      acc.implementationMSW.function += operation.implementationMSW.function;
      acc.implementationMSW.handler += operation.implementationMSW.handler;
      if (operation.mutator) {
        acc.mutators = [...acc.mutators, operation.mutator];
      }

      if (index === arr.length - 1) {
        const footer = generateClientFooter(options?.client, operationNames);
        acc.implementation += footer.implementation;
        acc.implementationMSW.handler += footer.implementationMSW;
        acc.imports = acc.imports;
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
    },
  );

  return {
    ...target,
    implementationMSW:
      target.implementationMSW.function + target.implementationMSW.handler,
  };
};
