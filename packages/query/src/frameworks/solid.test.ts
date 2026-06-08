import { describe, expect, it } from 'vitest';

import { getSolidQueryDependencies } from '../dependencies';
import { createFrameworkAdapter } from '.';

describe('solid-query getQueryReturnStatement (issue #3347)', () => {
  it('attaches queryKey without mutating the Solid store', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'solid-query' });

    const statement = adapter.getQueryReturnStatement({
      hasQueryV5: true,
      hasQueryV5WithDataTagError: true,
      queryResultVarName: 'query',
      queryOptionsVarName: 'queryOptions',
    });

    // Solid query results are read-only stores. `Object.assign` hits the
    // store's `set` trap, which warns "Cannot mutate a Store directly" and
    // never actually attaches queryKey. `mergeProps` composes a new accessor
    // object via getters, leaving the store untouched. See #3347.
    expect(statement).toContain(
      'mergeProps(query, { queryKey: queryOptions.queryKey })',
    );
    expect(statement).not.toContain('Object.assign(query');
  });

  it('imports mergeProps from solid-js so the return statement resolves', () => {
    const dependencies = getSolidQueryDependencies(false, false, undefined);

    const solidJsDependency = dependencies.find(
      (dependency) => dependency.dependency === 'solid-js',
    );

    expect(solidJsDependency).toBeDefined();
    expect(solidJsDependency?.exports).toContainEqual({
      name: 'mergeProps',
      values: true,
    });
  });
});
