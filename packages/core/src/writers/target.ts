import {
  type GeneratorMockOutput,
  type GeneratorMockOutputFull,
  type GeneratorTarget,
  type GeneratorTargetFull,
  type NormalizedOutputOptions,
  OutputClient,
  type WriteSpecBuilder,
} from '../types';
import { pascal } from '../utils';
import { hasTypeScriptAwaitedType } from './typescript-version';

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
    strictMockSchemaKinds: full.strictMockSchemaKinds,
  };
}

export function generateTarget(
  builder: WriteSpecBuilder,
  options: NormalizedOutputOptions,
): GeneratorTarget {
  const operationNames = Object.values(builder.operations).map(
    ({ operationName }) => operationName,
  );
  const isAngularClient = options.client === OutputClient.ANGULAR;

  const titles = builder.title({
    outputClient: options.client,
    title: pascal(builder.info.title),
    customTitleFunc: options.override.title,
    output: options,
  });

  const target: Required<Omit<GeneratorTargetFull, 'mockOutputs'>> & {
    mockOutputs: GeneratorMockOutputFull[];
  } = {
    imports: [],
    implementation: '',
    mockOutputs: [],
    mutators: [],
    clientMutators: [],
    formData: [],
    formUrlEncoded: [],
    paramsSerializer: [],
    paramsFilter: [],
    fetchReviver: [],
    sharedTypes: [],
  };
  const operations = Object.values(builder.operations);
  for (const [index, operation] of operations.entries()) {
    target.imports.push(...operation.imports);
    target.implementation += operation.implementation + '\n';

    // Merge per-mock-type outputs from this operation into the accumulator.
    for (const opMock of operation.mockOutputs) {
      let acc = target.mockOutputs.find((m) => m.type === opMock.type);
      if (!acc) {
        acc = emptyMockOutputFull(opMock.type);
        target.mockOutputs.push(acc);
      }
      acc.imports.push(...opMock.imports);
      if (opMock.strictMockSchemaTypeNames?.length) {
        acc.strictMockSchemaTypeNames = [
          ...new Set([
            ...(acc.strictMockSchemaTypeNames ?? []),
            ...opMock.strictMockSchemaTypeNames,
          ]),
        ];
      }
      if (opMock.strictMockSchemaKinds) {
        acc.strictMockSchemaKinds = {
          ...acc.strictMockSchemaKinds,
          ...opMock.strictMockSchemaKinds,
        };
      }
      acc.implementation.function += opMock.implementation.function;
      acc.implementation.handler += opMock.implementation.handler;
      if (opMock.implementation.handlerName) {
        const separator =
          acc.implementation.handlerName.length > 0 ? ',\n  ' : '  ';
        acc.implementation.handlerName +=
          separator + opMock.implementation.handlerName + '()';
      }
    }

    if (operation.mutator) {
      target.mutators.push(operation.mutator);
    }

    if (operation.formData) {
      target.formData.push(operation.formData);
    }
    if (operation.formUrlEncoded) {
      target.formUrlEncoded.push(operation.formUrlEncoded);
    }
    if (operation.paramsSerializer) {
      target.paramsSerializer.push(operation.paramsSerializer);
    }
    if (operation.paramsFilter) {
      target.paramsFilter.push(operation.paramsFilter);
    }

    if (operation.clientMutators) {
      target.clientMutators.push(...operation.clientMutators);
    }

    if (operation.fetchReviver) {
      target.fetchReviver.push(operation.fetchReviver);
    }

    if (index === operations.length - 1) {
      const isMutator = target.mutators.some((mutator) =>
        isAngularClient ? mutator.hasThirdArg : mutator.hasSecondArg,
      );

      const hasAwaitedType = hasTypeScriptAwaitedType(options.packageJson);

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
        clientImplementation: target.implementation,
      });

      const inlinedSharedTypes =
        header.sharedTypes && header.sharedTypes.length > 0
          ? header.sharedTypes
              .map((t) => `${t.exported ? 'export ' : ''}${t.code}`)
              .join('\n') + '\n\n'
          : '';

      target.implementation =
        inlinedSharedTypes + header.implementation + target.implementation;

      const footer = builder.footer({
        outputClient: options.client,
        operationNames,
        operations,
        hasMutator: target.mutators.length > 0,
        hasAwaitedType,
        titles,
        output: options,
      });
      target.implementation += footer.implementation;

      // Append the aggregated handler array (header + footer wrap) to every
      // mock output that has at least one handler. Faker-only outputs (no
      // handlerName) do not get the wrapper.
      for (const acc of target.mockOutputs) {
        if (acc.implementation.handlerName) {
          acc.implementation.handler =
            acc.implementation.handler +
            header.implementationMock +
            acc.implementation.handlerName +
            footer.implementationMock;
        }
      }
    }
  }

  return {
    imports: target.imports,
    implementation: target.implementation,
    mockOutputs: target.mockOutputs.map((m) => flattenMockOutput(m)),
    mutators: target.mutators,
    clientMutators: target.clientMutators,
    formData: target.formData,
    formUrlEncoded: target.formUrlEncoded,
    paramsSerializer: target.paramsSerializer,
    paramsFilter: target.paramsFilter,
    fetchReviver: target.fetchReviver,
  };
}
