import type {
  FinalizeMockImplementationOptions,
  GeneratorMockOutput,
  NormalizedOutputOptions,
} from '../types';

export function getFinalizeMockImplementationOptions(
  output: NormalizedOutputOptions,
  mockOutputs:
    | Pick<GeneratorMockOutput, 'strictMockSchemaTypeNames'>
    | readonly Pick<GeneratorMockOutput, 'strictMockSchemaTypeNames'>[],
): FinalizeMockImplementationOptions {
  const outputs = Array.isArray(mockOutputs) ? mockOutputs : [mockOutputs];
  const strictSchemaTypeNames = [
    ...new Set(outputs.flatMap((m) => m.strictMockSchemaTypeNames ?? [])),
  ];

  return {
    mockOptions: output.override.mock,
    strictSchemaTypeNames:
      strictSchemaTypeNames.length > 0 ? strictSchemaTypeNames : undefined,
  };
}
