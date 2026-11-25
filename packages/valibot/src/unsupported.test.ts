import type { OpenApiSchemaObject } from '@orval/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { logger, resetWarnings, setUnsupportedMode } from './logger';
import { parseBodyAndResponse } from './operation';
import { generateValibotValidationSchemaDefinition } from './schema';
import { generateValibotSchemasModule } from './schemas-module';
import { gen } from './test-helpers';

const HINT = "Set `override.valibot.unsupported` to 'warn'";

type Case = [name: string, schema: OpenApiSchemaObject, where: string];

const nested = (schema: OpenApiSchemaObject): OpenApiSchemaObject => ({
  type: 'object',
  required: ['field'],
  properties: { field: schema },
});

// Findings that already log a warning in the default mode.
const WARNED: Case[] = [
  [
    'a prefixItems tuple',
    { type: 'array', prefixItems: [{ type: 'string' }] },
    'prefixItems',
  ],
  [
    'a non-integer multipleOf',
    { type: 'number', multipleOf: 0.01 },
    'multipleOf',
  ],
  [
    'a pattern JavaScript cannot compile',
    { type: 'string', pattern: '(?i)a' },
    'not a JavaScript RegExp',
  ],
  ['a const object', { const: { a: 1 } }, '`const`'],
  ['a structured enum', { enum: ['a', { b: 1 }] }, '`enum`'],
];

// Findings that are silent in the default mode.
const SILENT: Case[] = [
  [
    'oneOf alternatives that can overlap',
    { oneOf: [{ type: 'object' }, { type: 'object', properties: {} }] },
    '`oneOf`',
  ],
  [
    'a strict object inside allOf',
    {
      allOf: [
        { type: 'object', properties: { a: { type: 'string' } } },
        { type: 'object', properties: { b: { type: 'string' } } },
      ],
    },
    'strict object',
  ],
  [
    'a strict object next to allOf and anyOf',
    {
      allOf: [{ type: 'object', properties: { a: { type: 'string' } } }],
      anyOf: [
        { type: 'object', properties: { b: { type: 'string' } } },
        { type: 'object', properties: { c: { type: 'string' } } },
      ],
    },
    'strict object',
  ],
  [
    'a strict object next to anyOf with own properties',
    {
      type: 'object',
      properties: { a: { type: 'string' } },
      anyOf: [
        { type: 'object', properties: { b: { type: 'string' } } },
        { type: 'object', properties: { c: { type: 'string' } } },
      ],
    },
    'strict object',
  ],
  [
    'two oneOf alternatives that both accept null',
    { oneOf: [{ type: ['string', 'null'] }, { type: 'null' }] },
    '`oneOf`',
  ],
  ['a not schema', { type: 'string', not: { const: 'a' } }, '`not`'],
  [
    'if/then/else',
    { type: 'object', if: { type: 'object' }, else: { type: 'object' } },
    '`if`',
  ],
  [
    'patternProperties',
    { type: 'object', patternProperties: { '^a': { type: 'string' } } },
    '`patternProperties`',
  ],
  [
    'propertyNames',
    { type: 'object', propertyNames: { maxLength: 3 } },
    '`propertyNames`',
  ],
  [
    'dependentRequired',
    { type: 'object', dependentRequired: { a: ['b'] } },
    '`dependentRequired`',
  ],
  ['contains', { type: 'array', contains: { type: 'string' } }, '`contains`'],
  ['uniqueItems', { type: 'array', uniqueItems: true }, '`uniqueItems`'],
  ['minProperties', { type: 'object', minProperties: 1 }, '`minProperties`'],
  [
    'unevaluatedProperties',
    { type: 'object', unevaluatedProperties: false },
    '`unevaluatedProperties`',
  ],
  ['a constraint without a type', { minimum: 3 }, '`minimum` without a `type`'],
  [
    'a format valibot does not check',
    { type: 'string', format: 'phone' },
    '`format: phone`',
  ],
  [
    'a number format on a string',
    { type: 'string', format: 'int64' },
    '`format: int64`',
  ],
  [
    'a contentEncoding other than base64',
    { type: 'string', contentEncoding: 'base32' },
    '`contentEncoding: base32`',
  ],
  [
    'a string format on a schema without a type',
    { format: 'email' },
    '`format: email`',
  ],
  [
    'a string format on a number',
    { type: 'integer', format: 'email' },
    '`format: email`',
  ],
  [
    'an alternative of unknown type next to null',
    { oneOf: [true, { type: 'null' }] },
    '`oneOf`',
  ],
  [
    'two nullable alternatives told apart by a discriminator',
    {
      oneOf: ['a', 'b'].map((kind) => ({
        type: ['object', 'null'],
        required: ['kind'],
        properties: { kind: { const: kind } },
      })),
      discriminator: { propertyName: 'kind' },
    },
    '`oneOf`',
  ],
  [
    'a variant whose options share a discriminator value',
    {
      oneOf: ['x', 'y'].map((name) => ({
        type: 'object',
        required: ['kind'],
        properties: { kind: { const: 'a' }, [name]: { type: 'string' } },
      })),
      discriminator: { propertyName: 'kind' },
    },
    '`oneOf`',
  ],
];

const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

beforeEach(() => {
  resetWarnings();
  warn.mockClear();
});

const STRICT_CASES = new Set([
  'a strict object inside allOf',
  'a strict object next to allOf and anyOf',
  'a strict object next to anyOf with own properties',
]);
const optionsFor = (name: string) =>
  STRICT_CASES.has(name) ? ({ strict: true } as const) : {};

describe('unsupported: error', () => {
  it.each([...WARNED, ...SILENT])('throws for %s', (name, schema, where) => {
    expect(() =>
      gen(schema, { ...optionsFor(name), unsupported: 'error' }),
    ).toThrow(where);
    expect(() =>
      gen(schema, { ...optionsFor(name), unsupported: 'error' }),
    ).toThrow(HINT);
  });

  it('names the path down to the schema', () => {
    expect(() =>
      gen(
        {
          type: 'object',
          properties: { tags: nested({ not: { type: 'string' } }) },
        },
        { unsupported: 'error', path: 'getPet response' },
      ),
    ).toThrow('At getPet response > tags > field.');
  });

  it('names array items, additional properties and composition members', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        list: { type: 'array', items: { not: { type: 'string' } } },
      },
    };
    expect(() => gen(schema, { unsupported: 'error', path: 'A' })).toThrow(
      'At A > list > items.',
    );
    expect(() =>
      gen(
        { allOf: [{ type: 'string' }, { not: { type: 'string' } }] },
        { unsupported: 'error', path: 'A' },
      ),
    ).toThrow('At A > allOf[1].');
    expect(() =>
      gen(
        {
          type: 'object',
          additionalProperties: { type: 'array', uniqueItems: true },
        },
        { unsupported: 'error', path: 'A' },
      ),
    ).toThrow('At A > additionalProperties.');
  });

  it.each<[string, OpenApiSchemaObject]>([
    [
      'a oneOf of distinct types',
      { oneOf: [{ type: 'string' }, { type: 'number' }] },
    ],
    ['a nullable oneOf', { oneOf: [{ type: 'string' }, { type: 'null' }] }],
    [
      'a oneOf of distinct constants',
      { oneOf: [{ const: 'a' }, { const: 'b' }, { const: 1 }] },
    ],
    ['an open object', { type: 'object', additionalProperties: true }],
    [
      'annotations',
      {
        type: 'string',
        title: 'T',
        description: 'D',
        example: 'x',
        deprecated: true,
      },
    ],
    ['uniqueItems false', { type: 'array', uniqueItems: false }],
    ['a checked format', { type: 'string', format: 'email' }],
    ['base64 content', { type: 'string', contentEncoding: 'base64' }],
    ['an integer format', { type: 'integer', format: 'int64' }],
    [
      'a format next to an enum',
      { type: 'string', format: 'phone', enum: ['1'] },
    ],
    [
      'a oneOf of a string and an object',
      {
        oneOf: [
          { type: 'string' },
          { type: 'object', properties: { a: { type: 'string' } } },
        ],
      },
    ],
    ['minProperties 0', { type: 'object', minProperties: 0 }],
    ['empty patternProperties', { type: 'object', patternProperties: {} }],
    [
      'additionalProperties false without strict',
      {
        type: 'object',
        properties: { a: { type: 'string' } },
        additionalProperties: false,
      },
    ],
    [
      'a discriminator mapping',
      {
        oneOf: [
          {
            type: 'object',
            required: ['kind'],
            properties: { kind: { const: 'a' } },
          },
          {
            type: 'object',
            required: ['kind'],
            properties: { kind: { const: 'b' } },
          },
        ],
        discriminator: {
          propertyName: 'kind',
          mapping: { a: '#/components/schemas/A' },
        },
      },
    ],
  ])('accepts %s', (_name, schema) => {
    expect(() => gen(schema, { unsupported: 'error' })).not.toThrow();
  });

  it('leaves a format mapped by formatType to it', () => {
    const context = createTestContextSpec({
      output: {
        override: {
          formatType: { phone: { type: 'Phone', decode: 'toPhone' } },
          valibot: { unsupported: 'error' },
        },
      },
    });
    expect(() =>
      generateValibotValidationSchemaDefinition(
        { type: 'string', format: 'phone' },
        context,
        false,
        { required: true },
      ),
    ).not.toThrow();
  });

  it('keeps a default that does not fit as a warning', () => {
    expect(() =>
      gen(
        { type: 'number', default: 'NaN' },
        { required: false, unsupported: 'error' },
      ),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      'The default "NaN" does not fit a number, it is left out.',
    );
  });
});

describe('unsupported: warn', () => {
  it.each(WARNED)('warns for %s without the path', (_name, schema, where) => {
    expect(() => gen(schema, { path: 'A' })).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(where));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('At A'));
  });

  it.each(SILENT)('stays quiet for %s', (name, schema) => {
    expect(() => gen(schema, optionsFor(name))).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('unsupported: entry points', () => {
  afterEach(() => {
    setUnsupportedMode('warn');
  });

  it('names the operation and site of a response', () => {
    const parse = (unsupported: 'warn' | 'error') =>
      parseBodyAndResponse({
        data: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { a: { type: 'array', uniqueItems: true } },
              },
            },
          },
        },
        context: createTestContextSpec({
          output: { override: { valibot: { unsupported } } },
        }),
        strict: false,
        generate: true,
        isRequest: false,
        operation: 'getPet',
      });
    expect(() => parse('warn')).not.toThrow();
    expect(() => parse('error')).toThrow('At getPet response > a.');
  });

  it('fails a component of the schemas module with its pointer', () => {
    const { spec, target, output } = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: { tag: { type: 'string', not: { const: 'a' } } },
            },
          },
        },
      },
      output: {
        schemas: { path: './model', type: 'valibot', splitByTags: false },
        override: { valibot: { unsupported: 'error' } },
      },
    });
    expect(() =>
      generateValibotSchemasModule(
        { spec, target, schemas: [], verbOptions: {} },
        output,
        '',
      ),
    ).toThrow('At #/components/schemas/Pet > tag.');
  });

  const generateModule = (schemas: Record<string, OpenApiSchemaObject>) => {
    const { spec, target, output } = createTestContextSpec({
      spec: { components: { schemas } },
      output: {
        schemas: { path: './model', type: 'valibot', splitByTags: false },
        override: { valibot: { unsupported: 'error' } },
      },
    });
    return () =>
      generateValibotSchemasModule(
        { spec, target, schemas: [], verbOptions: {} },
        output,
        '',
      );
  };

  it('tells referenced oneOf alternatives apart', () => {
    expect(
      generateModule({
        Color: { type: 'string', enum: ['red', 'blue'] },
        Size: { type: 'number', enum: [1, 2] },
        Holder: {
          oneOf: [
            { $ref: '#/components/schemas/Color' },
            { $ref: '#/components/schemas/Size' },
          ],
        },
      }),
    ).not.toThrow();
  });

  it('tells annotated and typeless referenced alternatives apart', () => {
    expect(
      generateModule({
        A: { type: 'string' },
        Cat: { properties: { a: { type: 'string' } } },
        Holder: {
          oneOf: [
            { $ref: '#/components/schemas/A', description: 'x' },
            { $ref: '#/components/schemas/Cat' },
          ],
        },
      }),
    ).not.toThrow();
  });

  it('narrows an inherited discriminator enum by the member const', () => {
    const member = (kind: string): OpenApiSchemaObject => ({
      allOf: [
        { $ref: '#/components/schemas/PetBase' },
        { type: 'object', properties: { kind: { const: kind } } },
      ],
    });
    expect(
      generateModule({
        PetBase: {
          type: 'object',
          properties: { kind: { type: 'string', enum: ['cat', 'dog'] } },
        },
        Cat: member('cat'),
        Dog: member('dog'),
        Pet: {
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
          discriminator: { propertyName: 'kind' },
        },
      }),
    ).not.toThrow();
  });

  it('reads a discriminator through nested allOf members', () => {
    const chain = (kind: string): Record<string, OpenApiSchemaObject> => ({
      [kind]: { allOf: [{ $ref: `#/components/schemas/${kind}Mid` }] },
      [`${kind}Mid`]: { allOf: [{ $ref: `#/components/schemas/${kind}Base` }] },
      [`${kind}Base`]: {
        type: 'object',
        required: ['kind'],
        properties: { kind: { const: kind } },
      },
    });
    expect(
      generateModule({
        ...chain('Cat'),
        ...chain('Dog'),
        Pet: {
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
          discriminator: { propertyName: 'kind' },
        },
      }),
    ).not.toThrow();
  });

  it('fails when a member const leaves the discriminators overlapping', () => {
    const member = (kind: string): OpenApiSchemaObject => ({
      allOf: [
        { $ref: '#/components/schemas/PetBase' },
        { type: 'object', properties: { kind: { const: kind } } },
      ],
    });
    expect(
      generateModule({
        PetBase: {
          type: 'object',
          properties: { kind: { type: 'string', enum: ['cat', 'dog'] } },
        },
        Cat: member('cat'),
        Dog: member('cat'),
        Pet: {
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
          discriminator: { propertyName: 'kind' },
        },
      }),
    ).toThrow('`oneOf`');
  });

  it('fails a referenced alternative generated as unknown', () => {
    expect(
      generateModule({
        Labels: { additionalProperties: { type: 'string' } },
        Holder: {
          oneOf: [{ $ref: '#/components/schemas/Labels' }, { type: 'string' }],
        },
      }),
    ).toThrow('`oneOf`');
  });

  it('reads a discriminator through a referenced allOf member', () => {
    expect(
      generateModule({
        CatBase: { type: 'object', properties: { kind: { const: 'cat' } } },
        DogBase: { type: 'object', properties: { kind: { const: 'dog' } } },
        Cat: { allOf: [{ $ref: '#/components/schemas/CatBase' }] },
        Dog: { allOf: [{ $ref: '#/components/schemas/DogBase' }] },
        Pet: {
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
          discriminator: { propertyName: 'kind' },
        },
      }),
    ).not.toThrow();
  });

  it('tells referenced alternatives apart by their discriminator', () => {
    expect(
      generateModule({
        Base: { type: 'object', properties: { kind: { type: 'string' } } },
        Cat: {
          allOf: [
            { $ref: '#/components/schemas/Base' },
            { type: 'object', properties: { kind: { const: 'cat' } } },
          ],
        },
        Dog: {
          type: 'object',
          required: ['kind'],
          properties: { kind: { const: 'dog' } },
        },
        Pet: {
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
          discriminator: { propertyName: 'kind' },
        },
      }),
    ).not.toThrow();
  });

  it('fails on a cycle reusable schemas would keep, with a hint', () => {
    const context = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Node: {
              type: 'object',
              properties: { next: { $ref: '#/components/schemas/Node' } },
            },
          },
        },
      },
      output: { override: { valibot: { unsupported: 'error' } } },
    });
    expect(() =>
      parseBodyAndResponse({
        data: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Node' },
            },
          },
        },
        context,
        strict: false,
        generate: true,
        isRequest: false,
        operation: 'getNode',
      }),
    ).toThrow(
      'Set `override.valibot.generateReusableSchemas` to keep the cycle.',
    );
  });

  it('fails referenced oneOf alternatives that can overlap', () => {
    expect(
      generateModule({
        Cat: { type: 'object', properties: { a: { type: 'string' } } },
        Dog: { type: 'object', properties: { b: { type: 'string' } } },
        Pet: {
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
        },
      }),
    ).toThrow('At #/components/schemas/Pet.');
  });
});
