import { runInNewContext } from 'node:vm';

import type { OpenApiSchemaObject } from '@orval/core';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { parseBodyAndResponse } from './operation';
import { renderValibot } from './render';
import { generateValibotComponents } from './reusable-schemas';

const ref = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});

type Schemas = Record<string, OpenApiSchemaObject>;

interface Scenario {
  schemas: Schemas;
  body: OpenApiSchemaObject;
  // Bodies of other operations generated first from the same spec.
  earlierBodies?: OpenApiSchemaObject[];
  isRequest?: boolean;
  // Output-level strictness, for every location.
  outputStrict?: boolean;
  outputExactOptional?: boolean;
  // Strictness and exactOptional of the operation under test.
  strict?: boolean;
  exactOptional?: boolean;
  useDates?: boolean;
  // Extra top-level spec members, e.g. shared definitions outside components.
  extraSpec?: Record<string, unknown>;
}

interface Result {
  ok: boolean;
  output?: string;
}

const show = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item instanceof Date ? `Date(${item.toISOString()})` : item,
  );

const evaluate = (code: string): v.GenericSchema =>
  runInNewContext(`${code}\n;__body`, { v, Date }) as v.GenericSchema;

const build = (scenario: Scenario, enabled: boolean): v.GenericSchema => {
  const {
    schemas,
    body,
    earlierBodies = [],
    isRequest = true,
    outputStrict = false,
    outputExactOptional = false,
    strict = outputStrict,
    exactOptional = outputExactOptional,
    useDates = false,
    extraSpec = {},
  } = scenario;
  const context = createTestContextSpec({
    spec: { ...extraSpec, components: { schemas } },
    output: {
      override: {
        useDates,
        valibot: {
          generateReusableSchemas: enabled,
          strict: {
            param: outputStrict,
            query: outputStrict,
            header: outputStrict,
            body: outputStrict,
            response: outputStrict,
          },
          exactOptional: outputExactOptional,
        },
      },
    },
  });
  const parse = (schema: OpenApiSchemaObject) =>
    parseBodyAndResponse({
      data: { content: { 'application/json': { schema } } },
      context,
      strict,
      exactOptional,
      generate: true,
      isRequest,
    });
  for (const earlier of earlierBodies) parse(earlier);
  const node = parse(body);
  if (!node) throw new Error('no body');
  const components = enabled
    ? generateValibotComponents(context)
        .replaceAll('export const ', 'const ')
        .replaceAll('(): v.GenericSchema =>', '() =>')
    : '';
  return evaluate(
    `${components}\nconst __body = ${renderValibot(node, { exactOptional })}`,
  );
};

const run = (schema: v.GenericSchema, input: unknown): Result => {
  const result = v.safeParse(schema, input);
  return result.success
    ? { ok: true, output: show(result.output) }
    : { ok: false };
};

// The flag must not change what a body accepts, or what it returns.
const expectParity = (scenario: Scenario, samples: unknown[]) => {
  const off = build(scenario, false);
  const on = build(scenario, true);
  for (const sample of samples) {
    expect({ sample, result: run(on, sample) }).toEqual({
      sample,
      result: run(off, sample),
    });
  }
};

describe('flag parity', () => {
  it('scans properties named like data keywords for readOnly', () => {
    const schemas: Schemas = {
      Foo: {
        type: 'object',
        required: ['default'],
        properties: { default: ref('Bar') },
      },
      Bar: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', readOnly: true } },
      },
      Baz: {
        type: 'object',
        required: ['example'],
        properties: { example: { type: 'string', readOnly: true } },
      },
    };
    expectParity({ schemas, body: ref('Foo') }, [{ default: {} }, {}]);
    expectParity({ schemas, body: ref('Baz') }, [{}, { example: 'x' }]);
  });

  it('follows a reference into a component sub-path for readOnly', () => {
    const schemas: Schemas = {
      Bar: {
        type: 'object',
        properties: { id: { type: 'string', readOnly: true } },
      },
      Ptr: {
        type: 'object',
        required: ['x'],
        properties: { x: { $ref: '#/components/schemas/Bar/properties/id' } },
      },
    };
    expectParity({ schemas, body: ref('Ptr') }, [{}, { x: 'a' }]);
  });

  it('drops an allOf member that checks nothing', () => {
    const schemas: Schemas = {
      Empty: {},
      Open: { type: 'object', additionalProperties: true },
      Dated: {
        type: 'object',
        required: ['d'],
        properties: { d: { type: 'string', format: 'date-time' } },
      },
      Combo: { allOf: [ref('Empty'), ref('Dated')] },
      Combo2: { allOf: [ref('Open'), ref('Dated')] },
    };
    const samples = [
      { d: '2020-01-01T00:00:00Z', extra: 1 },
      { d: '2020-01-01T00:00:00Z' },
      {},
    ];
    for (const useDates of [true, false]) {
      expectParity({ schemas, body: ref('Combo'), useDates }, samples);
      expectParity({ schemas, body: ref('Combo2'), useDates }, samples);
    }
  });

  it('drops a cut allOf member like an unknown one', () => {
    const schemas: Schemas = {
      A: {
        allOf: [
          ref('A'),
          { type: 'object', properties: { a: { type: 'string' } } },
        ],
      },
    };
    expectParity({ schemas, body: ref('A') }, [{}, { a: 'x', extra: 1 }, 1]);
  });

  it('reads required keys from referenced allOf members', () => {
    const schemas: Schemas = {
      A: { type: 'object', properties: { k: { type: 'string' } } },
      Req: { required: ['k'] },
      Combo: { allOf: [ref('A'), ref('Req')] },
    };
    expectParity({ schemas, body: ref('Combo') }, [{}, { k: 'a' }, { k: 1 }]);
  });

  it('reads required keys through a chain of referenced members', () => {
    const schemas: Schemas = {
      A: { type: 'object', properties: { k: { type: 'string' } } },
      Req: { required: ['k'] },
      Mid: { allOf: [ref('Req')] },
      Combo: { allOf: [ref('A'), ref('Mid')] },
    };
    expectParity({ schemas, body: ref('Combo') }, [{}, { k: 'a' }]);
  });

  it('keeps the strictness of the location, not of the body', () => {
    const schemas: Schemas = {
      A: { type: 'object', properties: { a: { type: 'string' } } },
    };
    const samples = [{}, { a: 'x' }, { a: 'x', extra: 1 }];
    for (const isRequest of [true, false]) {
      for (const outputStrict of [true, false]) {
        expectParity(
          {
            schemas,
            body: ref('A'),
            isRequest,
            outputStrict,
            strict: !outputStrict,
          },
          samples,
        );
        expectParity(
          { schemas, body: ref('A'), isRequest, outputStrict },
          samples,
        );
      }
    }
  });

  it('keeps the exactOptional of the operation', () => {
    const schemas: Schemas = {
      A: { type: 'object', properties: { a: { type: 'string' } } },
    };
    const samples = [{}, { a: 'x' }, { a: undefined }];
    for (const outputExactOptional of [true, false]) {
      expectParity(
        {
          schemas,
          body: ref('A'),
          outputExactOptional,
          exactOptional: !outputExactOptional,
        },
        samples,
      );
    }
  });

  it('requires a key next to a reference', () => {
    const schemas: Schemas = {
      A: { type: 'object', properties: { k: { type: 'string' } } },
      Wrap: {
        type: 'object',
        properties: { a: { ...ref('A'), required: ['k'] } },
      },
    };
    expectParity({ schemas, body: ref('Wrap') }, [
      {},
      { a: {} },
      { a: { k: 'x' } },
    ]);
  });

  it('keeps the keys of a strict reference with sibling properties', () => {
    const schemas: Schemas = {
      A: { type: 'object', properties: { k: { type: 'string' } } },
      Wrap: {
        type: 'object',
        properties: {
          a: { ...ref('A'), properties: { extra: { type: 'string' } } },
        },
      },
    };
    for (const outputStrict of [true, false]) {
      expectParity({ schemas, body: ref('Wrap'), outputStrict }, [
        { a: { k: 'x' } },
        { a: { extra: 'x' } },
        { a: { k: 'x', extra: 'x' } },
      ]);
    }
  });

  it('narrows the own properties with a referenced required-only alternative', () => {
    const own = { k: { type: 'string' }, x: { type: 'string' } } as const;
    const schemas: Schemas = {
      ReqK: { required: ['k'] },
      ReqX: { required: ['x'] },
      ReqKT: { type: 'object', required: ['k'] },
      P1: {
        type: 'object',
        properties: own,
        oneOf: [ref('ReqK'), ref('ReqX')],
      },
      P2: {
        type: 'object',
        properties: own,
        anyOf: [ref('ReqK'), ref('ReqX')],
      },
      P4: {
        type: 'object',
        properties: own,
        oneOf: [ref('ReqKT'), ref('ReqX')],
      },
    };
    for (const name of ['P1', 'P2', 'P4']) {
      expectParity({ schemas, body: ref(name) }, [{}, { k: 'a' }, { x: 'a' }]);
    }
  });

  it('drops an open record whose values are a reference to an empty schema', () => {
    const schemas: Schemas = {
      Empty: {},
      Dated: {
        type: 'object',
        required: ['d'],
        properties: { d: { type: 'string', format: 'date-time' } },
      },
      C1: {
        allOf: [
          ref('Dated'),
          { type: 'object', additionalProperties: ref('Empty') },
        ],
      },
    };
    const samples = [
      { d: '2020-01-01T00:00:00Z' },
      { d: '2020-01-01T00:00:00Z', extra: { id: 1 } },
    ];
    for (const useDates of [true, false]) {
      expectParity({ schemas, body: ref('C1'), useDates }, samples);
    }
  });

  it('drops a typed required-only allOf member like an open record', () => {
    const schemas: Schemas = {
      J: { type: 'object', properties: { j: { type: 'string' } } },
      D4: { allOf: [ref('J'), { type: 'object', required: ['k'] }] },
    };
    expectParity({ schemas, body: ref('D4') }, [
      { j: 'a' },
      { j: 'a', extra: 1 },
      {},
    ]);
  });

  it('ignores a key that no allOf member declares', () => {
    const schemas: Schemas = {
      Other: { type: 'object', properties: { o: { type: 'string' } } },
      ReqIdU: {
        type: 'object',
        required: ['id'],
        properties: { z: { type: 'string' } },
      },
      H7: { allOf: [ref('Other'), ref('ReqIdU')] },
    };
    expectParity({ schemas, body: ref('H7') }, [{}, { o: 'a' }, { z: 'a' }]);
  });

  it('strips a flagged key that a referenced sibling declares', () => {
    const schemas: Schemas = {
      RoDecl: {
        type: 'object',
        properties: {
          id: { type: 'string', readOnly: true },
          a: { type: 'string' },
        },
      },
      ReqIdT: {
        type: 'object',
        required: ['id'],
        properties: { z: { type: 'string' } },
      },
      G1: { allOf: [ref('RoDecl'), ref('ReqIdT')] },
    };
    expectParity({ schemas, body: ref('G1') }, [{}, { a: 'a' }, { id: 'x' }]);
  });

  it('keeps strict references out of members merged from several groups', () => {
    const schemas: Schemas = {
      A: { type: 'object', properties: { a: { type: 'string' } } },
      B: { type: 'object', properties: { b: { type: 'string' } } },
      C: { type: 'object', properties: { c: { type: 'string' } } },
      G2: { allOf: [ref('A')], oneOf: [ref('B'), ref('C')] },
    };
    expectParity({ schemas, body: ref('G2'), outputStrict: true }, [
      { a: 'x', b: 'y' },
      { a: 'x', c: 'y' },
      {},
    ]);
  });

  it('hoists the null of a nullable alternative onto the own object', () => {
    const schemas: Schemas = {
      Ns: { type: ['string', 'null'] },
      Foo: {
        type: 'object',
        properties: { d: { type: 'boolean' } },
        oneOf: [ref('Ns')],
      },
    };
    expectParity({ schemas, body: ref('Foo') }, [null, 'x', {}, { d: true }]);
    expectParity({ schemas, body: ref('Foo'), isRequest: false }, [
      null,
      'x',
      {},
    ]);
  });

  it('hoists the null of an alternative that nests a nullable one', () => {
    const schemas: Schemas = {
      Ns: { type: ['string', 'null'] },
      Wrap: { anyOf: [ref('Ns'), { type: 'integer' }] },
      Foo: {
        type: 'object',
        properties: { d: { type: 'boolean' } },
        anyOf: [ref('Wrap')],
      },
    };
    expectParity({ schemas, body: ref('Foo') }, [null, 1, {}, { d: true }]);
  });

  it('strips a flagged key that a nested alternative requires', () => {
    const schemas: Schemas = {
      Bar: {
        anyOf: [
          { type: 'string' },
          {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string' } },
          },
        ],
      },
      Foo: {
        type: 'object',
        properties: { id: { type: 'string', writeOnly: true } },
        oneOf: [ref('Bar')],
      },
    };
    expectParity({ schemas, body: ref('Foo'), isRequest: false }, [
      {},
      { id: 'x' },
      'x',
    ]);
    expectParity({ schemas, body: ref('Foo') }, [{}, { id: 'x' }, 'x']);
  });

  it('hoists the null of an alternative of a property schema', () => {
    const schemas: Schemas = {
      Ni: { type: ['integer', 'null'] },
      S1: {
        type: 'object',
        properties: { z: { type: 'string' } },
        oneOf: [ref('Ni')],
      },
      Foo: {
        type: 'object',
        properties: {
          a: { ...ref('S1'), readOnly: true },
          d: { type: 'string' },
        },
      },
    };
    expectParity({ schemas, body: ref('Foo') }, [
      { d: 'x', a: null },
      { d: 'x', a: 1 },
      { d: 'x' },
    ]);
    expectParity({ schemas, body: ref('Foo'), isRequest: false }, [
      { d: 'x', a: null },
      { a: 1 },
    ]);
  });

  it('reads required keys through an alias component', () => {
    const schemas: Schemas = {
      Base: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
      Alias: ref('Base'),
    };
    const body: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [ref('Alias')],
    };
    expectParity({ schemas, body }, [{}, { id: 'a' }, { id: 1 }]);
  });

  it('hoists the null of an alias to a nullable alternative', () => {
    const schemas: Schemas = {
      Nullable: {
        type: ['object', 'null'],
        properties: { a: { type: 'string' } },
      },
      Alias: ref('Nullable'),
    };
    const body: OpenApiSchemaObject = {
      type: 'object',
      properties: { z: { type: 'string' } },
      oneOf: [ref('Alias')],
    };
    expectParity({ schemas, body }, [null, {}, { z: 'x' }]);
  });

  it('strips a flagged key declared behind an alias', () => {
    const schemas: Schemas = {
      Flagged: {
        type: 'object',
        properties: { id: { type: 'string', readOnly: true } },
      },
      Alias: ref('Flagged'),
      Req: { required: ['id'] },
    };
    const body: OpenApiSchemaObject = {
      type: 'object',
      allOf: [ref('Alias'), ref('Req')],
    };
    expectParity({ schemas, body }, [{}, { id: 'a' }]);
  });

  it('follows a reference outside the components for readOnly', () => {
    const spec = {
      'x-shared': {
        Owner: {
          type: 'object',
          properties: { id: { type: 'string', readOnly: true } },
        },
      },
    };
    const schemas: Schemas = {
      Pet: {
        type: 'object',
        required: ['owner'],
        properties: { owner: { $ref: '#/x-shared/Owner' } },
      },
    };
    expectParity({ schemas, body: ref('Pet'), extraSpec: spec }, [
      { owner: {} },
      { owner: { id: 'a' } },
    ]);
  });

  it('applies the default of a referenced component on optional sites', () => {
    const schemas: Schemas = {
      Status: { type: 'string', enum: ['a', 'b'], default: 'a' },
      Count: { type: 'integer', default: 5 },
      Alias: ref('Count'),
      Holder: {
        type: 'object',
        properties: {
          status: ref('Status'),
          n: ref('Count'),
          viaAlias: ref('Alias'),
          list: { type: 'array', items: ref('Count') },
        },
      },
    };
    expectParity({ schemas, body: ref('Holder') }, [
      {},
      { status: 'b', n: 1, viaAlias: 2 },
      { list: [1, 2] },
      { status: 'c' },
    ]);
  });

  it('inlines a member that requires a key the parent declares optional', () => {
    const schemas: Schemas = {
      A: {
        type: 'object',
        properties: { id: { type: 'string', default: 'x' } },
        required: ['id'],
      },
    };
    const body: OpenApiSchemaObject = {
      type: 'object',
      properties: { id: { type: 'string' } },
      allOf: [ref('A')],
    };
    expectParity({ schemas, body }, [{}, { id: 'y' }, { id: 1 }]);
    expectParity({ schemas, body, isRequest: false }, [{}, { id: 'y' }]);
  });

  it('applies the default of a nullable referenced component', () => {
    const schemas: Schemas = {
      Name: { type: ['string', 'null'], default: 'x' },
      Holder: { type: 'object', properties: { name: ref('Name') } },
    };
    expectParity({ schemas, body: ref('Holder') }, [
      {},
      { name: null },
      { name: 'y' },
    ]);
  });

  it('inlines a date component used inside an intersection', () => {
    const schemas: Schemas = {
      Dt: { type: 'string', format: 'date-time' },
      Alias: ref('Dt'),
    };
    const samples = ['2020-01-01T00:00:00Z', 'nope', 1];
    for (const useDates of [true, false]) {
      expectParity(
        {
          schemas,
          body: {
            allOf: [ref('Dt'), { type: 'string', maxLength: 40 }],
          },
          useDates,
        },
        samples,
      );
      expectParity(
        {
          schemas,
          body: {
            allOf: [ref('Alias'), { type: 'string', maxLength: 40 }],
          },
          useDates,
        },
        samples,
      );
      expectParity(
        {
          schemas,
          body: { type: 'string', maxLength: 40, oneOf: [ref('Dt')] },
          useDates,
        },
        samples,
      );
      expectParity(
        {
          schemas,
          body: { allOf: [{ oneOf: [ref('Dt'), { type: 'number' }] }, {}] },
          useDates,
        },
        [...samples, 3],
      );
    }
  });

  it('hoists the null of an alternative next to an allOf', () => {
    const schemas: Schemas = {
      Base: { type: 'object', properties: { a: { type: 'string' } } },
      Ns: { type: ['string', 'null'] },
    };
    const body: OpenApiSchemaObject = {
      allOf: [ref('Base')],
      oneOf: [ref('Ns')],
    };
    expectParity({ schemas, body }, [null, 'x', {}, { a: 'x' }]);
    expectParity({ schemas, body, isRequest: false }, [null, 'x', {}]);
  });

  it('strips a flagged key declared by a reference to a flagged component', () => {
    const schemas: Schemas = {
      Ro: { type: 'string', readOnly: true },
      Bar: {
        anyOf: [
          { type: 'string' },
          {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string' } },
          },
        ],
      },
      Foo: {
        type: 'object',
        properties: { id: ref('Ro') },
        oneOf: [ref('Bar')],
      },
    };
    expectParity({ schemas, body: ref('Foo') }, [
      {},
      { id: 'a' },
      'x',
      { id: 1 },
    ]);
    expectParity({ schemas, body: ref('Foo'), isRequest: false }, [
      {},
      { id: 'a' },
      'x',
    ]);
  });

  it('treats an empty reference as an inline schema', () => {
    const schemas: Schemas = {
      Holder: {
        type: 'object',
        properties: { a: { $ref: '', type: 'string' } },
      },
    };
    expectParity({ schemas, body: ref('Holder') }, [{}, { a: 'x' }, { a: 1 }]);
  });

  it('requires a key reached through a cycle that an earlier body cut', () => {
    const schemas: Schemas = {
      Pet: {
        type: 'object',
        properties: { name: { type: 'string' } },
        oneOf: [ref('Cat'), ref('Puppy')],
      },
      Cat: {
        allOf: [
          ref('Pet'),
          { type: 'object', properties: { lives: { type: 'number' } } },
        ],
      },
      Puppy: { allOf: [ref('Cat')] },
      Q: { allOf: [ref('Pet')] },
      W: { allOf: [ref('Puppy')] },
    };
    expectParity(
      {
        schemas,
        earlierBodies: [{ allOf: [ref('Q')] }],
        body: { allOf: [ref('W')], required: ['name'] },
      },
      [{}, { name: 'a' }, { name: 1 }],
    );
  });

  it('keeps a required key from a kept reference reaching an inlined sibling', () => {
    const schemas: Schemas = {
      Pet: {
        required: ['id'],
        anyOf: [
          { type: 'object', properties: { id: { type: 'string' } } },
          { type: 'object', properties: { legacyId: { type: 'string' } } },
        ],
      },
      WithId: { type: 'object', properties: { id: { type: 'string' } } },
      Both: { allOf: [ref('Pet'), ref('WithId')] },
    };
    expectParity({ schemas, body: ref('Both') }, [
      {},
      { id: 'x' },
      { legacyId: 'x' },
      { id: 1 },
    ]);
  });

  it('applies the siblings of an alias component', () => {
    const schemas: Schemas = {
      Base: {
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'string' } },
      },
      Alias: { ...ref('Base'), required: ['b'] },
    };
    expectParity({ schemas, body: ref('Alias') }, [{}, { b: 'x' }, { a: 'x' }]);
  });
});
