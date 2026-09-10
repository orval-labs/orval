import { describe, expect, it } from 'vite-plus/test';

import { GetterPropType } from '@orval/core';

import {
  createGenerateInvalidateCalls,
  getMutationOptionsPathParamNames,
  getMutationOptionsUrl,
} from './mutation-generator';

describe('getMutationOptionsUrl', () => {
  it('keeps static routes unchanged', () => {
    expect(getMutationOptionsUrl('/pets', [])).toBe('/pets');
  });

  it('converts path params to route-pattern placeholders', () => {
    expect(getMutationOptionsUrl('/pets/${petId}', ['petId'])).toBe(
      '/pets/{petId}',
    );
  });

  it('converts embedded path params without referencing scoped variables', () => {
    expect(
      getMutationOptionsUrl('/api/v${version}/entity/${entityId}', [
        'version',
        'entityId',
      ]),
    ).toBe('/api/v{version}/entity/{entityId}');
  });

  it('keeps runtime baseUrl expressions intact', () => {
    expect(
      getMutationOptionsUrl('${getBaseUrl()}/api/v${version}', ['version']),
    ).toBe('${getBaseUrl()}/api/v{version}');
  });

  it('only converts path params in the route suffix when a path route is provided', () => {
    expect(
      getMutationOptionsUrl(
        '${version}/api/v${version}/entity/${entityId}',
        ['version', 'entityId'],
        '/api/v${version}/entity/${entityId}',
      ),
    ).toBe('${version}/api/v{version}/entity/{entityId}');
  });

  it('handles base URLs that remove the path route leading slash', () => {
    expect(
      getMutationOptionsUrl(
        '${getBaseUrl()}api/v${version}/entity/${entityId}',
        ['version', 'entityId'],
        '/api/v${version}/entity/${entityId}',
      ),
    ).toBe('${getBaseUrl()}api/v{version}/entity/{entityId}');
  });

  it('keeps non-path template expressions intact', () => {
    expect(
      getMutationOptionsUrl('/api/${tenant}/entity/${entityId}', ['entityId']),
    ).toBe('/api/${tenant}/entity/{entityId}');
  });
});

describe('getMutationOptionsPathParamNames', () => {
  it('extracts names from destructured named path params', () => {
    expect(
      getMutationOptionsPathParamNames([
        {
          type: GetterPropType.PARAM,
          name: 'petId',
          definition: 'petId: string',
          implementation: 'petId',
          default: undefined,
          required: true,
        },
        {
          type: GetterPropType.NAMED_PATH_PARAMS,
          name: 'params',
          definition: 'params: PathParams',
          implementation:
            '{ version = 1, entityId: entity, ...rest, tenantId }',
          default: false,
          required: true,
          destructured: '{ version = 1, entityId: entity, ...rest, tenantId }',
          schema: {
            name: 'PathParams',
            model: '',
            imports: [],
          },
        },
      ]),
    ).toEqual(['petId', 'version', 'entityId', 'tenantId']);
  });
});

describe('createGenerateInvalidateCalls', () => {
  // No spec, so every target falls through to the zero-arg query key call.
  const generate = createGenerateInvalidateCalls(
    undefined,
    true,
    false,
    undefined,
    undefined,
  );

  it('emits a plain query key for a single target', () => {
    expect(
      generate([{ query: 'listPets', invalidateMode: 'invalidate' }]),
    ).toBe(
      '    queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });',
    );
  });

  it('folds several targets into one call so they cannot cancel each other', () => {
    // Keys are derived from the URL path, so targets routinely overlap
    // (`/pets` partially matches `/pets/{petId}`). One `invalidateQueries` per
    // target would abort the refetch the previous one just started, because
    // `cancelRefetch` defaults to true.
    expect(
      generate([
        { query: 'listPets', invalidateMode: 'invalidate' },
        { query: 'showPetById', invalidateMode: 'invalidate' },
      ]),
    ).toBe(
      '    queryClient.invalidateQueries({ predicate: (query) => [getListPetsQueryKey(), getShowPetByIdQueryKey()].some((queryKey) => matchQuery({ queryKey }, query)) });',
    );
  });

  it('keeps reset targets in their own call', () => {
    expect(
      generate([
        { query: 'listPets', invalidateMode: 'invalidate' },
        { query: 'showPetById', invalidateMode: 'invalidate' },
        { query: 'petStats', invalidateMode: 'reset' },
      ]),
    ).toBe(
      [
        '    queryClient.invalidateQueries({ predicate: (query) => [getListPetsQueryKey(), getShowPetByIdQueryKey()].some((queryKey) => matchQuery({ queryKey }, query)) });',
        '    queryClient.resetQueries({ queryKey: getPetStatsQueryKey() });',
      ].join('\n'),
    );
  });
});

describe('createGenerateInvalidateCalls — GHSA-5g7p-r63h-5vfw: broad-invalidation predicate injection', () => {
  // The route prefix reaches the predicate as `getRoute` output, which is
  // escaped for a backtick context and so leaves `'` alone. Emitting it into a
  // single-quoted `startsWith(...)` literal without escaping let a spec path
  // close the literal and splice the rest of the path in as live code that
  // runs in the consumer app every time the invalidation predicate is
  // evaluated.
  const injectedPath = "/pets'+(globalThis.__pwned=1)+'/{id}";

  const specWith = (route: string) => ({
    paths: {
      [route]: {
        get: {
          operationId: 'showPetById',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
        },
      },
    },
  });

  const target = [
    { query: 'showPetById', invalidateMode: 'invalidate' as const },
  ];

  // The emitted predicate body, so it can be evaluated in isolation.
  const predicateOf = (statement: string) => {
    const match = /predicate: \(query\) => \((.*)\)\s*\}\);$/.exec(statement);
    expect(match, `no predicate in: ${statement}`).not.toBeNull();
    return match![1];
  };

  it('escapes the quote instead of emitting the payload as code', () => {
    const statement = createGenerateInvalidateCalls(
      specWith(injectedPath),
      false,
      false,
      undefined,
      undefined,
    )(target);

    expect(statement).toContain(
      String.raw`startsWith('/pets\'+(globalThis.__pwned=1)+\'/')`,
    );

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const predicate = new Function(
      'query',
      `return ${predicateOf(statement)}`,
    ) as (query: { queryKey: unknown[] }) => boolean;

    predicate({ queryKey: ["/pets'+(globalThis.__pwned=1)+'/123"] });
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it('still matches the real route the query key is built from', () => {
    const statement = createGenerateInvalidateCalls(
      specWith(injectedPath),
      false,
      false,
      undefined,
      undefined,
    )(target);

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const predicate = new Function(
      'query',
      `return ${predicateOf(statement)}`,
    ) as (query: { queryKey: unknown[] }) => boolean;

    // Escaping must round-trip: the predicate still recognizes a cache key
    // built from the same (weird but legal) spec path.
    expect(
      predicate({ queryKey: ["/pets'+(globalThis.__pwned=1)+'/123"] }),
    ).toBe(true);
    expect(predicate({ queryKey: ['/other/123'] })).toBe(false);
  });

  it('escapes the quote with a static baseUrl too', () => {
    const statement = createGenerateInvalidateCalls(
      specWith(injectedPath),
      false,
      false,
      'http://localhost:8000',
      undefined,
    )(target);

    expect(statement).toContain(
      String.raw`startsWith('http://localhost:8000/pets\'+(globalThis.__pwned=1)+\'/')`,
    );
  });

  it('keeps the runtime-baseUrl template-literal branch interpolating only the baseUrl', () => {
    const statement = createGenerateInvalidateCalls(
      specWith(injectedPath),
      false,
      false,
      { runtime: 'getBaseUrl()' },
      undefined,
    )(target);

    // Backtick branch: `'` is inert there, and jsesc already neutralized any
    // backtick/`${` in the spec text, so the only interpolation is ours.
    expect(statement).toContain(
      "startsWith(`${getBaseUrl()}/pets'+(globalThis.__pwned=1)+'/`)",
    );
    expect(statement).not.toContain('${globalThis');
  });

  it('escapes the quote in split-query-key segments', () => {
    const statement = createGenerateInvalidateCalls(
      specWith(injectedPath),
      true,
      false,
      undefined,
      undefined,
    )(target);

    expect(statement).toContain(
      String.raw`queryKey: ['pets\'+(globalThis.__pwned=1)+\'']`,
    );
  });

  it('escapes the quote in the verb-prefixed predicate', () => {
    const statement = createGenerateInvalidateCalls(
      {
        paths: {
          [injectedPath]: {
            delete: {
              operationId: 'showPetById',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                },
              ],
            },
          },
        },
      },
      false,
      false,
      undefined,
      undefined,
    )(target);

    expect(statement).toContain("query.queryKey[0] === 'DELETE'");
    expect(statement).toContain(
      String.raw`startsWith('/pets\'+(globalThis.__pwned=1)+\'/')`,
    );
  });
});
