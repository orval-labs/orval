import { describe, expect, it } from 'vitest';

import { normalizeQueryOptions } from './utils';

describe('normalizeQueryOptions', () => {
  it('should include useOperationIdAsQueryKey when provided', () => {
    const result = normalizeQueryOptions(
      { useOperationIdAsQueryKey: true },
      '/workspace',
    );
    expect(result.useOperationIdAsQueryKey).toBe(true);
  });

  it('should not include useOperationIdAsQueryKey when false', () => {
    const result = normalizeQueryOptions(
      { useOperationIdAsQueryKey: false },
      '/workspace',
    );
    expect(result.useOperationIdAsQueryKey).toBeUndefined();
  });

  it('should not include useOperationIdAsQueryKey when not provided', () => {
    const result = normalizeQueryOptions({}, '/workspace');
    expect(result.useOperationIdAsQueryKey).toBeUndefined();
  });
});
