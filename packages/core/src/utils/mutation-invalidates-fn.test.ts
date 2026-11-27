import { describe, expect, it, vi } from 'vite-plus/test';

import {
  type MutationInvalidatesConfig,
  type MutationInvalidatesContext,
  OutputMode,
  Verbs,
} from '../types';
import {
  combineMutationInvalidates,
  createMutationInvalidatesFileFiller,
  createMutationInvalidatesResolver,
  getMutationInvalidatesContext,
  getMutationInvalidatesRules,
  resolveMutationInvalidates,
} from './mutation-invalidates';

const verb = (
  operationName: string,
  verbName: Verbs,
  pathRoute: string,
  tags: string[],
) => ({
  operationId: operationName.replace(/^./, (c) => c.toUpperCase()),
  operationName,
  verb: verbName,
  pathRoute,
  tags,
  params: [...pathRoute.matchAll(/{(\w+)}/g)].map(([, name]) => ({ name })),
});

const verbs = [
  verb('listPets', Verbs.GET, '/pets', ['pets']),
  verb('createPets', Verbs.POST, '/pets', ['pets']),
  verb('showPetById', Verbs.GET, '/pets/{petId}', ['pets']),
  verb('deletePet', Verbs.DELETE, '/pets/{petId}', ['pets']),
  verb('healthCheck', Verbs.GET, '/health', ['health']),
  verb('ping', Verbs.POST, '/ping', ['health']),
];

const byVerb = ({ verb: verbName }: { verb: Verbs }) =>
  verbName === Verbs.GET
    ? { plainKey: true, infiniteKey: false }
    : ('mutation' as const);

describe('getMutationInvalidatesContext', () => {
  it('sorts operations by the kind it is given', () => {
    const context = getMutationInvalidatesContext(verbs, (operation) => {
      if (operation.operationName === 'ping') return undefined;
      if (operation.operationName === 'healthCheck') {
        return { plainKey: false, infiniteKey: true };
      }
      if (operation.operationName === 'listPets') {
        return { plainKey: true, infiniteKey: true };
      }
      return byVerb(operation);
    });
    expect(context.queries.map((q) => q.operationName)).toStrictEqual([
      'listPets',
      'showPetById',
      'healthCheck',
    ]);
    expect(context.queries.map((q) => q.queryKeys)).toStrictEqual([
      ['listPets', 'listPetsInfinite'],
      ['showPetById'],
      ['healthCheckInfinite'],
    ]);
    expect(context.mutations.map((m) => m.operationName)).toStrictEqual([
      'createPets',
      'deletePet',
    ]);
  });

  it('describes each operation by id, verb, path, path params and tags', () => {
    const context = getMutationInvalidatesContext(verbs, byVerb);
    expect(
      context.mutations.find((m) => m.operationName === 'deletePet'),
    ).toStrictEqual({
      operationId: 'DeletePet',
      operationName: 'deletePet',
      verb: Verbs.DELETE,
      path: '/pets/{petId}',
      pathParams: ['petId'],
      tags: ['pets'],
    });
  });
});

describe('resolveMutationInvalidates', () => {
  const context: MutationInvalidatesContext = { mutations: [], queries: [] };

  it('returns a static array as is', () => {
    const rules = [{ onMutations: ['createPets'], invalidates: ['listPets'] }];
    expect(resolveMutationInvalidates(rules, context)).toBe(rules);
    expect(resolveMutationInvalidates(undefined, context)).toBeUndefined();
  });

  it('calls a function with a copy of the context and returns its rules', () => {
    const rules = [{ onMutations: ['createPets'], invalidates: ['listPets'] }];
    const fn = vi.fn((received: MutationInvalidatesContext) =>
      received === context ? [] : rules,
    );
    expect(resolveMutationInvalidates(fn, context)).toBe(rules);
    expect(fn).toHaveBeenCalledWith(context);
  });

  it('rejects a result that is not an array of rules', () => {
    expect(() =>
      resolveMutationInvalidates(() => undefined as never, context),
    ).toThrow('must return an array of rules, got undefined');
    expect(() =>
      resolveMutationInvalidates((() => Promise.resolve([])) as never, context),
    ).toThrow('must be synchronous');
  });

  it.each([
    { invalidates: ['listPets'] },
    { onMutations: [{ operationName: 'createPets' }], invalidates: [] },
    { onMutations: ['createPets'], invalidates: [{ operationName: 'x' }] },
    {
      onMutations: ['createPets'],
      invalidates: [{ query: 'x', params: 'id' }],
    },
    { onMutations: ['createPets'], invalidates: [{ query: 'x', file: 1 }] },
    {
      onMutations: ['createPets'],
      invalidates: [{ query: 'x', invalidateMode: 'Reset' }],
    },
  ])('names a malformed rule by its index (%#)', (bad) => {
    expect(() =>
      resolveMutationInvalidates(
        () => [{ onMutations: ['createPets'], invalidates: [] }, bad] as never,
        context,
      ),
    ).toThrow('invalid rule at index 1');
  });
});

describe('combineMutationInvalidates', () => {
  const top = [{ onMutations: ['createPets'], invalidates: ['listPets'] }];
  const op = [{ onMutations: ['createPets'], invalidates: ['healthCheck'] }];

  it('keeps a single level and concatenates arrays', () => {
    expect(combineMutationInvalidates([undefined, top])).toBe(top);
    expect(combineMutationInvalidates([top, undefined, op])).toStrictEqual([
      ...top,
      ...op,
    ]);
  });

  it('combines a function with arrays in level order', () => {
    const combined = combineMutationInvalidates([() => top, op]);
    const resolve = createMutationInvalidatesResolver(() => ({
      mutations: [],
      queries: [],
    }));
    expect(resolve(combined)).toStrictEqual([...top, ...op]);
  });
});

describe('createMutationInvalidatesResolver', () => {
  it('calls each function once and reuses its rules across levels', () => {
    const rules = [{ onMutations: ['createPets'], invalidates: ['listPets'] }];
    const fn = vi.fn(() => rules);
    const resolve = createMutationInvalidatesResolver(() => ({
      mutations: [],
      queries: [],
    }));

    expect(resolve(fn)).toBe(rules);
    expect(resolve(fn)).toBe(rules);
    resolve(combineMutationInvalidates([fn, []]));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('never builds the context for static rules', () => {
    const context = vi.fn(() => ({ mutations: [], queries: [] }));
    const resolve = createMutationInvalidatesResolver(context);
    resolve([{ onMutations: ['createPets'], invalidates: ['listPets'] }]);
    expect(context).not.toHaveBeenCalled();
  });
});

describe('getMutationInvalidatesRules', () => {
  it('returns static rules and refuses an unresolved function', () => {
    expect(getMutationInvalidatesRules(undefined)).toStrictEqual([]);
    expect(() => getMutationInvalidatesRules(() => [])).toThrow(
      'was not resolved',
    );
  });
});

describe('createMutationInvalidatesFileFiller', () => {
  const fill = (
    rules: MutationInvalidatesConfig,
    mode: OutputMode = OutputMode.TAGS_SPLIT,
    fileExtension = '.ts',
  ) =>
    createMutationInvalidatesFileFiller({
      operations: verbs,
      output: { mode, fileExtension, tsconfig: undefined },
    })(rules);

  it('leaves rules alone outside the tag modes', () => {
    const rules = [
      { onMutations: ['createPets'], invalidates: ['healthCheck'] },
    ];
    expect(fill(rules, OutputMode.SINGLE)).toBe(rules);
    expect(fill(rules, OutputMode.SPLIT)).toBe(rules);
  });

  it.each([OutputMode.TAGS, OutputMode.TAGS_SPLIT])(
    'points a target in another tag at that tag file (%s)',
    (mode) => {
      expect(
        fill(
          [
            {
              onMutations: ['createPets'],
              invalidates: [
                'listPets',
                'healthCheck',
                { query: 'HealthCheck', invalidateMode: 'reset' },
              ],
            },
          ],
          mode,
        ),
      ).toStrictEqual([
        {
          onMutations: ['createPets'],
          invalidates: [
            'listPets',
            { query: 'healthCheck', file: './health' },
            { query: 'HealthCheck', invalidateMode: 'reset', file: './health' },
          ],
        },
      ]);
    },
  );

  it('maps .mts to the .mjs import TypeScript resolves', () => {
    expect(
      fill(
        [{ onMutations: ['createPets'], invalidates: ['healthCheck'] }],
        OutputMode.TAGS,
        '.mts',
      ),
    ).toStrictEqual([
      {
        onMutations: ['createPets'],
        invalidates: [{ query: 'healthCheck', file: './health.mjs' }],
      },
    ]);
  });

  it("prefers an operation's own name over another's infinite alias", () => {
    const filler = createMutationInvalidatesFileFiller({
      operations: [
        verb('fooInfinite', Verbs.GET, '/b', ['b']),
        verb('foo', Verbs.GET, '/a', ['a']),
        verb('createC', Verbs.POST, '/c', ['c']),
      ],
      output: {
        mode: OutputMode.TAGS_SPLIT,
        fileExtension: '.ts',
        tsconfig: undefined,
      },
    });
    expect(
      filler([{ onMutations: ['createC'], invalidates: ['fooInfinite'] }]),
    ).toStrictEqual([
      {
        onMutations: ['createC'],
        invalidates: [{ query: 'fooInfinite', file: './b' }],
      },
    ]);
  });

  it('drops a TypeScript extension the import cannot carry', () => {
    expect(
      fill(
        [{ onMutations: ['createPets'], invalidates: ['healthCheck'] }],
        OutputMode.TAGS,
        '.tsx',
      ),
    ).toStrictEqual([
      {
        onMutations: ['createPets'],
        invalidates: [{ query: 'healthCheck', file: './health' }],
      },
    ]);
  });

  it('adds the import extension of the tag file in tags mode', () => {
    expect(
      fill(
        [{ onMutations: ['createPets'], invalidates: ['healthCheck'] }],
        OutputMode.TAGS,
        '.gen.ts',
      ),
    ).toStrictEqual([
      {
        onMutations: ['createPets'],
        invalidates: [{ query: 'healthCheck', file: './health.gen' }],
      },
    ]);
  });

  it('keeps an explicit file and an unknown target as written', () => {
    const rules = [
      {
        onMutations: ['createPets'],
        invalidates: [
          { query: 'healthCheck', file: './elsewhere' },
          'adminPets',
        ],
      },
    ];
    expect(fill(rules)).toStrictEqual(rules);
  });

  it('resolves an infinite target to its operation tag', () => {
    expect(
      fill([
        { onMutations: ['createPets'], invalidates: ['healthCheckInfinite'] },
      ]),
    ).toStrictEqual([
      {
        onMutations: ['createPets'],
        invalidates: [{ query: 'healthCheckInfinite', file: './health' }],
      },
    ]);
  });

  it('splits a rule whose mutations live in different tags', () => {
    expect(
      fill([
        {
          onMutations: ['createPets', 'ping'],
          invalidates: ['listPets', 'healthCheck'],
        },
      ]),
    ).toStrictEqual([
      {
        onMutations: ['createPets'],
        invalidates: ['listPets', { query: 'healthCheck', file: './health' }],
      },
      {
        onMutations: ['ping'],
        invalidates: [{ query: 'listPets', file: './pets' }, 'healthCheck'],
      },
    ]);
  });

  it('returns the same filled list for the same rules', () => {
    const filler = createMutationInvalidatesFileFiller({
      operations: verbs,
      output: {
        mode: OutputMode.TAGS,
        fileExtension: '.ts',
        tsconfig: undefined,
      },
    });
    const rules = [
      { onMutations: ['createPets'], invalidates: ['healthCheck'] },
    ];
    expect(filler(rules)).toBe(filler(rules));
  });
});
