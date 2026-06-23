import { describe, expect, it } from 'vitest';

import { generateQueryHeader } from '../index';
import { createFrameworkAdapter } from '.';

describe('react-query getQueryReturnStatement (issue #3573)', () => {
  it('attaches queryKey via the withQueryKey helper instead of spreading the query result', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'react-query' });

    const statement = adapter.getQueryReturnStatement({
      hasQueryV5: true,
      hasQueryV5WithDataTagError: true,
      queryResultVarName: 'query',
      queryOptionsVarName: 'queryOptions',
    });

    // Spreading the tracked query result reads every field inside the hook,
    // which subscribes the consumer to all of them. That defeats React Query
    // v5's per-property render optimization and trips
    // @tanstack/query/no-rest-destructuring. withQueryKey copies the fields as
    // lazy getters so tracking is preserved and no spread is emitted. See #3573.
    expect(statement).toContain('withQueryKey(query, queryOptions.queryKey)');
    expect(statement).not.toContain('...query');
  });

  it('respects a renamed query result variable', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'react-query' });

    const statement = adapter.getQueryReturnStatement({
      hasQueryV5: true,
      hasQueryV5WithDataTagError: true,
      queryResultVarName: '_query',
      queryOptionsVarName: 'queryOptions',
    });

    expect(statement).toContain('withQueryKey(_query, queryOptions.queryKey)');
  });
});

describe('generateQueryHeader withQueryKey emission (issue #3573)', () => {
  const baseParams = {
    title: 'test',
    isRequestOptions: true,
    isMutator: false,
    isGlobalMutator: false,
    provideIn: false as const,
    hasAwaitedType: true,
    verbOptions: {},
    output: { httpClient: 'axios' },
  };

  it('emits the helper once when the client references withQueryKey', () => {
    const rawHeader = generateQueryHeader({
      ...baseParams,
      clientImplementation:
        'return withQueryKey(query, queryOptions.queryKey);',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const header =
      typeof rawHeader === 'string' ? rawHeader : rawHeader.implementation;

    expect(header).toContain('const withQueryKey =');
    expect(header.match(/const withQueryKey =/g)).toHaveLength(1);
  });

  it('omits the helper for mutation-only output that never calls it', () => {
    const rawHeader = generateQueryHeader({
      ...baseParams,
      clientImplementation: 'return useMutation(mutationOptions);',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const header =
      typeof rawHeader === 'string' ? rawHeader : rawHeader.implementation;

    expect(header).not.toContain('const withQueryKey =');
  });

  it('lets the explicit queryKey win over a queryKey field on the result', () => {
    const rawHeader = generateQueryHeader({
      ...baseParams,
      clientImplementation:
        'return withQueryKey(query, queryOptions.queryKey);',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const header =
      typeof rawHeader === 'string' ? rawHeader : rawHeader.implementation;

    // Without this guard the loop would redefine `queryKey` as a getter onto
    // the result's own queryKey, diverging from the previous
    // `{ ...query, queryKey }` spread where the explicit key was set last and
    // always won. See #3573 review feedback.
    expect(header).toContain("if (key === 'queryKey') continue;");
  });
});
