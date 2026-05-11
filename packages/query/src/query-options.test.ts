import type { GetterParams } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createFrameworkAdapter } from './frameworks';
import { generateQueryOptions, QueryType } from './query-options';

const param = (name: string): GetterParams[number] => ({
  name,
  definition: `${name}: number`,
  implementation: `${name}: number`,
  default: undefined,
  required: true,
  imports: [],
});

describe('generateQueryOptions enabled emission (issue #3241)', () => {
  it('emits a null check for a single param so falsy values like 0 do not disable the query', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'react-query' });
    const out = generateQueryOptions({
      params: [param('petId')],
      options: undefined,
      type: QueryType.QUERY,
      adapter,
    });
    expect(out).toContain('enabled: petId !== null && petId !== undefined,');
    expect(out).not.toContain('!!');
  });

  it('combines null checks with && for multiple params', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'react-query' });
    const out = generateQueryOptions({
      params: [param('version'), param('petId')],
      options: undefined,
      type: QueryType.QUERY,
      adapter,
    });
    expect(out).toContain(
      'enabled: version !== null && version !== undefined && petId !== null && petId !== undefined,',
    );
  });

  it('wraps with computed and unref for vue-query', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'vue-query' });
    const out = generateQueryOptions({
      params: [param('petId')],
      options: undefined,
      type: QueryType.QUERY,
      adapter,
    });
    expect(out).toContain(
      'enabled: computed(() => unref(petId) !== null && unref(petId) !== undefined),',
    );
  });

  it('respects user-provided enabled option (no auto-emit)', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'react-query' });
    const out = generateQueryOptions({
      params: [param('petId')],
      options: { enabled: true },
      type: QueryType.QUERY,
      adapter,
    });
    expect(out).not.toContain('petId !== null');
  });
});
