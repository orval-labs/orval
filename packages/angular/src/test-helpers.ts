import type { GeneratorVerbOptions } from '@orval/core';

/**
 * Builds a minimal {@link GeneratorVerbOptions.queryParams} object for use in
 * unit tests. Only the fields required by the Angular generators are populated;
 * everything else can be overridden via the `overrides` argument.
 */
export const createQueryParams = (
  overrides: Partial<NonNullable<GeneratorVerbOptions['queryParams']>> = {},
): NonNullable<GeneratorVerbOptions['queryParams']> => ({
  schema: { name: 'GetPetByIdParams', model: '', imports: [] },
  deps: [],
  isOptional: true,
  originalSchema: { type: 'object' },
  requiredNullableKeys: [],
  ...overrides,
});
