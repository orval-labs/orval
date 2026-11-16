import type { OpenApiSchemaObject, PackageJson } from '@orval/core';
import { Schema as S } from 'effect';
import { Schema as S3 } from 'effect3';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { logger } from './logger';
import { generateEffectSchemasModule } from './schemas-module';
import { evaluate, evaluateV3 } from './test-helpers';

const moduleOf = (
  schemas: Record<string, OpenApiSchemaObject>,
  version: 3 | 4 = 4,
  override = {},
  packageJson?: PackageJson,
) => {
  const { spec, target, output } = createTestContextSpec({
    spec: { components: { schemas } },
    output: {
      schemas: { path: './model', type: 'effect', splitByTags: false },
      override: { effect: { version }, ...override },
      packageJson,
    },
  });
  return generateEffectSchemasModule(
    { spec, target, schemas: [], verbOptions: {} },
    output,
    '',
  );
};

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const accepts = (schema: S3.Schema<unknown>, input: unknown): boolean => {
  try {
    S3.decodeUnknownSync(schema)(input);
    return true;
  } catch {
    return false;
  }
};

const acceptedBy = (
  version: 3 | 4,
  source: string,
  name: string,
  input: unknown,
): boolean => {
  try {
    if (version === 3) {
      S3.decodeUnknownSync(evaluateV3(source, name))(input);
    } else {
      S.decodeUnknownSync(evaluate(source, name))(input);
    }
    return true;
  } catch {
    return false;
  }
};

describe('generateEffectSchemasModule', () => {
  it('wraps a component as a Standard Schema and exports its types', () => {
    const source = moduleOf({ Pet: { type: 'string' } });

    expect(source).toContain("import { Schema as S } from 'effect';");
    expect(source).toContain(
      'export const Pet = S.toStandardSchemaV1(S.String);',
    );
    expect(source).toContain('export type Pet = S.Codec.Encoded<typeof Pet>;');
    expect(source).toContain(
      'export type PetOutput = S.Schema.Type<typeof Pet>;',
    );
  });

  it('wraps and types a component for Effect 3', () => {
    const source = moduleOf({ Pet: { type: 'string' } }, 3);

    expect(source).toContain(
      'export const Pet = S.standardSchemaV1(S.String);',
    );
    expect(source).toContain('export type Pet = S.Schema.Encoded<typeof Pet>;');
  });

  it('imports Effect for the default of Effect 4', () => {
    const source = moduleOf({
      Pet: {
        type: 'object',
        properties: { name: { type: 'string', default: 'Rex' } },
      },
    });

    expect(source).toContain("import { Effect, Schema as S } from 'effect';");
  });

  it('types the getters of a cycle with the exported encoded and decoded types', () => {
    const source = moduleOf({
      Node: {
        type: 'object',
        required: ['next'],
        properties: { next: { $ref: '#/components/schemas/Edge' } },
      },
      Edge: {
        type: 'object',
        properties: { to: { $ref: '#/components/schemas/Node' } },
      },
    });

    expect(source).toContain(
      'S.suspend((): S.Codec<NodeOutput, Node> => Node)',
    );
    expect(source).toContain(
      'export type Edge = { readonly "to"?: Node | undefined };',
    );
    expect(source).toContain(
      'export type EdgeOutput = { readonly "to"?: NodeOutput | undefined };',
    );
    expect(source).not.toContain('S.Codec.Encoded<typeof Edge>');
  });

  it('types the getters of a cycle for Effect 3', () => {
    const source = moduleOf(
      {
        Tree: {
          type: 'object',
          properties: { parent: { $ref: '#/components/schemas/Tree' } },
        },
      },
      3,
    );

    expect(source).toContain(
      'S.suspend((): S.Schema<TreeOutput, Tree> => TreeBase)',
    );
  });

  it('names the types of a renamed recursive constant like its exports', () => {
    const source = moduleOf({
      Date: {
        type: 'object',
        properties: { parent: { $ref: '#/components/schemas/Date' } },
      },
    });

    expect(source).toContain(
      'S.suspend((): S.Codec<DateOutput, DateSchema> => DateSchema)',
    );
    expect(source).toContain('export type DateSchema = {');
    expect(source).toContain('export type DateOutput = {');
    expect(source).toContain('export { DateSchema as Date };');
  });

  it('is empty when there is nothing to declare', () => {
    expect(moduleOf({})).toBe('');
  });

  it.each(['Date', 'Number', 'RegExp', 'S'])(
    'exports a component named %s under the name clients import',
    (name) => {
      const source = moduleOf({ [name]: { type: 'string' } });

      expect(source).toContain(`export const ${name}Schema = `);
      expect(source).toContain(`export { ${name}Schema as ${name} };`);
      expect(source).toContain(
        `export type ${name}Output = S.Schema.Type<typeof ${name}Schema>;`,
      );
    },
  );

  it('makes a required writeOnly property optional', () => {
    const source = moduleOf({
      Account: {
        type: 'object',
        required: ['id', 'password'],
        properties: {
          id: { type: 'string', readOnly: true },
          password: { type: 'string', writeOnly: true },
        },
      },
    });

    expect(source).toContain('"id": S.String');
    expect(source).toContain('"password": S.optional(S.String)');
  });

  it('keeps the constants a schema hoists next to it', () => {
    const source = moduleOf({
      Name: { type: 'string', minLength: 2, maxLength: 9 },
    });

    expect(source).toContain('export const NameMin = 2;');
    expect(source.indexOf('NameMin')).toBeLessThan(
      source.indexOf('export const Name ='),
    );
  });

  it('rejects a component named like the output type of another', () => {
    expect(() =>
      moduleOf({ Pet: { type: 'string' }, PetOutput: { type: 'string' } }),
    ).toThrow(/"PetOutput", which is also a schema/);
  });

  it('names schemas.type effect when two components share a name', () => {
    expect(() =>
      moduleOf({
        Effect: { type: 'string' },
        EffectSchema: { type: 'string' },
      }),
    ).toThrow(
      /^\[orval\/effect\] schemas\.type "effect": refs .* both resolve/,
    );
  });

  describe('the installed Effect 3', () => {
    const pet = { Pet: { type: 'string' } } as const;
    const installed = (effect: string): PackageJson => ({
      resolvedVersions: { effect },
    });

    it.each(['3.13.0', '3.14.0'])(
      'rejects %s, whose wrapper is not a schema',
      (effect) => {
        expect(() => moduleOf(pet, 3, {}, installed(effect))).toThrow(
          new RegExp(
            `needs Effect 3\\.15 or newer, but ${effect} is installed`,
          ),
        );
      },
    );

    it.each(['3.15.0', '3.21.2', '4.0.0'])('accepts %s', (effect) => {
      expect(moduleOf(pet, 3, {}, installed(effect))).toContain(
        'S.standardSchemaV1(S.String)',
      );
    });

    it('accepts an Effect that is not installed', () => {
      expect(moduleOf(pet, 3)).toContain('S.standardSchemaV1(S.String)');
    });

    it('leaves Effect 4 output alone', () => {
      expect(moduleOf(pet, 4, {}, installed('3.14.0'))).toContain(
        'S.toStandardSchemaV1(S.String)',
      );
    });
  });

  it('rejects a hoisted constant named like a component', () => {
    expect(() =>
      moduleOf({
        Name: { type: 'string', minLength: 2 },
        NameMin: { type: 'string' },
      }),
    ).toThrow(/the constant "NameMin" generated for component Name/);
  });

  describe('on Effect 3', () => {
    // The Standard Schema wrapper builds its parser at once, which reads every
    // getter of the cycle, so the cycle is declared before it is wrapped.
    const cycles: [
      string,
      Record<string, OpenApiSchemaObject>,
      [name: string, valid: unknown, invalid: unknown][],
    ][] = [
      [
        'an optional reference to itself',
        {
          Node: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' }, next: ref('Node') },
          },
          Holder: { type: 'object', properties: { node: ref('Node') } },
        },
        [
          ['Node', { name: 'a', next: { name: 'b' } }, { name: 'a', next: {} }],
          ['Holder', { node: { name: 'a' } }, { node: {} }],
        ],
      ],
      [
        'optional references between two',
        {
          A: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' }, b: ref('B') },
          },
          B: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'number' }, a: ref('A') },
          },
        },
        [
          ['A', { name: 'a', b: { id: 1, a: { name: 'z' } } }, { b: {} }],
          ['B', { id: 1, a: { name: 'a' } }, { id: 'x' }],
        ],
      ],
      [
        'a union that reads itself',
        {
          Expr: { oneOf: [ref('Num'), ref('Add')] },
          Num: {
            type: 'object',
            required: ['value'],
            properties: { value: { type: 'number' } },
          },
          Add: {
            type: 'object',
            required: ['left', 'right'],
            properties: { left: ref('Expr'), right: ref('Expr') },
          },
        },
        [
          [
            'Expr',
            {
              left: { value: 1 },
              right: { left: { value: 1 }, right: { value: 2 } },
            },
            { left: { value: 1 } },
          ],
        ],
      ],
    ];

    it.each(cycles)('loads %s', (_, schemas, roots) => {
      const source = moduleOf(schemas, 3);

      expect(source).toContain('Base = S.');
      for (const [name, valid, invalid] of roots) {
        const schema = evaluateV3(source, name);
        expect(accepts(schema, valid)).toBe(true);
        expect(accepts(schema, invalid)).toBe(false);
      }
    });

    it('declares the unwrapped constants before any wrapper', () => {
      const source = moduleOf(cycles[1][1], 3);

      expect(source.lastIndexOf('const ABase')).toBeLessThan(
        source.indexOf('export const A ='),
      );
      expect(source.lastIndexOf('const BBase')).toBeLessThan(
        source.indexOf('export const A ='),
      );
      expect(source).toContain('S.suspend((): S.Schema<AOutput, A> => ABase)');
    });

    it('types an allOf on a cycle as the struct its members merge to', () => {
      const source = moduleOf(
        {
          Node: {
            allOf: [
              { type: 'object', properties: { tag: { type: 'string' } } },
              {
                type: 'object',
                required: ['tag'],
                properties: {
                  tag: { type: 'string', enum: ['a'] },
                  next: ref('Node'),
                },
              },
            ],
          },
        },
        3,
      );

      expect(source).toContain(
        `export type NodeOutput = { readonly "tag": 'a'; readonly "next"?: NodeOutput | undefined };`,
      );
      expect(source).not.toContain(' & ');
    });

    it('numbers the unwrapped constant when its name is taken', () => {
      const source = moduleOf(
        {
          Node: { type: 'object', properties: { next: ref('Node') } },
          NodeBase: { type: 'string' },
        },
        3,
      );

      expect(source).toContain('const NodeBase2 = S.Struct');
      expect(source).toContain(
        'export const Node = S.standardSchemaV1(NodeBase2);',
      );
    });

    it('rejects a string that is not a date', () => {
      const source = moduleOf(
        {
          Pet: {
            type: 'object',
            properties: { bornAt: { type: 'string', format: 'date-time' } },
          },
        },
        3,
        { useDates: true },
      );
      const pet = evaluateV3(source, 'Pet');

      expect(source).toContain('S.optional(S.Date)');
      expect(accepts(pet, { bornAt: '2024-01-02T03:04:05.000Z' })).toBe(true);
      expect(accepts(pet, { bornAt: 'tomorrow' })).toBe(false);
    });

    describe('an allOf', () => {
      const open = { type: 'object', additionalProperties: true } as const;

      it.each<
        [
          name: string,
          schemas: Record<string, OpenApiSchemaObject>,
          valid: unknown,
          invalid: unknown,
        ]
      >([
        [
          'members that declare a property each',
          {
            Base: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string' },
                kind: { type: 'string', enum: ['a', 'b'] },
              },
            },
            Item: {
              allOf: [
                ref('Base'),
                {
                  type: 'object',
                  properties: {
                    kind: { type: 'string', enum: ['a'] },
                    extra: { type: 'number' },
                  },
                },
              ],
            },
          },
          { id: 'x', kind: 'a', extra: 1 },
          { id: 'x', kind: 'b' },
        ],
        [
          'open members',
          {
            Contents: {
              ...open,
              properties: { id: { type: 'string' } },
            },
            Base: {
              ...open,
              allOf: [
                ref('Contents'),
                { ...open, properties: { status: { type: 'string' } } },
              ],
            },
            Detail: {
              ...open,
              allOf: [
                ref('Base'),
                {
                  ...open,
                  required: ['id'],
                  properties: { extra: { type: 'number' } },
                },
              ],
            },
          },
          { id: 'x', status: 's', extra: 1, anything: true },
          { id: 'x', extra: 'one' },
        ],
        [
          'members that admit null',
          {
            Item: {
              allOf: [
                {
                  type: ['object', 'null'],
                  properties: { a: { type: 'string' } },
                },
                {
                  type: ['object', 'null'],
                  properties: { b: { type: 'number' } },
                },
              ],
            },
          },
          { a: 'x', b: 1 },
          { a: 1 },
        ],
      ])('merges %s', (_, schemas, valid, invalid) => {
        const source = moduleOf(schemas, 3);
        const name = Object.keys(schemas).at(-1) ?? '';
        const schema = evaluateV3(source, name);

        expect(accepts(schema, valid)).toBe(true);
        expect(accepts(schema, invalid)).toBe(false);
      });

      it('leaves a member that is not a struct out of the module', () => {
        const warn = vi.spyOn(logger, 'warn');
        const source = moduleOf(
          {
            Id: { type: 'string' },
            Detail: { allOf: [{ type: 'string' }, { minLength: 2 }] },
          },
          3,
        );

        expect(accepts(evaluateV3(source, 'Id'), 'a')).toBe(true);
        expect(source).not.toContain('Detail');
        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(/Effect 3 output merges allOf members/),
        );
        warn.mockRestore();
      });
    });
  });

  it('leaves dates to S.DateFromString on Effect 4', () => {
    const source = moduleOf(
      { Pet: { type: 'string', format: 'date-time' } },
      4,
      { useDates: true },
    );

    expect(source).toContain('S.toStandardSchemaV1(S.DateFromString)');
  });

  it('keeps what a member narrows of the properties the schema declares', () => {
    const decode = (source: string, name: string, input: unknown) =>
      S.decodeUnknownSync(evaluate(source, name))(input);
    const source = moduleOf({
      Pet: {
        type: 'object',
        required: ['petType'],
        properties: {
          petType: { type: 'string', enum: ['cat', 'dog'] },
          name: { type: 'string' },
        },
        oneOf: [ref('Cat'), ref('Dog')],
      },
      Cat: {
        type: 'object',
        required: ['petType'],
        properties: {
          petType: { type: 'string', enum: ['cat'] },
          lives: { type: 'integer' },
        },
      },
      Dog: {
        type: 'object',
        required: ['petType'],
        properties: {
          petType: { type: 'string', enum: ['dog'] },
          packSize: { type: 'integer' },
        },
      },
    });
    const dog = { petType: 'dog', name: 'Rex', packSize: 3 };

    expect(decode(source, 'Pet', dog)).toEqual(dog);
    expect(() =>
      decode(source, 'Pet', { petType: 'dog', packSize: 'x' }),
    ).toThrow();
    expect(() => decode(source, 'Pet', { petType: 'bird' })).toThrow();
  });

  describe.each([3, 4] as const)('checks on Effect %i', (version) => {
    const accepted = (source: string, name: string, input: unknown) =>
      acceptedBy(version, source, name, input);

    it.each([
      ['an int64 id', 1_234_567_890_123_456_800, true],
      ['a safe integer', 42, true],
      ['a fraction', 1.5, false],
      ['a string', '1', false],
      ['a number below the minimum', 0, false],
    ])('checks an integer for %s', (_, value, valid) => {
      const source = moduleOf(
        { Id: { type: 'integer', format: 'int64', minimum: 1 } },
        version,
      );

      expect(accepted(source, 'Id', value)).toBe(valid);
    });

    it('declares a closed object without properties as an empty struct', () => {
      const source = moduleOf(
        {
          Empty: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          Holder: { type: 'object', properties: { empty: ref('Empty') } },
        },
        version,
      );

      expect(source).toContain('S.Struct({})');
      expect(accepted(source, 'Empty', {})).toBe(true);
      expect(accepted(source, 'Empty', null)).toBe(false);
      expect(accepted(source, 'Holder', { empty: {} })).toBe(true);
    });

    it('checks an integer next to a component named Number', () => {
      const source = moduleOf(
        {
          Number: {
            type: 'object',
            required: ['value'],
            properties: { value: { type: 'integer' } },
          },
        },
        version,
      );

      // The evaluation takes a script, which has no export list.
      const script = source.replace(/^export \{[^}]*\};$/m, '');

      expect(accepted(script, 'NumberSchema', { value: 1 })).toBe(true);
      expect(accepted(script, 'NumberSchema', { value: 1.5 })).toBe(false);
    });

    it('checks an integer of a union or a nullable one as one', () => {
      const source = moduleOf(
        {
          Pet: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'integer' },
              size: { type: ['integer', 'null'] },
              mixed: { type: ['integer', 'string'] },
              score: { type: 'number' },
              fraction: { type: ['integer', 'number'] },
            },
          },
        },
        version,
      );
      const pet = (fields: Record<string, unknown>) =>
        accepted(source, 'Pet', { id: 1, ...fields });

      expect(pet({ size: 2, mixed: 'a', score: 1.5, fraction: 1.5 })).toBe(
        true,
      );
      expect(pet({ size: null })).toBe(true);
      expect(pet({ size: 1.5 })).toBe(false);
      expect(pet({ mixed: 1.5 })).toBe(false);
      expect(accepted(source, 'Pet', { id: 1.5 })).toBe(false);
    });

    it.each([
      ['s3://bucket/key', true],
      ['mailto:a@b.co', true],
      ['urn:isbn:123', true],
      ['https://example.com/a', true],
      ['not a url', false],
      ['/relative/path', false],
    ])('checks the format uri of %s', (value, valid) => {
      const source = moduleOf(
        { Link: { type: 'string', format: 'uri' } },
        version,
      );

      expect(accepted(source, 'Link', value)).toBe(valid);
    });

    it('reads a Unicode property escape of a pattern as one', () => {
      const source = moduleOf(
        { Word: { type: 'string', pattern: String.raw`^\p{L}+$` } },
        version,
      );

      expect(accepted(source, 'Word', 'héllo')).toBe(true);
      expect(accepted(source, 'Word', 'p{L}')).toBe(false);
    });

    it.each([
      ['a slash at the end', '^/api/', '/api/', '/apix'],
      ['a slash at the start', '/v1', 'a/v1', 'v1'],
      ['a lone slash', '/', 'a/b', 'ab'],
      ['an escaped slash at the end', String.raw`/a\/`, '/a/', 'a'],
      ['two slashes with nothing between', '//', 'a//b', 'a/b'],
    ])('treats %s as part of the pattern', (_, pattern, valid, invalid) => {
      const source = moduleOf({ Route: { type: 'string', pattern } }, version);

      expect(accepted(source, 'Route', valid)).toBe(true);
      expect(accepted(source, 'Route', invalid)).toBe(false);
    });

    it.each([
      ['a word', '/^[a-z]+$/', "new RegExp('^[a-z]+$')", 'abc', 'a1'],
      [
        'an escaped backslash at the end',
        String.raw`/a\\/`,
        String.raw`new RegExp('a\\\\')`,
        'a\\',
        'b',
      ],
    ])(
      'strips the slashes that delimit %s',
      (_, pattern, expected, valid, invalid) => {
        const source = moduleOf({ Word: { type: 'string', pattern } }, version);

        expect(source).toContain(expected);
        expect(accepted(source, 'Word', valid)).toBe(true);
        expect(accepted(source, 'Word', invalid)).toBe(false);
      },
    );

    describe.each(['oneOf', 'anyOf'] as const)('a %s', (key) => {
      const members: Record<string, OpenApiSchemaObject> = {
        Cat: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['cat'] },
            name: { type: 'string' },
            meow: { type: 'string' },
          },
        },
        Dog: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['dog'] },
            name: { type: 'string' },
            bark: { type: 'string' },
          },
        },
      };

      it('requires a key of the schema that its members leave optional', () => {
        const source = moduleOf(
          {
            ...members,
            Pet: {
              type: 'object',
              required: ['kind'],
              properties: { kind: { type: 'string' } },
              [key]: [ref('Cat'), ref('Dog')],
            },
          },
          version,
        );

        expect(accepted(source, 'Pet', { kind: 'cat', meow: 'x' })).toBe(true);
        expect(accepted(source, 'Pet', { kind: 'dog' })).toBe(true);
        expect(accepted(source, 'Pet', {})).toBe(false);
        expect(accepted(source, 'Pet', { meow: 'x' })).toBe(false);
        expect(accepted(source, 'Pet', { kind: 'bird' })).toBe(false);
      });

      it('requires a key that the schema asks of its members', () => {
        const source = moduleOf(
          {
            ...members,
            Pet: {
              type: 'object',
              required: ['name'],
              properties: { tag: { type: 'string' } },
              [key]: [ref('Cat'), ref('Dog')],
            },
          },
          version,
        );

        expect(accepted(source, 'Pet', { kind: 'cat', name: 'Tom' })).toBe(
          true,
        );
        expect(accepted(source, 'Pet', { kind: 'cat' })).toBe(false);
        expect(accepted(source, 'Pet', {})).toBe(false);
      });
    });

    it('leaves out a pattern that does not compile with the u flag', () => {
      const warn = vi.spyOn(logger, 'warn');
      const source = moduleOf(
        {
          Name: { type: 'string', pattern: String.raw`^[\p{L}\-\_ ]+$` },
          Pet: {
            type: 'object',
            required: ['name'],
            properties: { name: { $ref: '#/components/schemas/Name' } },
          },
        },
        version,
      );

      expect(accepted(source, 'Name', 'not a name!')).toBe(true);
      expect(accepted(source, 'Pet', { name: 'Rex' })).toBe(true);
      expect(source).not.toContain('RegExp');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          String.raw`Skipping pattern that is not a JavaScript RegExp: ^[\p{L}\-\_ ]+$`,
        ),
      );
      warn.mockRestore();
    });

    it.each([
      ['2026-01-02T03:04:05Z', true],
      ['2026-01-02 03:04:05Z', true],
      ['2026-01-02 03:04:05.5+05:30', true],
      ['2026-01-02', false],
      ['tomorrow', false],
    ])('checks the format date-time of %s', (value, valid) => {
      const source = moduleOf(
        { Moment: { type: 'string', format: 'date-time' } },
        version,
      );

      expect(accepted(source, 'Moment', value)).toBe(valid);
    });
  });

  describe('a component that cannot be generated', () => {
    const item = {
      type: 'object',
      properties: { id: { type: 'string' }, name: { type: 'string' } },
    } as const;
    // The schemas module merges the members of an allOf as structs.
    const narrowed: OpenApiSchemaObject = {
      allOf: [{ $ref: '#/components/schemas/Item' }, { required: ['id'] }],
    };

    it('is left out with its readers when nothing reaches it', () => {
      const warn = vi.spyOn(logger, 'warn');
      const source = moduleOf({
        Item: item,
        Detail: narrowed,
        Page: {
          type: 'object',
          properties: { detail: { $ref: '#/components/schemas/Detail' } },
        },
      });

      expect(source).toContain('export const Item =');
      expect(source).not.toContain('Detail');
      expect(source).not.toContain('Page');
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/component Detail cannot be generated/),
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/component Page reads a component/),
      );
      warn.mockRestore();
    });
  });
});
