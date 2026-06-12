import type {
  FinalizeMockImplementationOptions,
  GeneratorMockOutput,
  NormalizedOutputOptions,
  StrictMockSchemaKind,
} from '../types';

type MockOutputWithStrictNames = Pick<
  GeneratorMockOutput,
  'strictMockSchemaTypeNames' | 'strictMockSchemaKinds'
>;

export function getFinalizeMockImplementationOptions(
  output: NormalizedOutputOptions,
  mockOutputs: MockOutputWithStrictNames | readonly MockOutputWithStrictNames[],
): FinalizeMockImplementationOptions {
  const outputs: readonly MockOutputWithStrictNames[] = Array.isArray(
    mockOutputs,
  )
    ? mockOutputs
    : [mockOutputs];
  const strictSchemaTypeNames = [
    ...new Set(
      outputs.flatMap(
        (mockOutput) => mockOutput.strictMockSchemaTypeNames ?? [],
      ),
    ),
  ];
  const strictMockSchemaKinds = outputs.reduce<
    Record<string, StrictMockSchemaKind>
  >((acc, mockOutput) => {
    if (!mockOutput.strictMockSchemaKinds) {
      return acc;
    }
    for (const [name, kind] of Object.entries(
      mockOutput.strictMockSchemaKinds,
    )) {
      acc[name] ??= kind;
    }
    return acc;
  }, {});

  return {
    mockOptions: output.override.mock,
    strictSchemaTypeNames:
      strictSchemaTypeNames.length > 0 ? strictSchemaTypeNames : undefined,
    strictMockSchemaKinds:
      Object.keys(strictMockSchemaKinds).length > 0
        ? strictMockSchemaKinds
        : undefined,
  };
}
