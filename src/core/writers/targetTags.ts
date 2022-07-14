import { compare } from 'compare-versions';
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
  generateClientTitle,
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

    acc[tag] = !currentOperation
      ? {
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
        }
      : {
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
            ? [...(currentOperation.mutators ?? []), operation.mutator]
            : currentOperation.mutators,
          formData: operation.formData
            ? [...(currentOperation.formData ?? []), operation.formData]
            : currentOperation.formData,
          formUrlEncoded: operation.formUrlEncoded
            ? [
                ...(currentOperation.formUrlEncoded ?? []),
                operation.formUrlEncoded,
              ]
            : currentOperation.formUrlEncoded,
        };

    return acc;
  }, currentAcc);

export const generateTargetForTags = (
  operations: GeneratorOperations,
  options: NormalizedOutputOptions,
) => {
  const isAngularClient = options.client === OutputClient.ANGULAR;

  const allTargetTags = Object.values(operations)
    .map(addDefaultTagIfEmpty)
    .reduce((acc, operation, index, arr) => {
      const targetTags = generateTargetTags(acc, operation);

      if (index === arr.length - 1) {
        return Object.entries(targetTags).reduce<
          Record<string, GeneratorTargetFull>
        >((acc, [tag, target]) => {
          const isMutator = !!target.mutators?.some((mutator) =>
            isAngularClient ? mutator.hasThirdArg : mutator.hasSecondArg,
          );
          const operationNames = Object.values(operations)
            .filter(({ tags }) => tags.includes(tag))
            .map(({ operationName }) => operationName);

          const typescriptVersion =
            options.packageJson?.dependencies?.['typescript'] ?? '4.4.0';
          const hasAwaitedType = compare(typescriptVersion, '4.5.0', '>=');

          const titles = generateClientTitle({
            outputClient: options.client,
            title: pascal(tag),
            customTitleFunc: options.override.title,
          });

          const footer = generateClientFooter({
            outputClient: options?.client,
            operationNames,
            hasMutator: !!target.mutators?.length,
            hasAwaitedType,
            titles,
          });

          const header = generateClientHeader({
            outputClient: options.client,
            isRequestOptions: options.override.requestOptions !== false,
            isMutator,
            isGlobalMutator: !!options.override.mutator,
            provideIn: options.override.angular.provideIn,
            hasAwaitedType,
            titles,
          });

          acc[tag] = {
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
          };

          return acc;
        }, {});
      }

      return targetTags;
    }, {} as { [key: string]: GeneratorTargetFull });

  return Object.entries(allTargetTags).reduce<Record<string, GeneratorTarget>>(
    (acc, [tag, target]) => {
      acc[tag] = {
        ...target,
        implementationMSW:
          target.implementationMSW.function + target.implementationMSW.handler,
      };

      return acc;
    },
    {},
  );
};
