import type { OpenApiDocument, OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  createTestContextSpec,
  createTestGeneratorOptions,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
import {
  dereference,
  generateZodSections,
  generateZodValidationSchemaDefinition,
  parseParameters,
  parseZodValidationSchemaDefinition,
} from './index';
import { areExclusive } from './unsupported';

const HINT = "Set `override.zod.unsupported` to 'warn'";

interface GenOptions {
  unsupported?: 'warn' | 'error';
  strict?: boolean;
  generateXor?: boolean;
  generateDiscriminatedUnion?: boolean;
  coerce?: boolean;
  generateReusableSchemas?: boolean;
  isZodV4?: boolean;
  reusable?: boolean;
  path?: string;
  spec?: Partial<OpenApiDocument>;
}

const gen = (
  schema: OpenApiSchemaObject,
  {
    unsupported = 'error',
    strict = false,
    generateXor = false,
    generateDiscriminatedUnion = false,
    coerce = false,
    generateReusableSchemas = false,
    isZodV4 = true,
    reusable = false,
    path,
    spec,
  }: GenOptions = {},
): string => {
  const context = createTestContextSpec({
    spec,
    output: { packageJson: { dependencies: { zod: '^4.2.0' } } },
  });
  context.output.override.zod = {
    ...context.output.override.zod,
    unsupported,
    generateXor,
    generateDiscriminatedUnion,
    generateReusableSchemas,
    coerce: { ...context.output.override.zod.coerce, response: coerce },
  };
  // Callers inline refs first unless the reusable schemas keep them by name.
  const input = reusable
    ? schema
    : dereference(schema, context, path ?? 'getPetResponse');
  const definition = generateZodValidationSchemaDefinition(
    input,
    context,
    'getPetResponse',
    strict,
    isZodV4,
    { required: true, useReusableSchemas: reusable, path },
  );
  return parseZodValidationSchemaDefinition(
    definition,
    context,
    coerce,
    strict,
    isZodV4,
    undefined,
    undefined,
    'classic',
    false,
    isZodV4,
  ).zod;
};

const nested = (schema: OpenApiSchemaObject): OpenApiSchemaObject => ({
  type: 'object',
  required: ['field'],
  properties: { field: schema },
});

type Case = [name: string, schema: OpenApiSchemaObject, where: string];

const IGNORED: Case[] = [
  ['not', { type: 'string', not: { const: 'a' } }, '`not`'],
  ['if', { type: 'object', if: { type: 'object' } }, '`if`'],
  [
    'patternProperties',
    { type: 'object', patternProperties: { '^a': { type: 'string' } } },
    '`patternProperties`',
  ],
  [
    'propertyNames',
    { type: 'object', propertyNames: { pattern: '^a' } },
    '`propertyNames`',
  ],
  [
    'dependentSchemas',
    { type: 'object', dependentSchemas: { a: { required: ['b'] } } },
    '`dependentSchemas`',
  ],
  [
    'unevaluatedProperties',
    { type: 'object', unevaluatedProperties: false },
    '`unevaluatedProperties`',
  ],
  ['contains', { type: 'array', contains: { type: 'string' } }, '`contains`'],
  ['uniqueItems', { type: 'array', uniqueItems: true }, '`uniqueItems`'],
  ['minProperties', { type: 'object', minProperties: 1 }, '`minProperties`'],
  [
    'dependentRequired without properties',
    { type: 'object', dependentRequired: { a: ['b'] } },
    '`dependentRequired`',
  ],
  [
    'constraints without a type',
    { minLength: 2, pattern: '^a' },
    '`minLength`, `pattern` without a `type`',
  ],
  ['a const object', { const: { a: 1 } }, 'object or array `const`'],
  [
    'oneOf next to allOf',
    {
      allOf: [{ type: 'object', properties: { a: { type: 'string' } } }],
      oneOf: [{ type: 'object' }, { type: 'object' }],
    },
    '`oneOf` next to `allOf`',
  ],
];

describe('override.zod.unsupported', () => {
  describe.each(IGNORED)('%s', (_name, schema, where) => {
    it('fails in error mode, naming the path', () => {
      expect(() => gen(nested(schema))).toThrow(where);
      expect(() => gen(nested(schema))).toThrow('getPetResponse > field');
      expect(() => gen(nested(schema))).toThrow(HINT);
    });

    it('generates silently in warn mode', () => {
      expect(() => gen(nested(schema), { unsupported: 'warn' })).not.toThrow();
    });
  });

  describe('accepted schemas', () => {
    it.each<[string, OpenApiSchemaObject]>([
      [
        'annotations',
        {
          type: 'string',
          title: 'A',
          description: 'd',
          example: 'x',
          deprecated: true,
          readOnly: true,
          nullable: true,
          externalDocs: { url: 'https://example.com' },
        },
      ],
      ['an empty not', { not: {} }],
      [
        'an empty oneOf next to allOf',
        {
          allOf: [{ type: 'object', properties: { a: { type: 'string' } } }],
          oneOf: [],
        },
      ],
      ['uniqueItems false', { type: 'array', uniqueItems: false }],
      [
        'unevaluatedProperties true',
        { type: 'object', unevaluatedProperties: true },
      ],
      [
        'dependentRequired on an object with properties',
        {
          type: 'object',
          properties: { a: { type: 'string' }, b: { type: 'string' } },
          dependentRequired: { a: ['b'] },
        },
      ],
      ['a tuple', { type: 'array', prefixItems: [{ type: 'string' }] }],
      ['an enum without a type', { enum: ['a', 'b'], minLength: 1 }],
      [
        'oneOf of distinct types',
        { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'array' }] },
      ],
      [
        'oneOf of distinct literals',
        { oneOf: [{ const: 'a' }, { const: 'b' }, { type: 'number' }] },
      ],
      ['a nullable oneOf', { oneOf: [{ type: 'string' }, { type: 'null' }] }],
      ['minProperties 0', { type: 'object', minProperties: 0 }],
      ['empty patternProperties', { type: 'object', patternProperties: {} }],
      [
        'a closed object',
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
      [
        'additionalProperties false with strict',
        {
          type: 'object',
          properties: { a: { type: 'string' } },
          additionalProperties: false,
        },
      ],
    ])('%s', (name, schema) => {
      const strict = name.includes('strict');
      expect(gen(nested(schema), { strict })).toBe(
        gen(nested(schema), { strict, unsupported: 'warn' }),
      );
    });

    it('accepts an overlapping oneOf with generateXor', () => {
      const schema: OpenApiSchemaObject = {
        oneOf: [
          { type: 'object', properties: { a: { type: 'string' } } },
          { type: 'object', properties: { b: { type: 'string' } } },
        ],
      };
      expect(() => gen(schema, { generateXor: true })).not.toThrow();
    });
  });

  describe('format', () => {
    it('fails on a format zod does not check', () => {
      expect(() => gen(nested({ type: 'string', format: 'phone' }))).toThrow(
        '`format: phone` is not validated.',
      );
    });

    it('fails on a number format on a string', () => {
      expect(() => gen(nested({ type: 'string', format: 'int64' }))).toThrow(
        '`format: int64` is not validated.',
      );
    });

    it.each<[string, OpenApiSchemaObject]>([
      ['a string format without a type', { format: 'email' }],
      ['a string format on an integer', { type: 'integer', format: 'email' }],
    ])('fails on %s', (_name, schema) => {
      expect(() => gen(nested(schema))).toThrow(
        '`format: email` is not validated.',
      );
    });

    it('fails on a contentEncoding, which zod does not check', () => {
      expect(() =>
        gen(nested({ type: 'string', contentEncoding: 'base64' })),
      ).toThrow('`contentEncoding: base64` is not validated.');
    });

    it.each<[string, OpenApiSchemaObject]>([
      ['a checked format', { type: 'string', format: 'email' }],
      ['a number format', { type: 'integer', format: 'int32' }],
      ['a binary string', { type: 'string', format: 'binary' }],
      [
        'a format next to an enum',
        { type: 'string', format: 'phone', enum: ['1'] },
      ],
    ])('accepts %s', (_name, schema) => {
      expect(() => gen(nested(schema))).not.toThrow();
    });
  });

  describe('oneOf', () => {
    const overlapping: OpenApiSchemaObject = {
      oneOf: [
        { type: 'object', properties: { a: { type: 'string' } } },
        { type: 'object', properties: { b: { type: 'string' } } },
      ],
    };

    it('fails without generateXor, naming it', () => {
      expect(() => gen(overlapping)).toThrow('validated like `anyOf` here');
      expect(() => gen(overlapping)).toThrow(
        'Set `override.zod.generateXor` to check it.',
      );
    });

    it('names no setting for a discriminator', () => {
      const discriminated: OpenApiSchemaObject = {
        ...overlapping,
        discriminator: { propertyName: 'kind' },
      };
      expect(() => gen(discriminated)).toThrow('validated like `anyOf` here');
      expect(() => gen(discriminated)).not.toThrow('Set `override.zod.gen');
    });

    it('accepts distinct discriminator values without the setting', () => {
      const member = (kind: string): OpenApiSchemaObject => ({
        type: 'object',
        required: ['kind'],
        properties: { kind: { const: kind }, x: { type: 'string' } },
      });
      expect(() =>
        gen({
          oneOf: [member('a'), member('b')],
          discriminator: { propertyName: 'kind' },
        }),
      ).not.toThrow();
    });

    it('fails a discriminated union that falls back to a union', () => {
      const shared = (extra: string): OpenApiSchemaObject => ({
        type: 'object',
        required: ['kind'],
        properties: { kind: { const: 'a' }, [extra]: { type: 'string' } },
      });
      expect(() =>
        gen(
          {
            oneOf: [shared('x'), shared('y')],
            discriminator: { propertyName: 'kind' },
          },
          { generateDiscriminatedUnion: true },
        ),
      ).toThrow('validated like `anyOf` here');
    });

    it('fails a union kept by coercion', () => {
      const coerced: OpenApiSchemaObject = {
        oneOf: [
          { type: 'object', properties: { a: { type: 'number' } } },
          { type: 'object', properties: { b: { type: 'number' } } },
        ],
      };
      expect(() => gen(coerced, { generateXor: true })).not.toThrow();
      expect(() => gen(coerced, { generateXor: true, coerce: true })).toThrow(
        '`oneOf` with a coerced alternative is validated like `anyOf`',
      );
    });

    it('does not suggest generateXor where zod.xor does not exist', () => {
      expect(() => gen(overlapping, { isZodV4: false })).toThrow(
        'validated like `anyOf` here',
      );
      expect(() => gen(overlapping, { isZodV4: false })).not.toThrow(
        'generateXor',
      );
    });

    it('counts null on alternatives that accept it', () => {
      expect(() =>
        gen(
          { oneOf: [{ type: ['string', 'null'] }, { type: 'null' }] },
          { generateXor: true, isZodV4: false },
        ),
      ).toThrow('validated like `anyOf` here');
    });

    it('fails on an unknown alternative next to null', () => {
      expect(() =>
        gen({ oneOf: [{}, { type: 'null' }] }, { isZodV4: false }),
      ).toThrow('validated like `anyOf` here');
    });

    it('accepts an alternative that accepts nothing next to null', () => {
      expect(() =>
        gen({ oneOf: [false, { type: 'null' }] }, { isZodV4: false }),
      ).not.toThrow();
      expect(() =>
        gen({ oneOf: [{ not: {} }, { type: 'null' }] }, { isZodV4: false }),
      ).not.toThrow();
    });

    it('fails on distinct discriminators when two members accept null', () => {
      const member = (kind: string): OpenApiSchemaObject => ({
        type: ['object', 'null'],
        required: ['kind'],
        properties: { kind: { const: kind } },
      });
      expect(() =>
        gen({
          oneOf: [member('a'), member('b')],
          discriminator: { propertyName: 'kind' },
        }),
      ).toThrow('validated like `anyOf` here');
    });

    it('fails when generateXor cannot be applied', () => {
      expect(() =>
        gen(overlapping, { generateXor: true, isZodV4: false }),
      ).toThrow('validated like `anyOf` here');
    });

    it('fails when generateXor falls back because a branch renders loosely', () => {
      const loose: OpenApiSchemaObject = {
        oneOf: [{ required: ['a'] }, { required: ['b'] }],
      };
      expect(() => gen(loose, { generateXor: true })).toThrow(
        'validated like `anyOf` here',
      );
    });
  });

  describe('strict allOf merge', () => {
    it('fails on a property declared by several members', () => {
      const schema: OpenApiSchemaObject = {
        allOf: [
          {
            type: 'object',
            properties: { a: { type: 'string', minLength: 3 } },
          },
          { type: 'object', properties: { a: { type: 'string' } } },
        ],
      };
      expect(() => gen(schema, { strict: true })).toThrow('Property `a`');
      expect(() => gen(schema, { strict: true })).toThrow('At getPetResponse.');
    });

    it('accepts members with distinct properties', () => {
      const schema: OpenApiSchemaObject = {
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } } },
          { type: 'object', properties: { b: { type: 'string' } } },
        ],
      };
      expect(() => gen(schema, { strict: true })).not.toThrow();
    });

    it('accepts a property declared alike by several members', () => {
      const id: OpenApiSchemaObject = { type: 'string', default: 'x' };
      const schema: OpenApiSchemaObject = {
        allOf: [
          { type: 'object', properties: { id } },
          { type: 'object', properties: { id } },
        ],
      };
      expect(() => gen(schema, { strict: true })).not.toThrow();
    });

    it('keeps the refinement of a member', () => {
      const schema: OpenApiSchemaObject = {
        allOf: [
          {
            type: 'object',
            properties: { a: { type: 'string' }, b: { type: 'string' } },
            dependentRequired: { a: ['b'] },
          },
          { type: 'object', properties: { c: { type: 'string' } } },
        ],
      };
      expect(() => gen(schema, { strict: true })).not.toThrow();
    });

    it('fails on a discriminated union member that loses a definition', () => {
      const schema: OpenApiSchemaObject = {
        oneOf: [
          {
            allOf: [
              {
                type: 'object',
                properties: { name: { type: 'string', minLength: 3 } },
              },
              {
                type: 'object',
                required: ['kind'],
                properties: { kind: { const: 'a' }, name: { type: 'string' } },
              },
            ],
          },
          {
            type: 'object',
            required: ['kind'],
            properties: { kind: { const: 'b' } },
          },
        ],
        discriminator: { propertyName: 'kind' },
      };
      expect(() => gen(schema, { generateDiscriminatedUnion: true })).toThrow(
        'Property `name`',
      );
    });

    it('accepts a literal that narrows a plain type', () => {
      const schema: OpenApiSchemaObject = {
        oneOf: [
          {
            allOf: [
              { type: 'object', properties: { kind: { type: 'string' } } },
              {
                type: 'object',
                required: ['kind'],
                properties: { kind: { const: 'a' } },
              },
            ],
          },
          {
            type: 'object',
            required: ['kind'],
            properties: { kind: { const: 'b' } },
          },
        ],
        discriminator: { propertyName: 'kind' },
      };
      expect(() =>
        gen(schema, { generateDiscriminatedUnion: true }),
      ).not.toThrow();
    });

    it('accepts a literal that narrows an enum', () => {
      const schema: OpenApiSchemaObject = {
        allOf: [
          {
            type: 'object',
            properties: { kind: { type: 'string', enum: ['cat', 'dog'] } },
          },
          { type: 'object', properties: { kind: { const: 'cat' } } },
        ],
      };
      expect(() => gen(schema, { strict: true })).not.toThrow();
    });

    it.each<[string, OpenApiSchemaObject, OpenApiSchemaObject]>([
      [
        'a wider enum',
        { type: 'string', enum: ['a'] },
        { type: 'string', enum: ['a', 'b'] },
      ],
      ['a disjoint enum', { type: 'string', enum: ['a'] }, { enum: ['b'] }],
      [
        'a literal over a constrained type',
        { type: 'string', minLength: 3 },
        { const: 'a' },
      ],
    ])('fails on %s', (_name, first, second) => {
      const schema: OpenApiSchemaObject = {
        allOf: [
          { type: 'object', properties: { kind: first } },
          { type: 'object', properties: { kind: second } },
        ],
      };
      expect(() => gen(schema, { strict: true })).toThrow('Property `kind`');
    });

    it.each<[string, OpenApiSchemaObject, OpenApiSchemaObject]>([
      [
        'a nullable literal over a non-null enum',
        { type: 'string', enum: ['a', 'b'] },
        { type: ['string', 'null'], enum: ['a'] },
      ],
      [
        'a literal of another type',
        { type: 'string' },
        { type: 'integer', const: 1 },
      ],
    ])('fails on %s', (_name, first, second) => {
      const schema: OpenApiSchemaObject = {
        allOf: [
          { type: 'object', properties: { kind: first } },
          { type: 'object', properties: { kind: second } },
        ],
      };
      expect(() => gen(schema, { strict: true })).toThrow('Property `kind`');
    });

    it.each(["it's", 'say "hi"', 'tab\there', 'line break'])(
      'accepts a literal %j within an enum',
      (value) => {
        const schema: OpenApiSchemaObject = {
          allOf: [
            {
              type: 'object',
              properties: { kind: { type: 'string', enum: [value, 'b'] } },
            },
            { type: 'object', properties: { kind: { const: value } } },
          ],
        };
        expect(() => gen(schema, { strict: true })).not.toThrow();
      },
    );

    it('ignores a description that differs', () => {
      const schema: OpenApiSchemaObject = {
        allOf: [
          {
            type: 'object',
            properties: { a: { type: 'string', description: 'one' } },
          },
          {
            type: 'object',
            properties: { a: { type: 'string', description: 'two' } },
          },
        ],
      };
      expect(() => gen(schema, { strict: true })).not.toThrow();
    });

    it('is not checked without strict', () => {
      const schema: OpenApiSchemaObject = {
        allOf: [
          {
            type: 'object',
            properties: { a: { type: 'string', minLength: 3 } },
          },
          { type: 'object', properties: { a: { type: 'string' } } },
        ],
      };
      expect(() => gen(schema)).not.toThrow();
    });
  });

  describe('paths', () => {
    it('names properties, items, additionalProperties and members', () => {
      const schema: OpenApiSchemaObject = {
        type: 'object',
        properties: {
          owner: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: { type: 'string', not: { const: 'x' } },
              },
            },
          },
        },
      };
      expect(() => gen(schema)).toThrow(
        'getPetResponse > owner > tags > items',
      );
      expect(() =>
        gen({
          type: 'object',
          properties: { a: { type: 'string' } },
          additionalProperties: { type: 'string', uniqueItems: true },
        }),
      ).toThrow('getPetResponse > additionalProperties');
      expect(() =>
        gen({
          allOf: [
            { type: 'string' },
            { type: 'string', pattern: '(', not: { const: 'a' } },
          ],
        }),
      ).toThrow('getPetResponse > allOf[1]');
    });

    it('starts from the given root', () => {
      expect(() =>
        gen(nested({ type: 'string', not: { const: 'a' } }), {
          path: '#/components/schemas/Pet',
        }),
      ).toThrow('At #/components/schemas/Pet > field.');
    });
  });

  describe('parameters', () => {
    const spec: Partial<OpenApiDocument> = {
      components: {
        schemas: {
          Tag: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
      },
    };
    const parse = (generateQuery: boolean, location: 'query' | 'cookie') => {
      const context = createTestContextSpec({ spec });
      context.output.override.zod = {
        ...context.output.override.zod,
        unsupported: 'error',
      };
      const flags = {
        param: true,
        query: generateQuery,
        header: true,
        body: true,
        response: true,
      };
      return () =>
        parseParameters({
          data: [
            {
              name: 'tag',
              in: location,
              schema: { $ref: '#/components/schemas/Tag' },
            },
          ],
          context,
          operationName: 'getPet',
          isZodV4: true,
          strict: { ...flags, query: false },
          generate: flags,
        });
    };

    it('reports a generated parameter', () => {
      expect(parse(true, 'query')).toThrow('`uniqueItems`');
    });

    it('skips a location that is not generated', () => {
      expect(parse(false, 'query')).not.toThrow();
      expect(parse(true, 'cookie')).not.toThrow();
    });
  });

  describe('refs', () => {
    it('fails on a $dynamicRef that resolves to nothing', () => {
      expect(() =>
        gen({
          type: 'object',
          properties: { x: { $dynamicRef: '#nothing' } },
        }),
      ).toThrow('$dynamicRef "#nothing" is validated as unknown.');
    });

    const spec: Partial<OpenApiDocument> = {
      components: {
        schemas: {
          Node: {
            type: 'object',
            properties: { next: { $ref: '#/components/schemas/Node' } },
          },
        },
      },
    };

    it('fails on a cycle reusable schemas would keep, naming them', () => {
      expect(() =>
        gen({ $ref: '#/components/schemas/Node' }, { spec }),
      ).toThrow(
        'Set `override.zod.generateReusableSchemas` to keep the cycle.',
      );
    });

    it('fails on a cycle inlined with reusable schemas on', () => {
      expect(() =>
        gen(
          { $ref: '#/components/schemas/Node' },
          { spec, generateReusableSchemas: true },
        ),
      ).toThrow('Circular $ref "#/components/schemas/Node"');
    });

    it('names the chain of refs being expanded', () => {
      expect(() =>
        gen(
          { $ref: '#/components/schemas/Node' },
          { spec, generateReusableSchemas: true },
        ),
      ).toThrow(
        'getPetResponse > #/components/schemas/Node > #/components/schemas/Node',
      );
    });

    it('does not fail on a circular ref kept by name', () => {
      expect(() =>
        gen({ $ref: '#/components/schemas/Node' }, { spec, reusable: true }),
      ).not.toThrow();
    });

    it('fails on an unresolvable ref', () => {
      expect(() =>
        gen(nested({ $ref: '#/components/schemas/Missing' }), { spec }),
      ).toThrow('Unresolvable $ref "#/components/schemas/Missing"');
    });

    it('still dereferences quietly in warn mode after an error run', () => {
      const context = createTestContextSpec({ spec });
      const run = (unsupported: 'warn' | 'error') => {
        context.output.override.zod = {
          ...context.output.override.zod,
          generateReusableSchemas: true,
          unsupported,
        };
        return dereference({ $ref: '#/components/schemas/Node' }, context);
      };
      expect(() => run('warn')).not.toThrow();
      expect(() => run('error')).toThrow('Circular $ref');
      expect(() => run('warn')).not.toThrow();
    });
  });
});

describe('override.zod.unsupported edge cases', () => {
  it('checks the format of a type array against every type', () => {
    expect(() =>
      gen(nested({ type: ['string', 'integer'], format: 'int64' })),
    ).not.toThrow();
    expect(() =>
      gen(nested({ type: ['string', 'integer'], format: 'email' })),
    ).not.toThrow();
    expect(() =>
      gen(nested({ type: ['string', 'integer'], format: 'phone' })),
    ).toThrow('`format: phone` is not validated.');
  });

  it('accepts a discriminated oneOf next to a null-only alternative', () => {
    const member = (kind: string): OpenApiSchemaObject => ({
      type: 'object',
      required: ['kind'],
      properties: { kind: { const: kind } },
    });
    expect(() =>
      gen({
        oneOf: [member('cat'), member('dog'), { type: 'null' }],
        discriminator: { propertyName: 'kind' },
      }),
    ).not.toThrow();
  });

  it.each<[string, OpenApiSchemaObject]>([
    ['a const null', { oneOf: [{ const: null }, { type: 'null' }] }],
    [
      'an enum with null',
      { oneOf: [{ type: 'string', enum: ['a', null] }, { type: 'null' }] },
    ],
  ])('fails on %s next to a null-only alternative', (_name, schema) => {
    expect(() => gen(schema, { isZodV4: false })).toThrow(
      'validated like `anyOf` here',
    );
  });

  it.each<[string, OpenApiSchemaObject]>([
    [
      'a nullable alternative that accepts nothing',
      { oneOf: [{ not: {}, type: ['string', 'null'] }, { type: 'null' }] },
    ],
  ])('accepts %s', (_name, schema) => {
    expect(() => gen(schema, { isZodV4: false })).not.toThrow();
  });

  it('does not treat not: true as accepting nothing', () => {
    expect(
      areExclusive([{ type: 'string', not: true }, { type: 'string' }]),
    ).toBe(false);
    expect(
      areExclusive([{ type: 'string', not: {} }, { type: 'string' }]),
    ).toBe(true);
  });

  it('accepts a null-only alternative that accepts nothing', () => {
    expect(
      areExclusive([{ type: 'null', not: {} }, { type: ['string', 'null'] }]),
    ).toBe(true);
  });

  it('fails on a branch not that forbids keys only together', () => {
    expect(() =>
      gen({
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'integer' },
          c: { type: 'integer' },
        },
        anyOf: [
          { required: ['a'], not: { anyOf: [{ required: ['b', 'c'] }] } },
          { required: ['b'] },
        ],
      }),
    ).toThrow('`not` other than forbidden keys is not validated.');
  });

  it('accepts an annotated forbidden-keys not', () => {
    expect(() =>
      gen({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'integer' } },
        anyOf: [
          { required: ['a'], not: { required: ['b'], description: 'x' } },
          { required: ['b'] },
        ],
      }),
    ).not.toThrow();
  });

  it('fails on an items list', () => {
    expect(() =>
      gen(
        nested({
          type: 'array',
          items: [{ type: 'string' }, { type: 'integer' }],
        } as unknown as OpenApiSchemaObject),
      ),
    ).toThrow('`items` as a list is not validated.');
  });

  it('fails on a typed additionalProperties merged with an open member', () => {
    const schema: OpenApiSchemaObject = {
      allOf: [
        {
          type: 'object',
          properties: { a: { type: 'string' } },
          additionalProperties: { type: 'string' },
        },
        {
          type: 'object',
          properties: { b: { type: 'string' } },
          additionalProperties: true,
        },
      ],
    };
    expect(() => gen(schema, { strict: true })).toThrow(
      'different `additionalProperties`',
    );
  });

  it.each<[string, OpenApiSchemaObject]>([
    [
      'an open',
      {
        type: 'object',
        properties: { a: { type: 'string' } },
        additionalProperties: true,
      },
    ],
    [
      'a typed',
      {
        type: 'object',
        properties: { a: { type: 'string' } },
        additionalProperties: { type: 'string' },
      },
    ],
  ])(
    'accepts %s additionalProperties next to a plain member in strict mode',
    (_name, member) => {
      const schema: OpenApiSchemaObject = {
        allOf: [
          member,
          { type: 'object', properties: { b: { type: 'string' } } },
        ],
      };
      expect(() => gen(schema, { strict: true })).not.toThrow();
    },
  );

  it('fails on a forbidden key without a sibling property', () => {
    expect(() =>
      gen({
        type: 'object',
        properties: { x: { type: 'string' }, y: { type: 'string' } },
        anyOf: [
          { required: ['x'], not: { required: ['z'] } },
          { required: ['y'] },
        ],
      }),
    ).toThrow('`not` forbids a key that has no sibling property');
  });

  it('accepts not: false on a property', () => {
    expect(() =>
      gen({
        type: 'object',
        properties: { a: { type: 'string', not: false } },
      } as unknown as OpenApiSchemaObject),
    ).not.toThrow();
  });

  it('does not suggest generateXor when a branch keeps the union anyway', () => {
    let message = '';
    try {
      gen({ oneOf: [{ type: 'string' }, {}] });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('`oneOf` is validated like `anyOf`');
    expect(message).not.toContain('generateXor');
  });

  it('fails on a not that the sibling-properties rewrite drops', () => {
    expect(() =>
      gen({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'integer' } },
        anyOf: [
          { required: ['a'], not: { properties: { b: { const: 1 } } } },
          { required: ['b'] },
        ],
      }),
    ).toThrow('`not` other than forbidden keys is not validated.');
  });

  it('accepts the forbidden-keys form of not', () => {
    expect(() =>
      gen({
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'integer' } },
        anyOf: [
          { required: ['a'], not: { required: ['b'] } },
          { required: ['b'], not: { anyOf: [{ required: ['a'] }] } },
        ],
      }),
    ).not.toThrow();
  });

  it('fails on a strict allOf merge with different additionalProperties', () => {
    const schema: OpenApiSchemaObject = {
      allOf: [
        {
          type: 'object',
          properties: { a: { type: 'string' } },
          additionalProperties: { type: 'string' },
        },
        {
          type: 'object',
          properties: { b: { type: 'string' } },
          additionalProperties: { type: 'integer' },
        },
      ],
    };
    expect(() => gen(schema, { strict: true })).toThrow(
      'different `additionalProperties`',
    );
  });

  it('fails on a tuple at the root of a response', async () => {
    const run = () =>
      generateZodSections(
        createTestGeneratorVerbOptions({
          pathRoute: '/pets',
          verb: 'get',
          operationName: 'listPets',
          typeName: 'listPets',
          override: {
            zod: {
              generate: {
                param: true,
                query: true,
                header: true,
                body: true,
                response: true,
              },
            },
          },
        }),
        createTestGeneratorOptions({
          pathRoute: '/pets',
          context: {
            spec: {
              paths: {
                '/pets': {
                  get: {
                    operationId: 'listPets',
                    responses: {
                      '200': {
                        description: 'OK',
                        content: {
                          'application/json': {
                            schema: {
                              type: 'array',
                              prefixItems: [{ type: 'string' }],
                              items: { type: 'integer' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          override: { zod: { unsupported: 'error' } },
        }),
      );
    await expect(run()).rejects.toThrow('A tuple at the root');
  });
});
