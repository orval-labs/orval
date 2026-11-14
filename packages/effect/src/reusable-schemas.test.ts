import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { generateEffectComponents } from './reusable-schemas';
import { generateEffectSchemasInline } from './schemas-inline';
import {
  declaredTypeErrors,
  generateModule,
  generateOperation,
  ref,
  type Scenario,
  type Schemas,
} from './test-helpers';

const contextOf = (
  schemas: Schemas,
  effect = {},
  version: 3 | 4 = 4,
  override = {},
) =>
  createTestContextSpec({
    spec: {
      components: { schemas },
    },
    output: {
      override: {
        effect: { version, generateReusableSchemas: true, ...effect },
        ...override,
      },
    },
  });

const components = (
  schemas: Schemas,
  effect = {},
  version: 3 | 4 = 4,
  override = {},
) =>
  generateEffectComponents(
    contextOf(schemas, effect, version, override),
    new Set(Object.keys(schemas)),
  );

const declaredNames = (text: string): string[] =>
  [...text.matchAll(/^export const (\w+)/gm)].map(([, name]) => name);

describe('component constants', () => {
  it('declares a constant after the ones it reads', () => {
    const text = components({
      Pet: { type: 'object', properties: { owner: ref('Owner') } },
      Owner: { type: 'object', properties: { id: { type: 'string' } } },
    });
    expect(text.indexOf('export const Owner')).toBeLessThan(
      text.indexOf('export const Pet'),
    );
    expect(text).toContain('"owner": S.optional(Owner)');
  });

  it('is empty without components', () => {
    expect(components({})).toBe('');
  });

  it('reads the reference that closes a cycle through S.suspend', () => {
    const text = components({
      Tree: {
        type: 'object',
        properties: { children: { type: 'array', items: ref('Tree') } },
      },
    });
    expect(text).toContain('S.suspend((): S.Codec<Tree, TreeEncoded> => Tree)');
    expect(text).toContain('export type Tree = {');
    expect(text).toContain('export type TreeEncoded = {');
  });

  it('types the suspended reference for Effect 3', () => {
    const text = components(
      {
        Tree: {
          type: 'object',
          properties: { parent: ref('Tree') },
        },
      },
      {},
      3,
    );
    expect(text).toContain(
      'S.suspend((): S.Schema<Tree, TreeEncoded> => Tree)',
    );
  });

  it('declares the types of every constant on a cycle', () => {
    const text = components({
      A: { type: 'object', properties: { b: ref('B') } },
      B: { type: 'object', properties: { a: ref('A'), d: ref('Date') } },
      Date: { type: 'string', format: 'date-time' },
    });
    expect(text).toContain('export type A = { readonly "b"?: B | undefined }');
    expect(text).toContain(
      'export type BEncoded = { readonly "a"?: AEncoded | undefined; readonly "d"?: S.Codec.Encoded<typeof DateSchema> | undefined }',
    );
  });

  it('numbers an encoded type that a component already uses', () => {
    const text = components({
      Node: { type: 'object', properties: { next: ref('Node') } },
      NodeEncoded: { type: 'string' },
    });
    expect(text).toContain('export type NodeEncoded2 =');
  });

  it('types defaults and optional keys on both sides', () => {
    const text = components({
      Node: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          size: { type: 'integer', default: 1 },
          next: ref('Node'),
          nick: { type: ['string', 'null'] },
        },
      },
    });
    expect(text).toContain(
      'export type Node = { readonly "id": string; readonly "size": number; readonly "next"?: Node | undefined; readonly "nick"?: string | null | undefined }',
    );
    expect(text).toContain(
      'export type NodeEncoded = { readonly "id": string; readonly "size"?: number | undefined; readonly "next"?: NodeEncoded | undefined; readonly "nick"?: string | null | undefined }',
    );
  });

  it('types exact optional keys without undefined', () => {
    const text = components(
      { Node: { type: 'object', properties: { next: ref('Node') } } },
      { exactOptional: true },
    );
    expect(text).toContain('export type Node = { readonly "next"?: Node }');
  });

  it('types dates, enums, tuples and records', () => {
    const text = components(
      {
        Node: {
          type: 'object',
          required: ['at', 'kind', 'pair', 'meta', 'self'],
          properties: {
            at: { type: 'string', format: 'date-time' },
            kind: { type: 'string', enum: ['a', "b'c"] },
            pair: {
              type: 'array',
              prefixItems: [{ type: 'string' }, { type: 'number' }],
            },
            meta: { type: 'object', additionalProperties: { type: 'integer' } },
            self: ref('Node'),
          },
        },
      },
      {},
    );
    expect(text).toContain('readonly "pair": readonly [string, number]');
    expect(text).toContain('readonly "meta": { readonly [x: string]: number }');
    expect(text).toContain(`readonly "kind": 'a' | 'b\\'c'`);
  });

  it('names a component like a reserved global with a suffix', () => {
    const text = components({
      File: { type: 'string' },
      Holder: { type: 'object', properties: { file: ref('File') } },
    });
    expect(text).toContain('export const FileSchema = S.String');
    expect(text).toContain('"file": S.optional(FileSchema)');
  });

  it('throws when two components share a name', () => {
    expect(() =>
      components({ File: { type: 'string' }, FileSchema: { type: 'string' } }),
    ).toThrow(/both resolve to the export name "FileSchema"/);
  });

  it('throws when a hoisted constant takes the name of a component', () => {
    expect(() =>
      components({
        Pet: { type: 'string', minLength: 2 },
        PetMin: { type: 'string' },
      }),
    ).toThrow(/has the name of a component/);
  });

  it('writes a hoisted constant once, before its component', () => {
    const text = components({
      Name: { type: 'string', minLength: 2, default: 'ab' },
    });
    expect(text.match(/export const NameDefault/g)).toHaveLength(1);
    expect(text.indexOf('NameMin')).toBeLessThan(
      text.indexOf('export const Name ='),
    );
  });

  it('names the component whose members cannot be merged', () => {
    expect(() =>
      components({
        A: { allOf: [ref('B'), { type: 'object' }] },
        B: { allOf: [ref('A'), { type: 'object' }] },
      }),
    ).toThrow(/component [AB] cannot be generated/);
  });
});

describe('declared types of a cyclic allOf', () => {
  const kids = { type: 'array', items: ref('Node') } as const;
  const cases: [string, Schemas][] = [
    [
      'a later member that is open',
      {
        Node: {
          allOf: [
            {
              type: 'object',
              required: ['a'],
              properties: { a: { type: 'string' }, kids },
            },
            { type: 'object', additionalProperties: true },
          ],
        },
      },
    ],
    [
      'an earlier member that is open and declares keys',
      {
        Node: {
          allOf: [
            {
              type: 'object',
              additionalProperties: true,
              required: ['a'],
              properties: { a: { type: 'string' } },
            },
            { type: 'object', properties: { kids } },
          ],
        },
      },
    ],
    [
      'an earlier member that is nullable',
      {
        Node: {
          allOf: [
            {
              type: ['object', 'null'],
              required: ['id'],
              properties: { id: { type: 'string' } },
            },
            { type: 'object', properties: { kids } },
          ],
        },
      },
    ],
    [
      'members that replace a key',
      {
        Node: {
          allOf: [
            {
              type: 'object',
              properties: { tag: { type: 'string' }, kids },
            },
            { type: 'object', properties: { tag: { type: 'integer' } } },
          ],
        },
      },
    ],
  ];

  it.each(cases)('equals the type of the schema with %s', (_name, schemas) => {
    expect(declaredTypeErrors(components(schemas))).toEqual([]);
  });

  it('types an Effect 3 allOf whose members carry defaults', () => {
    const schemas: Schemas = {
      Node: {
        type: 'object',
        required: ['data'],
        properties: {
          next: ref('Node'),
          data: {
            allOf: [
              {
                type: 'object',
                properties: { a: { type: 'string' } },
                default: {},
              },
              {
                type: 'object',
                properties: { b: { type: 'string' } },
                default: {},
              },
            ],
          },
        },
      },
    };
    const text = components(schemas, {}, 3);
    expect(text).toContain(
      'readonly "data": ({ readonly "a"?: string | undefined }) & ({ readonly "b"?: string | undefined }) };',
    );
    expect(text).not.toContain('} | undefined)');
  });

  it('reports a declared type that is wider than the schema', () => {
    const text = components({
      Node: { type: 'object', properties: { next: ref('Node') } },
    }).replace('readonly "next"?:', 'readonly "next"?: unknown |');
    expect(declaredTypeErrors(text)).toHaveLength(1);
  });
});

describe('array bounds of 0', () => {
  const schemas: Schemas = {
    Item: { type: 'object', properties: { id: { type: 'string' } } },
    Items: { type: 'array', items: ref('Item'), minItems: 0, maxItems: 100 },
    None: { type: 'array', items: ref('Item'), minItems: 0, maxItems: 0 },
  };

  it.each([3, 4] as const)(
    'drops a minimum that every array passes on Effect %i',
    (version) => {
      const text = components(schemas, {}, version);
      expect(text).not.toContain('ItemsMin');
      expect(text).not.toContain('NoneMin');
      expect(text).toContain(
        version === 3
          ? 'S.Array(Item).pipe(S.maxItems(ItemsMax))'
          : 'S.Array(Item).check(S.isMaxLength(ItemsMax))',
      );
    },
  );

  it.each([
    [3, 'S.Array(Item).pipe(S.itemsCount(0))'],
    [4, 'S.Array(Item).check(S.isMaxLength(0))'],
  ] as const)('accepts only an empty array on Effect %i', (version, schema) => {
    const text = components(schemas, {}, version);
    expect(text).toContain(`export const None = ${schema}`);
    expect(text).not.toContain('NoneMax');
  });

  it('keeps the bounds of the flag off', async () => {
    const text = await generateModule(
      {
        schemas: {},
        schema: {
          type: 'object',
          properties: {
            list: { type: 'array', items: { type: 'string' }, minItems: 0 },
          },
        },
      },
      false,
    );
    expect(text).toContain('S.isMinLength(createPetsBodyListMin)');
  });
});

describe('format schemas', () => {
  it('names an expression a declared type reads', () => {
    const text = components(
      {
        Node: {
          type: 'object',
          properties: {
            slug: { type: 'string', format: 'slug' },
            next: ref('Node'),
          },
        },
      },
      {},
      3,
      {
        formatType: {
          slug: {
            type: 'string',
            effect: { schema: 'S.String.pipe(S.minLength(3))' },
          },
        },
      },
    );
    expect(text).toContain(
      'export const nodeSlugFormat = S.String.pipe(S.minLength(3));',
    );
    expect(text).toContain('S.Schema.Type<typeof nodeSlugFormat>');
  });

  it('declares the constant of a root format once', () => {
    const text = components(
      { Slug: { type: 'string', format: 'slug' } },
      {},
      4,
      {
        formatType: {
          slug: {
            type: 'string',
            effect: { schema: 'S.String.pipe(\n  S.minLength(3)\n)' },
          },
        },
      },
    );
    expect(text.match(/export const SlugFormat/g)).toHaveLength(1);
    expect(text.match(/S\.minLength\(3\)/g)).toHaveLength(1);
  });
});

describe('reserved names', () => {
  it('does not declare a type that shadows a global the output reads', () => {
    const text = components({
      Holder: { type: 'object', properties: { x: ref('ReadonlyArray') } },
      ReadonlyArray: {
        type: 'object',
        properties: { next: { type: 'array', items: ref('ReadonlyArray') } },
      },
    });
    expect(text).not.toMatch(/export (const|type) ReadonlyArray\b/);
    expect(text).toContain('ReadonlyArray<ReadonlyArraySchema>');
  });

  it('keeps a name the output never reads', () => {
    const text = components({ Omit: { type: 'string' } });
    expect(text).toContain('export const Omit = S.String');
  });
});

describe('format type names', () => {
  const formatType = {
    email: {
      type: 'string',
      effect: {
        schema: 'Email',
        schemaImport: { name: 'Email', importPath: '../emailfmt' },
      },
    },
    slug: { type: 'string', effect: { schema: 'Slugs.pipe(S.minLength(3))' } },
  };
  const schemas: Schemas = {
    Email: { type: 'string', format: 'email' },
    Slugs: { type: 'string', format: 'slug' },
    Holder: {
      type: 'object',
      properties: { email: ref('Email'), slug: ref('Slugs') },
    },
  };

  it('names a component like an imported format schema with a suffix', () => {
    const text = components(schemas, {}, 4, { formatType });
    expect(text).toContain('export const EmailSchema = Email');
    expect(text).toContain('"email": S.optional(EmailSchema)');
    expect(text).not.toMatch(/export const Email =/);
  });

  it('names a component like the root of a format schema expression', () => {
    const text = components(schemas, {}, 4, { formatType });
    expect(text).toContain(
      'export const SlugsSchemaFormat = Slugs.pipe(S.minLength(3));',
    );
    expect(text).not.toMatch(/export const Slugs =/);
  });
});

describe('operation constants', () => {
  it('generates only the components an operation reaches', async () => {
    const schemas: Schemas = {
      Base: { type: 'object', properties: { id: { type: 'string' } } },
      Tags: {
        allOf: [ref('Base'), { type: 'array', items: { type: 'string' } }],
      },
      Empty: { type: 'object', additionalProperties: false },
    };
    const text = await generateModule({ schemas, schema: ref('Base') }, true);
    expect(text).toContain('export const Base =');
    expect(text).not.toContain('Tags');
    expect(text).not.toContain('Empty');
  });

  describe('a component that cannot be generated', () => {
    const formatType = {
      slug: { type: 'string', effect: { schema: 'S.NonEmptyString' } },
      tag: { type: 'string' },
    };
    const schemas: Schemas = {
      Pet: { type: 'object', properties: { id: { type: 'string' } } },
      Mixed: { type: 'string', format: 'slug', oneOf: [{ type: 'string' }] },
      Unmapped: { type: 'string', format: 'tag' },
    };

    it.each(['Mixed', 'Unmapped'])(
      'does not stop the run when %s is unused',
      async (name) => {
        const text = await generateModule(
          { schemas, schema: ref('Pet'), formatType },
          true,
        );
        expect(text).toContain('export const Pet =');
        expect(text).not.toContain(name);
      },
    );

    it.each([
      ['Mixed', /next to allOf\/oneOf\/anyOf/],
      ['Unmapped', /need `effect.schema`/],
    ])('names %s when an operation reaches it', async (name, message) => {
      const result = generateModule(
        {
          schemas,
          schema: { type: 'object', properties: { value: ref(name) } },
          formatType,
        },
        true,
      );
      await expect(result).rejects.toThrow(
        new RegExp(`component ${name} cannot be generated`),
      );
      await expect(result).rejects.toThrow(message);
    });
  });

  it('renames the parameter constants that clash with a component', async () => {
    const schemas: Schemas = {
      CreatePetsQueryParams: { type: 'string' },
      CreatePetsHeader: { type: 'string' },
    };
    const text = await generateModule(
      {
        schemas,
        schema: {
          type: 'object',
          properties: {
            a: ref('CreatePetsHeader'),
            b: ref('CreatePetsQueryParams'),
          },
        },
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'number' } },
          { name: 'x-id', in: 'header', schema: { type: 'string' } },
        ],
      },
      true,
    );
    const names = declaredNames(text);
    expect(names).toContain('CreatePetsQueryParamsSchema');
    expect(names).toContain('CreatePetsHeaderSchema');
    expect(new Set(names).size).toBe(names.length);
  });

  it('declares a hoisted constant of an operation and a component once', async () => {
    const schemas: Schemas = {
      CreatePetsBody: {
        type: 'object',
        properties: { data: { type: 'string', minLength: 4 } },
      },
    };
    const text = await generateModule(
      {
        schemas,
        schema: {
          type: 'object',
          properties: {
            data: { type: 'string', minLength: 3 },
            other: ref('CreatePetsBody'),
          },
        },
      },
      true,
    );
    const names = declaredNames(text);
    expect(names.filter((name) => /DataMin/.test(name))).toHaveLength(2);
    expect(new Set(names).size).toBe(names.length);
  });

  it('imports the components an operation reads as values', async () => {
    const schemas: Schemas = {
      Pet: { type: 'object', properties: { id: { type: 'string' } } },
    };
    const { imports } = await generateOperation(
      { schemas, schema: ref('Pet') },
      true,
    );
    expect(imports).toContainEqual({
      name: 'Pet',
      schemaName: 'Pet',
      values: true,
    });
  });

  it('renames a constant that has the name of a component', async () => {
    const schemas: Schemas = {
      CreatePetsBody: { type: 'string' },
      Pet: { type: 'object', properties: { id: { type: 'string' } } },
    };
    const text = await generateModule({ schemas, schema: ref('Pet') }, true);
    expect(text).toContain('export const CreatePetsBodySchema = Pet');
  });

  it('renames a constant even when its component is not generated', async () => {
    const schemas: Schemas = {
      CreatePetsResponse: { type: 'array', items: ref('Pet') },
      Pet: { type: 'object', properties: { id: { type: 'string' } } },
    };
    const text = await generateModule(
      { schemas, schema: ref('CreatePetsResponse'), target: 'response' },
      true,
    );
    expect(text).toContain(
      'export const CreatePetsResponseSchema = S.Array(CreatePetsResponseItem)',
    );
    expect(declaredNames(text)).not.toContain('CreatePetsResponse');
  });

  it('writes the constants of a root scalar once, and as before with the flag off', async () => {
    const scenario: Scenario = {
      schemas: {},
      schema: { type: 'string', minLength: 3 },
    };
    const countMin = (text: string) =>
      text.match(/^export const createPetsBodyMin = 3;/gm)?.length;
    expect(countMin(await generateModule(scenario, true))).toBe(1);
    expect(countMin(await generateModule(scenario, false))).toBe(2);
  });

  it('keeps the output of the flag off', async () => {
    const schemas: Schemas = {
      Pet: { type: 'object', properties: { id: { type: 'string' } } },
    };
    const text = await generateModule({ schemas, schema: ref('Pet') }, false);
    expect(text).toContain('export const CreatePetsBody = S.Struct');
    expect(text).not.toContain('export const Pet');
  });
});

describe('inline module text', () => {
  const builderOf = (schemas: Schemas) => ({
    spec: contextOf(schemas).spec,
    target: '',
    operations: {
      all: {
        imports: Object.keys(schemas).map((name) => ({
          name,
          schemaName: name,
          values: true,
        })),
      },
    },
  });
  const output = contextOf({}).output;

  it('brings the imports it needs', () => {
    const text = generateEffectSchemasInline(
      builderOf({ Mode: { type: 'string', default: 'a' } }),
      output,
    );
    expect(
      text.startsWith("import { Schema as S, Effect } from 'effect';"),
    ).toBe(true);
  });

  it('skips the imports the module already has', () => {
    const text = generateEffectSchemasInline(
      builderOf({ Mode: { type: 'string', default: 'a' } }),
      output,
      "import { Schema as S, Effect } from 'effect';\n",
    );
    expect(text).not.toContain('import');
  });

  it('adds only the missing import', () => {
    const text = generateEffectSchemasInline(
      builderOf({ Mode: { type: 'string', default: 'a' } }),
      output,
      "import { Schema as S } from 'effect';\n",
    );
    expect(text.startsWith("import { Effect } from 'effect';")).toBe(true);
  });

  it('is empty without components', () => {
    expect(generateEffectSchemasInline(builderOf({}), output)).toBe('');
  });
});

describe('constants of colliding names', () => {
  const slug = {
    slug: { type: 'string', effect: { schema: '(S.String)' } },
  } as const;

  it('declares the format constants of parameters with one normalized name once', async () => {
    const text = await generateModule(
      {
        schemas: {},
        schema: { type: 'string' },
        formatType: slug,
        parameters: [
          {
            name: 'foo-bar',
            in: 'query',
            schema: { type: 'string', format: 'slug' },
          },
          {
            name: 'foo_bar',
            in: 'query',
            schema: { type: 'string', format: 'slug' },
          },
        ],
      },
      true,
    );
    const names = declaredNames(text);
    expect(names.filter((name) => /FooBarFormat/.test(name))).toHaveLength(2);
    expect(new Set(names).size).toBe(names.length);
  });

  it('does not declare a name that an imported format schema binds', async () => {
    const { implementation, imports } = await generateOperation(
      {
        schemas: {
          CreatePetsResponse: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
        schema: ref('CreatePetsResponse'),
        target: 'response',
        formatType: {
          slug: {
            type: 'string',
            effect: {
              schema: 'CreatePetsResponseSchema',
              schemaImport: {
                name: 'CreatePetsResponseSchema',
                importPath: '../slug',
              },
            },
          },
        },
        parameters: [
          {
            name: 'q',
            in: 'query',
            schema: { type: 'string', format: 'slug' },
          },
        ],
      },
      true,
    );
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'CreatePetsResponseSchema' }),
    );
    expect(declaredNames(implementation)).not.toContain(
      'CreatePetsResponseSchema',
    );
  });
});
