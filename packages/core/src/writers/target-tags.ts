import {
  DefaultTag,
  type GeneratorMockOutput,
  type GeneratorMockOutputFull,
  type GeneratorOperation,
  type GeneratorTarget,
  type GeneratorTargetFull,
  type NormalizedOutputOptions,
  OutputClient,
  type WriteSpecBuilder,
} from '../types';
import { compareVersions, kebab, pascal } from '../utils';

/**
 * Ensures every operation has at least one tag by falling back to the
 * {@link DefaultTag} constant for untagged operations, so the tag-routing
 * logic in {@link generateTargetTags} always has a bucket to assign the
 * operation to.
 */
function addDefaultTagIfEmpty(operation: GeneratorOperation) {
  return {
    ...operation,
    tags: operation.tags.length > 0 ? operation.tags : [DefaultTag],
  };
}

function emptyMockOutputFull(
  type: GeneratorMockOutputFull['type'],
): GeneratorMockOutputFull {
  return {
    type,
    implementation: { function: '', handler: '', handlerName: '' },
    imports: [],
  };
}

function flattenMockOutput(full: GeneratorMockOutputFull): GeneratorMockOutput {
  return {
    type: full.type,
    implementation: full.implementation.function + full.implementation.handler,
    imports: full.imports,
    strictMockSchemaTypeNames: full.strictMockSchemaTypeNames,
  };
}

function mergeOperationMockOutputs(
  accMockOutputs: GeneratorMockOutputFull[],
  opMockOutputs: GeneratorMockOutputFull[],
): GeneratorMockOutputFull[] {
  const result: GeneratorMockOutputFull[] = accMockOutputs.map((m) => ({
    type: m.type,
    implementation: { ...m.implementation },
    imports: [...m.imports],
    strictMockSchemaTypeNames: m.strictMockSchemaTypeNames
      ? [...m.strictMockSchemaTypeNames]
      : undefined,
  }));
  for (const op of opMockOutputs) {
    let acc = result.find((m) => m.type === op.type);
    if (!acc) {
      acc = emptyMockOutputFull(op.type);
      result.push(acc);
    }
    acc.imports.push(...op.imports);
    if (op.strictMockSchemaTypeNames?.length) {
      acc.strictMockSchemaTypeNames = [
        ...new Set([
          ...(acc.strictMockSchemaTypeNames ?? []),
          ...op.strictMockSchemaTypeNames,
        ]),
      ];
    }
    acc.implementation.function += op.implementation.function;
    acc.implementation.handler += op.implementation.handler;
    if (op.implementation.handlerName) {
      const separator =
        acc.implementation.handlerName.length > 0 ? ',\n  ' : '  ';
      acc.implementation.handlerName +=
        separator + op.implementation.handlerName + '()';
    }
  }
  return result;
}

function initialMockOutputsForOperation(
  op: GeneratorOperation,
): GeneratorMockOutputFull[] {
  return op.mockOutputs.map((m) => ({
    type: m.type,
    implementation: {
      function: m.implementation.function,
      handler: m.implementation.handler,
      handlerName: m.implementation.handlerName
        ? '  ' + m.implementation.handlerName + '()'
        : '',
    },
    imports: [...m.imports],
    strictMockSchemaTypeNames: m.strictMockSchemaTypeNames
      ? [...m.strictMockSchemaTypeNames]
      : undefined,
  }));
}

function generateTargetTags(
  currentAcc: Record<string, GeneratorTargetFull>,
  operation: GeneratorOperation,
): Record<string, GeneratorTargetFull> {
  const tag = kebab(operation.tags[0]);

  if (!(tag in currentAcc)) {
    currentAcc[tag] = {
      imports: operation.imports,
      mockOutputs: initialMockOutputsForOperation(operation),
      mutators: operation.mutator ? [operation.mutator] : [],
      clientMutators: operation.clientMutators ?? [],
      formData: operation.formData ? [operation.formData] : [],
      formUrlEncoded: operation.formUrlEncoded
        ? [operation.formUrlEncoded]
        : [],
      paramsSerializer: operation.paramsSerializer
        ? [operation.paramsSerializer]
        : [],
      paramsFilter: operation.paramsFilter ? [operation.paramsFilter] : [],
      fetchReviver: operation.fetchReviver ? [operation.fetchReviver] : [],
      implementation: operation.implementation,
    };

    return currentAcc;
  }

  const currentOperation = currentAcc[tag];
  currentAcc[tag] = {
    implementation: currentOperation.implementation + operation.implementation,
    imports: [...currentOperation.imports, ...operation.imports],
    mockOutputs: mergeOperationMockOutputs(
      currentOperation.mockOutputs,
      operation.mockOutputs,
    ),
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
    paramsFilter: operation.paramsFilter
      ? [...(currentOperation.paramsFilter ?? []), operation.paramsFilter]
      : currentOperation.paramsFilter,
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

  const operations = Object.values(builder.operations).map((operation) =>
    addDefaultTagIfEmpty(operation),
  );
  let allTargetTags: Record<string, GeneratorTargetFull> = {};
  for (const [index, operation] of operations.entries()) {
    allTargetTags = generateTargetTags(allTargetTags, operation);

    if (index === operations.length - 1) {
      const transformed: Record<string, GeneratorTargetFull> = {};
      for (const [tag, target] of Object.entries(allTargetTags)) {
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
          outputClient: options.client,
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
          isDefaultTagBucket:
            tag === 'default' &&
            Object.values(builder.operations).some(
              (operation) => operation.tags.length === 0,
            ),
          clientImplementation: target.implementation,
        });

        // Apply the per-tag header/footer wrap to each mock output that has
        // accumulated handler entries. Mock outputs without a handler (faker
        // only) skip the wrap.
        const wrappedMockOutputs: GeneratorMockOutputFull[] =
          target.mockOutputs.map((m) => ({
            type: m.type,
            implementation: {
              function: m.implementation.function,
              handler: m.implementation.handlerName
                ? m.implementation.handler +
                  header.implementationMock +
                  m.implementation.handlerName +
                  footer.implementationMock
                : m.implementation.handler,
              handlerName: m.implementation.handlerName,
            },
            imports: m.imports,
            strictMockSchemaTypeNames: m.strictMockSchemaTypeNames,
          }));

        transformed[tag] = {
          implementation:
            header.implementation +
            target.implementation +
            footer.implementation,
          mockOutputs: wrappedMockOutputs,
          imports: target.imports,
          mutators: target.mutators,
          clientMutators: target.clientMutators,
          formData: target.formData,
          formUrlEncoded: target.formUrlEncoded,
          paramsSerializer: target.paramsSerializer,
          paramsFilter: target.paramsFilter,
          fetchReviver: target.fetchReviver,
        };
      }
      allTargetTags = transformed;
    }
  }

  const result: Record<string, GeneratorTarget> = {};
  for (const [tag, target] of Object.entries(allTargetTags)) {
    result[tag] = {
      ...target,
      mockOutputs: target.mockOutputs.map((m) => flattenMockOutput(m)),
    };
  }
  return result;
}
