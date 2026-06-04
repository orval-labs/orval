import type {
  FinalizeMockImplementationOptions,
  GeneratorMockOutput,
  NormalizedOutputOptions,
} from '../types';

type MockOutputWithStrictNames = Pick<
  GeneratorMockOutput,
  'strictMockSchemaTypeNames'
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

  return {
    mockOptions: output.override.mock,
    strictSchemaTypeNames:
      strictSchemaTypeNames.length > 0 ? strictSchemaTypeNames : undefined,
  };
}
