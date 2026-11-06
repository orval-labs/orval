import { type GetterProps, GetterPropType } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createFrameworkAdapter } from '.';
import { getSolidQueryDependencies } from '../dependencies';

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
    // `queryKey` is a getter over the options thunk so it follows accessor
    // parameters (#3195).
    expect(statement).toContain(
      'mergeProps(query, { get queryKey() { return queryOptions().queryKey; } })',
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

// Hooks take `MaybeAccessor<T>` for every parameter so a signal re-runs the
// query (#3195). Only the hook is widened; the key and options factories keep
// plain parameters.
describe('solid-query accessor parameters (issue #3195)', () => {
  const adapter = createFrameworkAdapter({ outputClient: 'solid-query' });

  const param = (
    name: string,
    implementation: string,
    definition = implementation,
  ): GetterProps[number] => ({
    type: GetterPropType.PARAM,
    name,
    definition,
    implementation,
    default: undefined,
    required: true,
  });

  it('wraps each parameter type and keeps defaults outside the wrapper', () => {
    expect(
      adapter.getHookPropsDefinitions([
        param('petId', 'petId: string'),
        param('version', 'version: number = 1', 'version?: number'),
        param('params', 'params?: ListPetsParams'),
      ]),
    ).toBe(
      'petId: MaybeAccessor<string>,\n    version: MaybeAccessor<number> = 1,\n    params?: MaybeAccessor<ListPetsParams>,',
    );
  });

  it('uses the definition for overload signatures', () => {
    expect(
      adapter.getHookPropsDefinitions(
        [param('version', 'version: number = 1', 'version?: number')],
        'definition',
      ),
    ).toBe('version?: MaybeAccessor<number>,');
  });

  // `MaybeAccessor<undefined | T>` would admit an accessor returning
  // `undefined`, which `MaybeAccessor<T> = 1` does not (TS2394).
  it('keeps a widened undefined outside the wrapper', () => {
    expect(
      adapter.getHookPropsDefinitions(
        [
          param(
            'version',
            'version: number = 1',
            'version: undefined | number',
          ),
        ],
        'definition',
      ),
    ).toBe('version: MaybeAccessor<number> | undefined,');
  });

  it('does not treat an arrow in the type as a default value', () => {
    expect(
      adapter.getHookPropsDefinitions([param('cb', 'cb: () => void')]),
    ).toBe('cb: MaybeAccessor<() => void>,');
  });

  it('takes named path params as one un-destructured object', () => {
    const named = (implementation: string): GetterProps[number] => ({
      type: GetterPropType.NAMED_PATH_PARAMS,
      name: 'pathParams',
      definition: 'pathParams: ListPetsPathParameters',
      implementation,
      default: undefined,
      required: true,
      destructured: '{ version }',
      schema: { name: 'ListPetsPathParameters', model: '', imports: [] },
    });

    expect(
      adapter.getHookPropsDefinitions([
        named('{ version, petId }: ListPetsPathParameters'),
      ]),
    ).toBe('pathParams: MaybeAccessor<ListPetsPathParameters>,');
    // Every path param has a default, so the object itself defaults to `{}`.
    expect(
      adapter.getHookPropsDefinitions([
        named('{ version = 1 }: ListPetsPathParameters = {}'),
      ]),
    ).toBe('pathParams: MaybeAccessor<ListPetsPathParameters> = {},');
  });

  it('resolves every accessor inside one options thunk', () => {
    expect(
      adapter.generateQueryInit({
        props: [param('petId', 'petId: string')],
        queryOptionsFnName: 'getShowPetByIdQueryOptions',
        queryOptionsVarName: 'queryOptions',
        queryProperties: 'petId',
        isRequestOptions: true,
      }),
    ).toBe(
      'const queryOptions = () => getShowPetByIdQueryOptions(resolveAccessor(petId), resolveAccessor(options));',
    );
  });

  it('wraps the hook options type', () => {
    expect(adapter.wrapHookQueryOptionsType?.('{ fetch?: RequestInit }')).toBe(
      'MaybeAccessor<{ fetch?: RequestInit }>',
    );
  });
});
