import { Schema as S } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import {
  evaluate,
  generateModule,
  ref,
  type Scenario,
  type Schemas,
} from './test-helpers';

const show = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item instanceof Date ? `Date(${item.toISOString()})` : item,
  );

interface Result {
  ok: boolean;
  output?: string;
}

const build = async (scenario: Scenario, enabled: boolean) =>
  evaluate(
    await generateModule(scenario, enabled),
    scenario.target === 'response' ? 'CreatePetsResponse' : 'CreatePetsBody',
  );

const run = (
  schema: S.Codec<unknown>,
  input: unknown,
  onExcessProperty: 'ignore' | 'error',
): Result => {
  try {
    return {
      ok: true,
      output: show(S.decodeUnknownSync(schema)(input, { onExcessProperty })),
    };
  } catch {
    return { ok: false };
  }
};

// A reference to a missing component renders as unknown with and without the
// flag, which would make a case pass without testing anything.
const expectRefsResolve = ({ schemas, schema }: Scenario) => {
  const names = JSON.stringify([schemas, schema]).matchAll(
    /#\/components\/schemas\/(\w+)/g,
  );
  for (const [, name] of names) expect(schemas).toHaveProperty(name);
};

// The flag must not change what a schema accepts, or what it returns.
const expectParity = async (scenario: Scenario, samples: unknown[]) => {
  expectRefsResolve(scenario);
  const off = await build(scenario, false);
  const on = await build(scenario, true);
  for (const sample of samples) {
    for (const mode of ['ignore', 'error'] as const) {
      expect({ sample, mode, result: run(on, sample, mode) }).toEqual({
        sample,
        mode,
        result: run(off, sample, mode),
      });
    }
  }
};

describe('flag parity', () => {
  it('keeps required keys and nested optional keys', async () => {
    const schemas: Schemas = {
      Pet: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2 },
          owner: ref('Owner'),
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      Owner: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    };
    expect(
      await generateModule({ schemas, schema: ref('Pet') }, true),
    ).toContain('export const CreatePetsBody = Pet');
    await expectParity({ schemas, schema: ref('Pet') }, [
      { name: 'ab' },
      { name: 'a' },
      { name: 'ab', owner: { id: 'x' } },
      { name: 'ab', owner: {} },
      { name: 'ab', extra: 1 },
      { owner: { id: 'x' } },
      [],
    ]);
  });

  it('keeps a readOnly key out of a request body, nested or not', async () => {
    const schemas: Schemas = {
      Account: {
        type: 'object',
        required: ['name'],
        properties: {
          id: { type: 'string', readOnly: true },
          name: { type: 'string' },
          owner: ref('Owner'),
        },
      },
      Owner: {
        type: 'object',
        properties: { id: { type: 'string', readOnly: true } },
      },
    };
    const samples = [
      { name: 'n' },
      { name: 'n', id: 'x' },
      { name: 'n', owner: { id: 'x' } },
      { id: 'x' },
    ];
    await expectParity({ schemas, schema: ref('Account') }, samples);
    await expectParity(
      { schemas, schema: { type: 'array', items: ref('Account') } },
      samples.map((sample) => [sample]),
    );
    await expectParity(
      { schemas, schema: ref('Account'), target: 'response' },
      samples,
    );
  });

  it('drops a readOnly key behind an alias or an array component', async () => {
    const schemas: Schemas = {
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', readOnly: true },
          name: { type: 'string' },
        },
      },
      PetAlias: ref('Pet'),
      PetList: { type: 'array', items: ref('Pet') },
      PetAliasList: { type: 'array', items: ref('PetAlias') },
    };
    const samples = [{ name: 'n' }, { name: 'n', id: 'x' }, { id: 'x' }];
    for (const name of ['Pet', 'PetAlias']) {
      await expectParity({ schemas, schema: ref(name) }, samples);
    }
    for (const name of ['PetList', 'PetAliasList']) {
      await expectParity(
        { schemas, schema: ref(name) },
        samples.map((sample) => [sample]),
      );
    }
  });

  it('drops a property that is a reference to a readOnly alias', async () => {
    const schemas: Schemas = {
      Id: { type: 'string', readOnly: true },
      IdAlias: ref('Id'),
      Account: {
        type: 'object',
        required: ['name'],
        properties: {
          id: ref('Id'),
          alias: ref('IdAlias'),
          name: { type: 'string' },
        },
      },
    };
    const samples = [
      { name: 'n' },
      { name: 'n', id: 'x' },
      { name: 'n', alias: 'x' },
    ];
    await expectParity({ schemas, schema: ref('Account') }, samples);
    await expectParity(
      { schemas, schema: ref('Account'), target: 'response' },
      samples,
    );
  });

  it('does not require a readOnly alias property the allOf requires', async () => {
    const schemas: Schemas = {
      Id: { type: 'string', readOnly: true },
      Base: {
        type: 'object',
        properties: { id: ref('Id'), name: { type: 'string' } },
      },
      Thing: {
        allOf: [ref('Base'), { type: 'object', required: ['id', 'name'] }],
      },
    };
    await expectParity({ schemas, schema: ref('Thing'), target: 'response' }, [
      { name: 'n' },
      { id: '1', name: 'n' },
      { id: '1' },
    ]);
  });

  it('applies the default of a referenced component', async () => {
    const schemas: Schemas = {
      Mode: { type: 'string', enum: ['a', 'b'], default: 'a' },
      Holder: {
        type: 'object',
        properties: {
          mode: ref('Mode'),
          list: { type: 'array', items: ref('Mode') },
        },
      },
    };
    await expectParity({ schemas, schema: ref('Holder') }, [
      {},
      { mode: 'b' },
      { mode: 'c' },
      { list: ['a', 'b'] },
      { list: [undefined] },
    ]);
  });

  it('decodes a date component like the flag off does', async () => {
    const schemas: Schemas = {
      Stamp: { type: 'string', format: 'date-time' },
      Event: {
        type: 'object',
        required: ['at'],
        properties: {
          at: ref('Stamp'),
          also: { type: 'array', items: ref('Stamp') },
        },
      },
    };
    for (const useDates of [true, false]) {
      await expectParity({ schemas, schema: ref('Event'), useDates }, [
        { at: '2020-01-01T00:00:00Z' },
        { at: 'nope' },
        { at: '2020-01-01T00:00:00Z', also: ['2021-01-01T00:00:00Z'] },
        {},
      ]);
    }
  });

  it('keeps a nullable alias and the siblings of a reference', async () => {
    const schemas: Schemas = {
      Name: { type: ['string', 'null'] },
      Label: { type: 'string', minLength: 3 },
      Holder: {
        type: 'object',
        required: ['name', 'either'],
        properties: {
          name: ref('Name'),
          label: { ...ref('Label'), description: 'a label' },
          either: { oneOf: [ref('Label'), { type: 'null' }] },
        },
      },
    };
    await expectParity({ schemas, schema: ref('Holder') }, [
      { name: null, either: null },
      { name: 'x', either: 'abc' },
      { name: 'x', either: 'ab' },
      { name: 'x', either: null, label: 'ab' },
      { either: null },
    ]);
  });

  it('reads a cycle that carries a default', async () => {
    const schemas: Schemas = {
      Node: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['x', 'y'], default: 'x' },
          next: { ...ref('Wrap'), default: {} },
        },
      },
      Wrap: { oneOf: [ref('Node'), { type: 'null' }] },
    };
    await expectParity({ schemas, schema: ref('Node') }, [
      {},
      { next: null },
      { kind: 'y' },
      { kind: 'z' },
    ]);
  });

  it('reads self-referencing and mutual components', async () => {
    const schemas: Schemas = {
      Tree: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', maxLength: 3 },
          children: { type: 'array', items: ref('Tree') },
          link: ref('Link'),
        },
      },
      Link: {
        type: 'object',
        required: ['to'],
        properties: { to: ref('Tree') },
      },
    };
    // Nested levels stay unchecked with the flag off, where the inlined cycle
    // validates as unknown.
    await expectParity({ schemas, schema: ref('Tree') }, [
      { name: 'a', children: [{ name: 'b' }] },
      { name: 'toolong' },
      { name: 'a', children: 'x' },
      { name: 'a', link: { to: { name: 'b' } } },
      { name: 'a', link: {} },
      {},
    ]);
  });

  it('reads a cycle closed by a reference that cannot stay one', async () => {
    const schemas: Schemas = {
      Node: {
        type: 'object',
        required: ['items'],
        properties: {
          name: { type: 'string' },
          items: { ...ref('Node'), readOnly: true },
          kids: { type: 'array', items: ref('Node') },
        },
      },
    };
    await expectParity({ schemas, schema: ref('Node'), target: 'response' }, [
      { items: {} },
      { items: 5 },
      { items: 'x' },
      { name: 'a', items: {}, kids: [{ items: 1 }] },
      {},
    ]);
  });

  it('inlines allOf members', async () => {
    const schemas: Schemas = {
      Base: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      Extended: {
        allOf: [
          ref('Base'),
          {
            type: 'object',
            required: ['label'],
            properties: { label: { type: 'string' } },
          },
        ],
      },
    };
    const samples = [
      { id: '1', label: 'x' },
      { label: 'x' },
      { id: '1' },
      { id: 1, label: 'x' },
    ];
    await expectParity({ schemas, schema: ref('Extended') }, samples);
  });

  it('requires a key the parent requires of a referenced member', async () => {
    const schemas: Schemas = {
      Optionals: {
        type: 'object',
        properties: { left: { type: 'string' }, right: { type: 'string' } },
      },
      Requirements: {
        type: 'object',
        required: ['left'],
        properties: { holder: ref('Optionals') },
        allOf: [ref('Optionals')],
      },
    };
    await expectParity({ schemas, schema: ref('Requirements') }, [
      {},
      { left: 'x' },
      { left: 'x', holder: { right: 'y' } },
    ]);
  });

  it('follows the references of a tuple', async () => {
    const schemas: Schemas = {
      Item: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    };
    await expectParity(
      {
        schemas,
        schema: {
          type: 'array',
          prefixItems: [ref('Item'), { type: 'number' }],
        },
      },
      [[{ id: 'x' }, 1], [{}, 1], [{ id: 'x' }]],
    );
  });

  it('keeps an array body with its length limits', async () => {
    const schemas: Schemas = {
      Item: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    };
    await expectParity(
      { schemas, schema: { type: 'array', items: ref('Item'), minItems: 1 } },
      [[], [{ id: 'x' }], [{}]],
    );
  });

  it('reads an array root like the flag off does', async () => {
    const schemas: Schemas = {
      Item: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      Maybe: { type: ['array', 'null'], items: ref('Item') },
      MaybeAlias: { ...ref('Maybe'), description: 'maybe' },
      Bounded: { type: 'array', items: ref('Item'), minItems: 1, maxItems: 2 },
    };
    const samples = [
      null,
      [],
      [{ id: 'x' }],
      [{}],
      [{ id: 'x' }, { id: 'y' }, { id: 'z' }],
      'x',
    ];
    for (const name of ['Maybe', 'MaybeAlias', 'Bounded']) {
      for (const target of ['body', 'response'] as const) {
        await expectParity({ schemas, schema: ref(name), target }, samples);
      }
    }
  });

  it('keeps the items of an array root as references', async () => {
    const schemas: Schemas = {
      Item: { type: 'object', properties: { id: { type: 'string' } } },
      Items: { type: 'array', items: ref('Item') },
    };
    const text = await generateModule(
      { schemas, schema: ref('Items'), target: 'response' },
      true,
    );
    expect(text).toContain('export const CreatePetsResponseItem = Item');
    expect(text).toContain(
      'export const CreatePetsResponse = S.Array(CreatePetsResponseItem)',
    );
    expect(text).not.toContain('export const Items');
  });

  it('brands the items of an array root', async () => {
    const schemas: Schemas = {
      Item: { type: 'object', properties: { id: { type: 'string' } } },
      Items: { type: 'array', items: ref('Item') },
    };
    const scenario: Scenario = {
      schemas,
      schema: ref('Items'),
      target: 'response',
      useBrandedTypes: true,
    };
    const [off, on] = [
      await generateModule(scenario, false),
      await generateModule(scenario, true),
    ];
    for (const text of [off, on]) {
      expect(text).toContain('.pipe(S.brand("CreatePetsResponse"))');
      expect(text).toContain(
        'export const CreatePetsResponse = S.Array(CreatePetsResponseItem)',
      );
    }
    await expectParity(scenario, [[{ id: 'x' }], [{ id: 1 }], null]);
  });

  it('reads the bounds of 0 of an array component like the flag off', async () => {
    const schemas: Schemas = {
      Item: { type: 'object', properties: { id: { type: 'string' } } },
      Any: { type: 'array', items: ref('Item'), minItems: 0 },
      Capped: { type: 'array', items: ref('Item'), minItems: 0, maxItems: 100 },
      None: { type: 'array', items: ref('Item'), minItems: 0, maxItems: 0 },
      Holder: {
        type: 'object',
        properties: {
          any: ref('Any'),
          capped: ref('Capped'),
          none: ref('None'),
        },
      },
    };
    const samples = [[], [{ id: 'x' }], [{ id: 1 }]];
    for (const name of ['Any', 'Capped', 'None']) {
      await expectParity({ schemas, schema: ref(name) }, samples);
    }
    await expectParity(
      { schemas, schema: ref('Holder') },
      samples.flatMap((sample) => [
        { any: sample },
        { capped: sample },
        { none: sample },
      ]),
    );
  });

  it('inlines the references of a form body', async () => {
    const schemas: Schemas = {
      Pet: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
    };
    await expectParity(
      {
        schemas,
        schema: {
          type: 'object',
          properties: {
            pet: ref('Pet'),
            note: { type: 'string', format: 'binary' },
          },
        },
        contentType: 'application/x-www-form-urlencoded',
      },
      [{}, { pet: { name: 'x' } }, { pet: {} }, { note: 'a' }],
    );
  });

  it('follows exactOptional', async () => {
    const schemas: Schemas = {
      Pet: {
        type: 'object',
        properties: { tag: { type: 'string' }, owner: ref('Pet') },
      },
    };
    await expectParity({ schemas, schema: ref('Pet'), exactOptional: true }, [
      {},
      { tag: 'x' },
      { tag: undefined },
      { owner: { tag: 'y' } },
    ]);
  });

  // A component that no rendered location reads is not generated.
  it.each([
    [
      'an error response',
      {
        '404': {
          description: 'missing',
          content: { 'application/json': { schema: ref('Tags') } },
        },
      },
    ],
    [
      'an xml media type',
      {
        '201': {
          description: 'created',
          content: { 'application/xml': { schema: ref('Tags') } },
        },
      },
    ],
  ] as const)(
    'skips a component only %s reads',
    async (_name, otherResponses) => {
      const schemas: Schemas = {
        Base: { type: 'object', properties: { id: { type: 'string' } } },
        // Not a struct, so generating it fails on Effect 4.
        Tags: {
          allOf: [ref('Base'), { type: 'array', items: { type: 'string' } }],
        },
        Pet: { type: 'object', properties: { name: { type: 'string' } } },
      };
      await expectParity({ schemas, schema: ref('Pet'), otherResponses }, [
        {},
        { name: 'x' },
      ]);
    },
  );

  it('inlines a binary component of a urlencoded body', async () => {
    const schemas: Schemas = {
      Blob: { type: 'string', format: 'binary' },
    };
    await expectParity(
      {
        schemas,
        schema: { type: 'object', properties: { f: ref('Blob') } },
        contentType: 'application/x-www-form-urlencoded',
      },
      [{}, { f: 'text' }],
    );
  });
});
