import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiDocument,
  OpenApiSchemaObject,
} from '../types';
import { NamingConvention } from '../types';
import { generateFactory } from './factory';

const baseFactoryMethods = {
  generate: true,
  functionNamePrefix: 'create',
  mode: 'inline-with-schema',
  outputDirectory: '',
  optionalPropertyStrategy: 'omit',
};

const baseOverride = {
  useDates: false,
  namingConvention: {},
  components: {
    schemas: { suffix: '', itemSuffix: '' },
    responses: { suffix: '' },
    parameters: { suffix: '' },
    requestBodies: { suffix: '' },
  },
};

const createMockContext = (
  overrides: Record<string, unknown> = {},
): ContextSpec => {
  const { override: overrideOverride, ...rest } = overrides;
  return {
    target: 'test',
    workspace: 'test',
    spec: {
      components: {
        schemas: {
          RefTarget: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
          CircularChild: {
            type: 'object',
            properties: {
              parent: { $ref: '#/components/schemas/CircularParent' },
            },
          },
          CircularParent: {
            type: 'object',
            properties: {
              child: { $ref: '#/components/schemas/CircularChild' },
            },
          },
          DeepCircularA: {
            type: 'object',
            properties: { b: { $ref: '#/components/schemas/DeepCircularB' } },
          },
          DeepCircularB: {
            type: 'object',
            properties: { c: { $ref: '#/components/schemas/DeepCircularC' } },
          },
          DeepCircularC: {
            type: 'object',
            properties: { a: { $ref: '#/components/schemas/DeepCircularA' } },
          },
        },
      },
    } as unknown as OpenApiDocument,
    output: {
      target: '',
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      mode: 'single' as unknown,
      client: 'axios' as unknown,
      httpClient: 'axios' as unknown,
      clean: false,
      docs: false,
      prettier: false,
      biome: false,
      headers: false,
      indexFiles: false,
      allParamsOptional: false,
      urlEncodeParameters: false,
      unionAddMissingProperties: false,
      optionsParamRequired: false,
      propertySortOrder: 'Alphabetical' as unknown,
      factoryMethods: baseFactoryMethods,
      override: {
        ...baseOverride,
        ...(overrideOverride as object | undefined),
      },
      ...rest,
    } as unknown,
  } as unknown as ContextSpec;
};

describe('generateFactory', () => {
  it('returns undefined if schema is not an object/combination', () => {
    const schema: OpenApiSchemaObject = { type: 'string' };
    expect(
      generateFactory(schema, 'StringSchema', createMockContext()),
    ).toBeUndefined();
  });

  it('generates factory for basic object with omitted optionals', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        isActive: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    };

    const result = generateFactory(schema, 'User', createMockContext());
    expect(result).toBeDefined();
    expect(result?.model).toContain('export function createUser(): User {');
    expect(result?.model).toContain('id: 0');
    expect(result?.model).toContain("name: ''");
    expect(result?.model).not.toContain('isActive');
    expect(result?.model).not.toContain('tags');
  });

  it('includes optional properties when strategy is include', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        isActive: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
        score: { type: 'number' },
      },
    };

    const result = generateFactory(
      schema,
      'User',
      createMockContext({
        factoryMethods: {
          ...baseFactoryMethods,
          optionalPropertyStrategy: 'include',
        },
      }),
    );
    expect(result?.model).toContain('isActive: false');
    expect(result?.model).toContain('tags: []');
    expect(result?.model).toContain('score: 0');
  });

  it('omits optional readOnly properties but forcefully keeps optional writeOnly properties', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['reqReadOnly'],
      properties: {
        normalOpt: { type: 'string' },
        readOnlyOpt: { type: 'string', readOnly: true },
        writeOnlyOpt: { type: 'string', writeOnly: true },
        reqReadOnly: { type: 'string', readOnly: true },
      },
    };

    const result = generateFactory(schema, 'Obj', createMockContext());
    expect(result?.model).not.toContain("normalOpt: ''");
    expect(result?.model).not.toContain("readOnlyOpt: ''");
    expect(result?.model).toContain("writeOnlyOpt: ''");
    expect(result?.model).toContain("reqReadOnly: ''");
  });

  it('handles nested objects', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['nested'],
      properties: {
        nested: {
          type: 'object',
          required: ['val'],
          properties: { val: { type: 'number' } },
        },
      },
    };

    const result = generateFactory(schema, 'NestedObj', createMockContext());
    expect(result?.model).toContain('nested: {\n    val: 0\n  }');
  });

  it('handles $ref and imports correctly', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['target'],
      properties: {
        target: { $ref: '#/components/schemas/RefTarget' },
      },
    };

    const result = generateFactory(schema, 'WithRef', createMockContext());
    expect(result?.model).toContain('target: createRefTarget()');
    expect(result?.imports).toContainEqual({
      name: 'createRefTarget',
      importPath: './refTarget',
      isConstant: true,
    });
    expect(result?.imports).toContainEqual({ name: 'RefTarget' });
  });

  it('handles mode: separate-file import paths', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['target'],
      properties: {
        target: { $ref: '#/components/schemas/RefTarget' },
      },
    };

    const result = generateFactory(
      schema,
      'WithRef',
      createMockContext({
        factoryMethods: { ...baseFactoryMethods, mode: 'separate-file' },
      }),
    );
    expect(result?.imports).toContainEqual({
      name: 'createRefTarget',
      importPath: './refTarget.factory',
      isConstant: true,
    });
  });

  it('handles mode: combined-separate-file import paths', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['target'],
      properties: {
        target: { $ref: '#/components/schemas/RefTarget' },
      },
    };

    const result = generateFactory(
      schema,
      'WithRefCombined',
      createMockContext({
        factoryMethods: {
          ...baseFactoryMethods,
          mode: 'combined-separate-file',
        },
      }),
    );
    expect(result?.imports).not.toContainEqual({
      name: 'createRefTarget',
      importPath: './factoryMethods',
      isConstant: true,
    });
  });

  it('breaks cycles automatically (direct parent child)', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['child'],
      properties: {
        child: { $ref: '#/components/schemas/CircularChild' },
      },
    };

    const result = generateFactory(
      schema,
      'CircularParent',
      createMockContext(),
    );
    expect(result?.model).toContain('child: {} as CircularChild');
  });

  it('breaks deep cycles automatically', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['b'],
      properties: {
        b: { $ref: '#/components/schemas/DeepCircularB' },
      },
    };

    const result = generateFactory(
      schema,
      'DeepCircularA',
      createMockContext(),
    );
    expect(result?.model).toContain('b: {} as DeepCircularB');
  });

  it('uses string literal for date/date-time format when useDates is false', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['createdAt'],
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
      },
    };

    const result = generateFactory(schema, 'Dates', createMockContext());
    expect(result?.model).toContain("createdAt: '");
  });

  it('uses Date object for date/date-time format when useDates is true', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['createdAt'],
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
      },
    };

    const result = generateFactory(
      schema,
      'Dates',
      createMockContext({ override: { useDates: true } }),
    );
    expect(result?.model).toContain('createdAt: new Date(0)');
  });

  it('handles date/date-time default values with useDates = true', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['dateField'],
      properties: {
        dateField: { type: 'string', format: 'date', default: '2026-01-01' },
      },
    };

    const result = generateFactory(
      schema,
      'DateDefaultObj',
      createMockContext({ override: { useDates: true } }),
    );
    expect(result?.model).toContain("dateField: new Date('2026-01-01')");
  });

  it('handles enums with strings and numbers', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['status', 'count'],
      properties: {
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
        count: { type: 'number', enum: [100, 200] },
      },
    };

    const result = generateFactory(schema, 'WithEnum', createMockContext());
    expect(result?.model).toContain('status: "ACTIVE"');
    expect(result?.model).toContain('count: 100');
  });

  it('handles allOf appropriately', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      allOf: [
        {
          type: 'object',
          required: ['a'],
          properties: { a: { type: 'string' } },
        },
        {
          type: 'object',
          required: ['b'],
          properties: { b: { type: 'number' } },
        },
      ],
    };

    const result = generateFactory(schema, 'Combined', createMockContext());
    expect(result?.model).toContain(
      "Object.assign({}, {\n    a: ''\n  }, {\n    b: 0\n  })",
    );
  });

  it('sorts properties alphabetically when configured', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['z', 'a', 'm'],
      properties: {
        z: { type: 'number' },
        a: { type: 'string' },
        m: { type: 'boolean' },
      },
    };

    const result = generateFactory(
      schema,
      'SortedObj',
      createMockContext({ propertySortOrder: 'Alphabetical' }),
    );
    expect(result?.model).toMatch(/a: '',[\s\S]*m: false,[\s\S]*z: 0/);
  });

  it('handles const, default, null, array type arrays, and array constraints', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: [
        'withConst',
        'withDefault',
        'withDefaultObj',
        'nullField',
        'multiType',
        'arrayConstraints',
        'tupleArray',
      ],
      properties: {
        withConst: { type: 'string', const: 'STATIC_VALUE' },
        withDefault: { type: 'number', default: 42 },
        withDefaultObj: { type: 'object', default: { key: 'val' } },
        nullField: { type: 'null' as unknown as string },
        multiType: { type: ['string', 'null'] as unknown as string[] },
        arrayConstraints: {
          type: 'array',
          minItems: 2,
          items: { type: 'string' },
        },
        tupleArray: {
          type: 'array',
          prefixItems: [{ type: 'number' }, { type: 'boolean' }],
        },
      },
    };

    const result = generateFactory(schema, 'AdvancedObj', createMockContext());
    expect(result?.model).toContain('withConst: "STATIC_VALUE"');
    expect(result?.model).toContain('withDefault: 42');
    expect(result?.model).toContain('withDefaultObj: {"key":"val"}');
    expect(result?.model).toContain('nullField: null');
    expect(result?.model).toContain("multiType: ''");
    expect(result?.model).toContain("arrayConstraints: ['', '']");
    expect(result?.model).toContain('tupleArray: [0, false]');
  });

  it('handles anyOf and oneOf by picking the first option', () => {
    const schemaOneOf: OpenApiSchemaObject = {
      type: 'object',
      oneOf: [
        {
          type: 'object',
          required: ['a'],
          properties: { a: { type: 'string' } },
        },
        {
          type: 'object',
          required: ['b'],
          properties: { b: { type: 'number' } },
        },
      ],
    };

    const resultOneOf = generateFactory(
      schemaOneOf,
      'Combined',
      createMockContext(),
    );
    expect(resultOneOf?.model).toContain("{\n    a: ''\n  }");

    const schemaAnyOf: OpenApiSchemaObject = {
      type: 'object',
      anyOf: [
        {
          type: 'object',
          required: ['x'],
          properties: { x: { type: 'boolean' } },
        },
        {
          type: 'object',
          required: ['y'],
          properties: { y: { type: 'string' } },
        },
      ],
    };

    const resultAnyOf = generateFactory(
      schemaAnyOf,
      'CombinedAny',
      createMockContext(),
    );
    expect(resultAnyOf?.model).toContain('{\n    x: false\n  }');
  });

  it('handles root array schemas', () => {
    const schema: OpenApiSchemaObject = {
      type: 'array',
      items: { type: 'string' },
    };

    const result = generateFactory(schema, 'StringArray', createMockContext());
    expect(result?.model).toContain(
      'export function createStringArray(): StringArray {',
    );
    expect(result?.model).toContain('return []');
  });

  it('handles root enum schemas', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      enum: ['FIRST', 'SECOND'],
    };

    const result = generateFactory(schema, 'StringEnum', createMockContext());
    expect(result?.model).toContain('return "FIRST"');
  });

  it('infers implicit types for arrays and enums', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: [
        'implicitArray',
        'implicitEnum',
        'implicitNumEnum',
        'implicitBoolEnum',
      ],
      properties: {
        implicitArray: { items: { type: 'number' } },
        implicitEnum: { enum: ['A', 'B'] },
        implicitNumEnum: { enum: [1, 2] },
        implicitBoolEnum: { enum: [true, false] },
      },
    };

    const result = generateFactory(schema, 'ImplicitObj', createMockContext());
    expect(result?.model).toContain('implicitArray: []');
    expect(result?.model).toContain('implicitEnum: "A"');
    expect(result?.model).toContain('implicitNumEnum: 1');
    expect(result?.model).toContain('implicitBoolEnum: true');
  });

  it('returns undefined as unknown for unsupported types', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['weirdField'],
      properties: {
        weirdField: { type: 'weird' as unknown },
      },
    };

    const result = generateFactory(schema, 'WeirdObj', createMockContext());
    expect(result?.model).toContain('weirdField: undefined as unknown');
  });

  it('escapes quotes in string enums', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      enum: ["O'Reilly"],
    };

    const result = generateFactory(schema, 'EscapedEnum', createMockContext());
    expect(result?.model).toContain(`return "O'Reilly"`);
  });

  it('escapes backslashes and quotes properly', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      enum: [String.raw`C:\temp\folder\file's`],
    };

    const result = generateFactory(
      schema,
      'EscapedBackslashEnum',
      createMockContext(),
    );
    expect(result?.model).toContain(
      String.raw`return "C:\\temp\\folder\\file's"`,
    );
  });

  it('omits optional $ref properties when readOnly is set on the reference itself', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        user: {
          $ref: '#/components/schemas/RefTarget',
          readOnly: true,
        } as unknown as OpenApiSchemaObject,
        token: {
          $ref: '#/components/schemas/RefTarget',
          writeOnly: true,
        } as unknown as OpenApiSchemaObject,
      },
    };

    const result = generateFactory(schema, 'AuthPayload', createMockContext());
    expect(result?.model).not.toContain('user: createRefTarget()');
    expect(result?.model).toContain('token: createRefTarget()');
  });
});
