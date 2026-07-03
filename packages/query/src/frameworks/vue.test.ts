import {
  type GetterProps,
  GetterPropType,
  OutputHttpClient,
} from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createFrameworkAdapter } from '.';

// The Vue adapter resolves reactive params differently per target: Vue Query v5
// requires Vue 3.3+, so params are typed `MaybeRefOrGetter<T>` and unwrapped
// with `toValue` (which also resolves `() => T` getters). Pre-v5 targets may run
// on older Vue, so they stay on `MaybeRef<T>`/`unref`. These are exercised
// through the adapter — the wrapper/resolver pairing is an internal detail.
const vueAdapter = (queryVersion: 4 | 5) =>
  createFrameworkAdapter({ outputClient: 'vue-query', queryVersion });

describe('vue-query reactive parameters', () => {
  const queryParam: GetterProps = [
    {
      name: 'params',
      definition: 'params: ListPetsParams',
      implementation: 'params: ListPetsParams',
      default: undefined,
      required: true,
      type: GetterPropType.QUERY_PARAM,
    },
  ];

  describe('transformProps wraps the param type', () => {
    it('uses MaybeRefOrGetter on v5', () => {
      expect(vueAdapter(5).transformProps(queryParam)[0].implementation).toBe(
        'params: MaybeRefOrGetter<ListPetsParams>',
      );
    });

    it('uses MaybeRef on pre-v5', () => {
      expect(vueAdapter(4).transformProps(queryParam)[0].implementation).toBe(
        'params: MaybeRef<ListPetsParams>',
      );
    });

    it('preserves a default value while wrapping', () => {
      const withDefault: GetterProps = [
        {
          name: 'version',
          definition: 'version: number',
          implementation: 'version: number = 1',
          default: 1,
          required: false,
          type: GetterPropType.PARAM,
        },
      ];
      expect(
        vueAdapter(5).transformProps(withDefault)[0].implementation,
      ).toMatch(/^version: MaybeRefOrGetter<number>\s*=\s*1$/);
    });
  });

  describe('getRequestUnrefStatements resolves the param', () => {
    const props: GetterProps = [
      {
        name: 'params',
        definition: 'params: ListPetsParams',
        implementation: 'params: ListPetsParams',
        default: undefined,
        required: true,
        type: GetterPropType.QUERY_PARAM,
      },
      {
        name: 'pathParams',
        definition: 'pathParams: { id: string }',
        implementation: 'pathParams: { id: string }',
        default: undefined,
        required: true,
        type: GetterPropType.NAMED_PATH_PARAMS,
        destructured: '{ id }',
        schema: { name: 'pathParams', model: '', imports: [] },
      },
    ];

    it('uses toValue on v5 (supports getters)', () => {
      expect(vueAdapter(5).getRequestUnrefStatements(props)).toBe(
        'params = toValue(params);\nconst { id } = toValue(pathParams);',
      );
    });

    it('uses unref on pre-v5', () => {
      expect(vueAdapter(4).getRequestUnrefStatements(props)).toBe(
        'params = unref(params);\nconst { id } = unref(pathParams);',
      );
    });
  });

  describe('getHttpFunctionQueryProps resolves fetch props', () => {
    it('uses toValue on v5', () => {
      expect(
        vueAdapter(5).getHttpFunctionQueryProps(
          'a,b',
          OutputHttpClient.FETCH,
          false,
        ),
      ).toBe('toValue(a),toValue(b)');
    });

    it('uses unref on pre-v5', () => {
      expect(
        vueAdapter(4).getHttpFunctionQueryProps(
          'a,b',
          OutputHttpClient.FETCH,
          false,
        ),
      ).toBe('unref(a),unref(b)');
    });
  });
});
