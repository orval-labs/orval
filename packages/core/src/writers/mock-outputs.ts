import {
  type GeneratorMockOutput,
  type GeneratorMockOutputFull,
  OutputMockType,
} from '../types';

/**
 * Collapses the per-generator mock outputs for "inline" writer modes
 * (`single`, `tags`) where every mock generator's content is concatenated
 * into the implementation file. The MSW generator already emits the
 * response-factory functions (`get<Op>ResponseMock`) that Faker would emit,
 * so when both generators are configured we keep MSW and drop Faker to
 * avoid duplicate function declarations and re-imported faker bindings.
 */
export function collapseInlineMockOutputs<
  T extends GeneratorMockOutput | GeneratorMockOutputFull,
>(mockOutputs: T[]): T[] {
  const hasMsw = mockOutputs.some((m) => m.type === OutputMockType.MSW);
  if (!hasMsw) return mockOutputs;
  return mockOutputs.filter((m) => m.type !== OutputMockType.FAKER);
}
