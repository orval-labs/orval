import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  GeneratorSchema,
  OpenApiSchemaObject,
} from '../types';
import { EnumGeneration, NamingConvention } from '../types';
import { generateImports } from './imports';
import { generateInterface } from './interface';

describe('generateInterface', () => {
  const context: ContextSpec = {
    output: {
      override: { namingConvention: {} },
    },
    target: 'typescript',
    spec: {},
  };

  const withContext = ({
    output,
    override,
  }: {
    output?: Partial<ContextSpec['output']>;
    override?: Partial<ContextSpec['output']['override']>;
  } = {}): ContextSpec => ({
    ...context,
    output: {
      ...context.output,
      ...output,
      override: {
        ...context.output.override,
        ...override,
      },
    },
  });

  const constEnumGenerationContext = withContext({
    override: { enumGenerationType: EnumGeneration.CONST },
  });

  const aliasCombinedTypesContext = withContext({
    override: { aliasCombinedTypes: true },
  });

  it('should return const object with typeof', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          const: 'Invalid data',
        },
        code: {
          type: 'integer',
          const: 1,
        },
        isError: {
          type: 'boolean',
          const: false,
        },
      },
      required: ['message', 'code'],
    };

    const got = generateInterface({
      name: 'TestSchema',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'TestSchema',
        model: `export const TestSchemaValue = {
  message: 'Invalid data',
  code: 1,
  isError: false,
} as const;
export type TestSchema = typeof TestSchemaValue;
`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  // With enumGenerationType: const - mimic default enum output
  it('should inline const literal when enum + const are both present', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['A', 'B'],
          const: 'A',
        },
      },
      required: ['kind'],
    };

    const got = generateInterface({
      name: 'ConstEnum',
      context: constEnumGenerationContext,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'ConstEnumKind',
        model:
          "export type ConstEnumKind = typeof ConstEnumKind[keyof typeof ConstEnumKind];\n\n\nexport const ConstEnumKind = {\n  A: 'A',\n} as const;\n",
        imports: [],
        dependencies: [],
      },
      {
        name: 'ConstEnum',
        model: `export const ConstEnumValue = {
  kind: ConstEnumKind,
} as const;
export type ConstEnum = typeof ConstEnumValue;
`,
        imports: [{ name: 'ConstEnumKind', isConstant: true }],
        dependencies: ['ConstEnumKind'],
        schema,
      },
    ];

    expect(got).toEqual(want);
  });

  // With enumGenerationType: const - keep referenced enums type-only
  it('should use type-only imports for referenced schemas in interfaces', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        status: {
          $ref: '#/components/schemas/OrderStatus',
        },
      },
    };

    const got = generateInterface({
      name: 'Order',
      context: constEnumGenerationContext,
      schema: schema as unknown as OpenApiSchemaObject,
    });

    expect(got).toEqual([
      {
        name: 'Order',
        model: `export interface Order {\n  status?: OrderStatus;\n}\n`,
        imports: [{ name: 'OrderStatus', schemaName: 'OrderStatus' }],
        dependencies: ['OrderStatus'],
        schema,
      },
    ]);

    const importsString = generateImports({
      imports: got[0].imports,
      namingConvention: NamingConvention.CAMEL_CASE,
    });

    expect(importsString).toBe(
      "import type { OrderStatus } from './orderStatus';",
    );
  });

  // With enumGenerationType: const - keep inline enums type-only in interfaces
  it('should use type-only imports for inline enums in interfaces even with const enum generation', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'done'],
        },
      },
    };

    const got = generateInterface({
      name: 'OrderWithInlineEnum',
      context: constEnumGenerationContext,
      schema: schema as unknown as OpenApiSchemaObject,
    });

    expect(got).toEqual([
      {
        name: 'OrderWithInlineEnumStatus',
        model:
          "export type OrderWithInlineEnumStatus = typeof OrderWithInlineEnumStatus[keyof typeof OrderWithInlineEnumStatus];\n\n\nexport const OrderWithInlineEnumStatus = {\n  pending: 'pending',\n  done: 'done',\n} as const;\n",
        imports: [],
        dependencies: [],
      },
      {
        name: 'OrderWithInlineEnum',
        model:
          'export interface OrderWithInlineEnum {\n  status?: OrderWithInlineEnumStatus;\n}\n',
        imports: [{ name: 'OrderWithInlineEnumStatus' }],
        dependencies: ['OrderWithInlineEnumStatus'],
        schema,
      },
    ]);

    const importsString = generateImports({
      imports: got[1].imports,
      namingConvention: NamingConvention.CAMEL_CASE,
    });

    expect(importsString).toBe(
      "import type { OrderWithInlineEnumStatus } from './orderWithInlineEnumStatus';",
    );
  });

  it('should emit value imports when a symbol is marked constant (value space)', () => {
    const importsString = generateImports({
      imports: [{ name: 'OrderWithInlineEnumStatus', isConstant: true }],
      namingConvention: NamingConvention.CAMEL_CASE,
    });

    expect(importsString).toBe(
      "import { OrderWithInlineEnumStatus } from './orderWithInlineEnumStatus';",
    );
  });

  it('should return type', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {},
      required: ['message', 'code'],
    };

    const got = generateInterface({
      name: 'TestSchema',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'TestSchema',
        model: `export interface TestSchema { [key: string]: unknown }\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should generate index signature with propertyNames enum (OpenAPI 3.1)', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        type: 'string',
        enum: ['foo', 'bar'],
      },
      additionalProperties: {
        type: 'string',
      },
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export type MyObject = Partial<Record<'foo' | 'bar', string>>;\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should handle propertyNames enum with additional properties as boolean', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        type: 'string',
        enum: ['key1', 'key2', 'key3'],
      },
      additionalProperties: true,
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export type MyObject = Partial<Record<'key1' | 'key2' | 'key3', unknown>>;\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should handle propertyNames enum with specific type in additionalProperties', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        type: 'string',
        enum: ['id', 'name'],
      },
      additionalProperties: {
        type: 'integer',
      },
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export type MyObject = Partial<Record<'id' | 'name', number>>;\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should use string when propertyNames has no enum', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        type: 'string',
        pattern: '^[a-z]+$',
      },
      additionalProperties: {
        type: 'string',
      },
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    const want: GeneratorSchema[] = [
      {
        name: 'MyObject',
        model: `export interface MyObject {[key: string]: string}\n`,
        imports: [],
        dependencies: [],
        schema,
      },
    ];
    expect(got).toEqual(want);
  });

  it('should handle propertyNames enum with properties already defined', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        existingProp: {
          type: 'string',
        },
      },
      propertyNames: {
        type: 'string',
        enum: ['allowed', 'values'],
      },
      additionalProperties: {
        type: 'number',
      },
      required: ['existingProp'],
    };

    const got = generateInterface({
      name: 'MyObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });

    expect(got).toHaveLength(1);
    expect(got[0].name).toBe('MyObject');
    expect(got[0].model).toContain('existingProp: string');
    expect(got[0].model).toContain(
      "} & Partial<Record<'allowed' | 'values', number>>",
    );
  });

  it.each([
    ['anyOf', '|', 'AnyOf'],
    ['oneOf', '|', 'OneOf'],
    ['allOf', '&', 'AllOf'],
  ] as const)(
    'should generate %s primitive properties: type alias when aliasCombinedTypes is true, inlined by default',
    (combiner, operator, combinerName) => {
      const schema: OpenApiSchemaObject = {
        type: 'object',
        properties: {
          field: {
            [combiner]: [{ type: 'string' }, { type: 'number' }],
          },
        },
      };

      // With aliasCombinedTypes: true - creates named type alias
      const aliasResult = generateInterface({
        name: `Alias${combinerName}`,
        context: aliasCombinedTypesContext,
        schema: schema as unknown as OpenApiSchemaObject,
      });
      expect(aliasResult).toHaveLength(2);
      expect(aliasResult[0].name).toBe(`Alias${combinerName}Field`);
      expect(aliasResult[0].model).toBe(
        `export type Alias${combinerName}Field = string ${operator} number;\n`,
      );
      expect(aliasResult[1].name).toBe(`Alias${combinerName}`);
      expect(aliasResult[1].model).toBe(
        `export interface Alias${combinerName} {\n  field?: Alias${combinerName}Field;\n}\n`,
      );

      // Default behavior (aliasCombinedTypes defaults to false) - inlines the union/intersection
      const inlineResult = generateInterface({
        name: `Inline${combinerName}`,
        context,
        schema: schema as unknown as OpenApiSchemaObject,
      });
      expect(inlineResult).toHaveLength(1);
      expect(inlineResult[0].name).toBe(`Inline${combinerName}`);
      expect(inlineResult[0].model).toBe(
        `export interface Inline${combinerName} {\n  field?: string ${operator} number;\n}\n`,
      );
    },
  );

  it('should generate object properties: intermediate types when aliasCombinedTypes is true, inlined by default', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        field: {
          oneOf: [
            { type: 'object', properties: { a: { type: 'string' } } },
            { type: 'object', properties: { b: { type: 'string' } } },
          ],
        },
      },
    };

    // With aliasCombinedTypes: true - creates intermediate types with OneOf/OneOfTwo
    const aliasResult = generateInterface({
      name: 'AliasObject',
      context: aliasCombinedTypesContext,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    expect(aliasResult).toHaveLength(4);
    expect(aliasResult[0].name).toBe('AliasObjectFieldOneOf');
    expect(aliasResult[0].model).toBe(
      'export type AliasObjectFieldOneOf = {\n  a?: string;\n};\n',
    );
    expect(aliasResult[1].name).toBe('AliasObjectFieldOneOfTwo');
    expect(aliasResult[1].model).toBe(
      'export type AliasObjectFieldOneOfTwo = {\n  b?: string;\n};\n',
    );
    expect(aliasResult[2].name).toBe('AliasObjectField');
    expect(aliasResult[2].model).toBe(
      'export type AliasObjectField = AliasObjectFieldOneOf | AliasObjectFieldOneOfTwo;\n',
    );
    expect(aliasResult[3].name).toBe('AliasObject');
    expect(aliasResult[3].model).toBe(
      'export interface AliasObject {\n  field?: AliasObjectField;\n}\n',
    );

    // Default behavior - inlines objects into one named type
    const inlineResult = generateInterface({
      name: 'InlineObject',
      context,
      schema: schema as unknown as OpenApiSchemaObject,
    });
    expect(inlineResult).toHaveLength(2);
    expect(inlineResult[0].name).toBe('InlineObjectField');
    expect(inlineResult[0].model).toBe(
      'export type InlineObjectField = {\n  a?: string;\n} | {\n  b?: string;\n};\n',
    );
    expect(inlineResult[1].name).toBe('InlineObject');
    expect(inlineResult[1].model).toBe(
      'export interface InlineObject {\n  field?: InlineObjectField;\n}\n',
    );
  });

  // Comprehensive test: (a|b) & c & (d|e) & (f|g)
  // Tests: nested oneOf, nested anyOf, sibling oneOf, different positions
  it('allOf + union precedence: should wrap all unions in parens', () => {
    const schema: OpenApiSchemaObject = {
      allOf: [
        {
          oneOf: [
            { type: 'object', properties: { a: { type: 'string' } } },
            { type: 'object', properties: { b: { type: 'string' } } },
          ],
        },
        { type: 'object', properties: { c: { type: 'string' } } },
        {
          anyOf: [
            { type: 'object', properties: { d: { type: 'string' } } },
            { type: 'object', properties: { e: { type: 'string' } } },
          ],
        },
      ],
      oneOf: [
        { type: 'object', properties: { f: { type: 'string' } } },
        { type: 'object', properties: { g: { type: 'string' } } },
      ],
    };

    const result = generateInterface({ name: 'Test', context, schema });
    expect(result[0].model).toBe(
      'export interface Test ({\n  a?: string;\n} | {\n  b?: string;\n}) & {\n  c?: string;\n} & ({\n  d?: string;\n} | {\n  e?: string;\n}) & ({\n  f?: string;\n} | {\n  g?: string;\n})\n',
    );
  });

  describe('duplicate union types', () => {
    it('should not produce duplicate null in nullable object types', () => {
      const schema = {
        type: ['object', 'null'],
      } as unknown as OpenApiSchemaObject;

      const result = generateInterface({
        name: 'NullableObject',
        context,
        schema,
      });

      expect(result[0].model).not.toContain('null | null');
    });

    it('should not produce duplicate types in oneOf/anyOf', () => {
      const schema: OpenApiSchemaObject = {
        oneOf: [{ type: 'string' }, { type: 'string' }, { type: 'number' }],
      };

      const result = generateInterface({
        name: 'DuplicateUnion',
        context,
        schema,
      });

      expect(result[0].model).not.toContain('string | string');
    });
  });
});
