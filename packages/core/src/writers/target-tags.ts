import {
  type GeneratorOperation,
  type GeneratorTarget,
  type GeneratorTargetFull,
  type NormalizedOutputOptions,
  OutputClient,
  type WriteSpecBuilder,
} from '../types';
import { compareVersions, kebab, pascal } from '../utils';

function addDefaultTagIfEmpty(operation: GeneratorOperation) {
  return {
    ...operation,
    tags: operation.tags.length > 0 ? operation.tags : ['default'],
  };
}

function generateTargetTags(
  currentAcc: Record<string, GeneratorTargetFull>,
  operation: GeneratorOperation,
): Record<string, GeneratorTargetFull> {
  const tag = kebab(operation.tags[0]);
  const currentOperation = currentAcc[tag];

  if (!currentOperation) {
    currentAcc[tag] = {
      imports: operation.imports,
      importsMock: operation.importsMock,
      mutators: operation.mutator ? [operation.mutator] : [],
      clientMutators: operation.clientMutators ?? [],
      formData: operation.formData ? [operation.formData] : [],
      formUrlEncoded: operation.formUrlEncoded
        ? [operation.formUrlEncoded]
        : [],
      paramsSerializer: operation.paramsSerializer
        ? [operation.paramsSerializer]
        : [],
      fetchReviver: operation.fetchReviver ? [operation.fetchReviver] : [],
      implementation: operation.implementation,
      implementationMock: {
        function: operation.implementationMock.function,
        handler: operation.implementationMock.handler,
        handlerName: '  ' + operation.implementationMock.handlerName + '()',
      },
    };

    return currentAcc;
  }

  currentAcc[tag] = {
    implementation: currentOperation.implementation + operation.implementation,
    imports: [...currentOperation.imports, ...operation.imports],
    importsMock: [...currentOperation.importsMock, ...operation.importsMock],
    implementationMock: {
      function:
        currentOperation.implementationMock.function +
        operation.implementationMock.function,
      handler:
        currentOperation.implementationMock.handler +
        operation.implementationMock.handler,
      handlerName:
        currentOperation.implementationMock.handlerName +
        ',\n  ' +
        operation.implementationMock.handlerName +
        '()',
    },
    mutators: operation.mutator
      ? [...(currentOperation.mutators ?? []), operation.mutator]
      : currentOperation.mutators,
    clientMutators: operation.clientMutators
      ? [
          ...(currentOperation.clientMutators ?? []),
          ...operation.clientMutators,
        ]
      : currentOperation.clientMutators,
    formData: operation.formData
      ? [...(currentOperation.formData ?? []), operation.formData]
      : currentOperation.formData,
    formUrlEncoded: operation.formUrlEncoded
      ? [...(currentOperation.formUrlEncoded ?? []), operation.formUrlEncoded]
      : currentOperation.formUrlEncoded,
    paramsSerializer: operation.paramsSerializer
      ? [
          ...(currentOperation.paramsSerializer ?? []),
          operation.paramsSerializer,
        ]
      : currentOperation.paramsSerializer,
    fetchReviver: operation.fetchReviver
      ? [...(currentOperation.fetchReviver ?? []), operation.fetchReviver]
      : currentOperation.fetchReviver,
  };
  return currentAcc;
}

export function generateTargetForTags(
  builder: WriteSpecBuilder,
  options: NormalizedOutputOptions,
) {
  const isAngularClient = options.client === OutputClient.ANGULAR;

  const allTargetTags = Object.values(builder.operations)
    .map((operation) => addDefaultTagIfEmpty(operation))
    .reduce<Record<string, GeneratorTargetFull>>(
      (acc, operation, index, arr) => {
        const targetTags = generateTargetTags(acc, operation);

        if (index === arr.length - 1) {
          return Object.entries(targetTags).reduce<
            Record<string, GeneratorTargetFull>
          >((acc, [tag, target]) => {
            const isMutator = !!target.mutators?.some((mutator) =>
              isAngularClient ? mutator.hasThirdArg : mutator.hasSecondArg,
            );
            const operationNames = Object.values(builder.operations)
              // Operations can have multiple tags, but they are grouped by the first
              // tag, therefore we only want to handle the case where the tag
              // is the first in the list of tags.
              .filter(
                ({ tags }) =>
                  tags.map((tag) => kebab(tag)).indexOf(kebab(tag)) === 0,
              )
              .map(({ operationName }) => operationName);

            const typescriptVersion =
              options.packageJson?.dependencies?.typescript ??
              options.packageJson?.devDependencies?.typescript ??
              '4.4.0';

            const hasAwaitedType = compareVersions(typescriptVersion, '4.5.0');

            const titles = builder.title({
              outputClient: options.client,
              title: pascal(tag),
              customTitleFunc: options.override.title,
              output: options,
            });

            const footer = builder.footer({
              outputClient: options?.client,
              operationNames,
              hasMutator: !!target.mutators?.length,
              hasAwaitedType,
              titles,
              output: options,
            });

            const header = builder.header({
              outputClient: options.client,
              isRequestOptions: options.override.requestOptions !== false,
              isMutator,
              isGlobalMutator: !!options.override.mutator,
              provideIn: options.override.angular.provideIn,
              hasAwaitedType,
              titles,
              output: options,
              verbOptions: builder.verbOptions,
              tag,
              clientImplementation: target.implementation,
            });

            acc[tag] = {
              implementation:
                header.implementation +
                target.implementation +
                footer.implementation,
              implementationMock: {
                function: target.implementationMock.function,
                handler:
                  target.implementationMock.handler +
                  header.implementationMock +
                  target.implementationMock.handlerName +
                  footer.implementationMock,
                handlerName: target.implementationMock.handlerName,
              },
              imports: target.imports,
              importsMock: target.importsMock,
              mutators: target.mutators,
              clientMutators: target.clientMutators,
              formData: target.formData,
              formUrlEncoded: target.formUrlEncoded,
              paramsSerializer: target.paramsSerializer,
              fetchReviver: target.fetchReviver,
            };

            return acc;
          }, {});
        }

        return targetTags;
      },
      {},
    );

  return Object.entries(allTargetTags).reduce<Record<string, GeneratorTarget>>(
    (acc, [tag, target]) => {
      acc[tag] = {
        ...target,
        implementationMock:
          target.implementationMock.function +
          target.implementationMock.handler,
      };

      return acc;
    },
    {},
  );
}
