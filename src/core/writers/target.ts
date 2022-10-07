import { all } from 'micromatch';
import { InfoObject } from 'openapi3-ts';
import { NormalizedOutputOptions, OutputClient } from '../../types';
import {
  GeneratorOperations,
  GeneratorTarget,
  GeneratorTargetFull,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { compareVersions } from '../../utils/compare-version';
import { rankRoute } from '../../utils/rankRoute';
import {
  generateClientFooter,
  generateClientHeader,
  generateClientTitle,
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

  const titles = generateClientTitle({
    outputClient: options.client,
    title: pascal(info.title),
    customTitleFunc: options.override.title,
  });

  // we need to sort mock handlers to be able to match the correct path
  // see: https://github.com/mswjs/msw/discussions/1426
  const sortedHandlers = Object.keys(operations)
    .map((op) => operations[op].implementationMSW.handler)
    .sort((h1, h2) => {
      const r = /rest.*\('(.*)'\,/;
      const matchH1 = h1.match(r);
      const matchH2 = h2.match(r);
      if (matchH1 && matchH2) {
        return rankRoute(matchH2[1]) - rankRoute(matchH1[1]);
      }
      return 0;
    });

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

        const typescriptVersion =
          options.packageJson?.dependencies?.['typescript'] ??
          options.packageJson?.devDependencies?.['typescript'] ??
          '4.4.0';

        const hasAwaitedType = compareVersions(typescriptVersion, '4.5.0');

        const header = generateClientHeader({
          outputClient: options.client,
          isRequestOptions: options.override.requestOptions !== false,
          isMutator,
          isGlobalMutator: !!options.override.mutator,
          provideIn: options.override.angular.provideIn,
          hasAwaitedType,
          titles,
        });

        acc.implementation = header.implementation + acc.implementation;
        acc.implementationMSW.handler = header.implementationMSW + '%HANDLERS%';

        const footer = generateClientFooter({
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
      formData: [],
      formUrlEncoded: [],
    } as Required<GeneratorTargetFull>,
  );

  const implementationMSW =
    target.implementationMSW.function +
    target.implementationMSW.handler.replace(
      '%HANDLERS%',
      sortedHandlers.join(' '),
    );

  return { ...target, implementationMSW };
};
