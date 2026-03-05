import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  InputFiltersOptions,
  OpenApiSchemasObject,
} from '../types';
import { generateSchemasDefinition } from './schema-definition';

describe('generateSchemasDefinition', () => {
  const context: ContextSpec = {
    output: {
      override: { namingConvention: {} },
    },
    target: 'typescript',
    spec: {},
  };

  it('should return an empty array if schemas are empty', () => {
    const result = generateSchemasDefinition({}, context, 'Suffix');
    expect(result).toEqual([]);
  });

  it('should generate schemas without filters', () => {
    const schemas: OpenApiSchemasObject = {
      TestSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
    };

    const result = generateSchemasDefinition(schemas, context, 'Suffix');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('TestSchemaSuffix');
  });

  it('should generate schemas with include filters', () => {
    const schemas: OpenApiSchemasObject = {
      TestSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
      AnotherSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
    };

    const filters: InputFiltersOptions = {
      schemas: ['TestSchema'],
      mode: 'include',
    };

    const result = generateSchemasDefinition(
      schemas,
      context,
      'Suffix',
      filters,
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('TestSchemaSuffix');
  });

  it('should generate schemas with exclude filters', () => {
    const schemas: OpenApiSchemasObject = {
      TestSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
      AnotherSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
    };

    const filters: InputFiltersOptions = {
      schemas: ['TestSchema'],
      mode: 'exclude',
    };

    const result = generateSchemasDefinition(
      schemas,
      context,
      'Suffix',
      filters,
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('AnotherSchemaSuffix');
  });

  it('should generate schemas when filters.schemas is undefined with other filters', () => {
    const schemas: OpenApiSchemasObject = {
      TestSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
      },
      AnotherSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
    };

    const filters: InputFiltersOptions = {
      tags: ['TestTag'],
    };

    const result = generateSchemasDefinition(
      schemas,
      context,
      'Suffix',
      filters,
    );
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('TestSchemaSuffix');
    expect(result[1].name).toBe('AnotherSchemaSuffix');
  });

  it('should generate schemas with changed enum nameConvention', () => {
    const context: ContextSpec = {
      output: {
        override: {
          enumGenerationType: 'enum',
          namingConvention: {
            enum: 'PascalCase',
          },
        },
      },
      target: 'typescript',
      spec: {},
    };

    const schemas: OpenApiSchemasObject = {
      TestSchema: {
        type: 'object',
        properties: {
          testedEnum: {
            type: 'string',
            enum: ['snake_case', 'camelCase'],
          },
        },
      },
    };

    const result = generateSchemasDefinition(schemas, context, 'Suffix');
    expect(result[0].model.includes('SnakeCase')).toBe(true);
    expect(result[0].model.includes('CamelCase')).toBe(true);
  });

  it.each([
    ['anyOf', '|', 'AnyOf'],
    ['oneOf', '|', 'OneOf'],
    ['allOf', '&', 'AllOf'],
  ] as const)(
    'should generate %s with inline objects: type aliases when aliasCombinedTypes is true, inlined by default',
    (combiner, operator, combinerName) => {
      const schemas: OpenApiSchemasObject = {
        Response: {
          [combiner]: [
            { type: 'object', properties: { success: { type: 'boolean' } } },
            { type: 'object', properties: { error: { type: 'string' } } },
          ],
        },
      };

      // With aliasCombinedTypes: true - creates intermediate type aliases
      const aliasContext: ContextSpec = {
        ...context,
        output: {
          ...context.output,
          override: {
            ...context.output.override,
            aliasCombinedTypes: true,
          },
        },
      };
      const aliasResult = generateSchemasDefinition(schemas, aliasContext, '');
      expect(aliasResult).toHaveLength(3);
      expect(aliasResult[0].name).toBe(`Response${combinerName}`);
      expect(aliasResult[0].model).toBe(
        `export type Response${combinerName} = {\n  success?: boolean;\n};\n`,
      );
      expect(aliasResult[1].name).toBe(`Response${combinerName}Two`);
      expect(aliasResult[1].model).toBe(
        `export type Response${combinerName}Two = {\n  error?: string;\n};\n`,
      );
      expect(aliasResult[2].name).toBe('Response');
      expect(aliasResult[2].model).toBe(
        `export type Response = Response${combinerName} ${operator} Response${combinerName}Two;\n`,
      );

      // Default behavior (aliasCombinedTypes defaults to false) - inlines everything
      const inlineResult = generateSchemasDefinition(schemas, context, '');
      expect(inlineResult).toHaveLength(1);
      expect(inlineResult[0].name).toBe('Response');
      expect(inlineResult[0].model).toBe(
        `export type Response = {\n  success?: boolean;\n} ${operator} {\n  error?: string;\n};\n`,
      );
    },
  );

  it('should order spread enum dependencies before the enum that uses them', () => {
    // Reproduces issue #1511: BlankEnum used before declaration
    // Input order is alphabetical (Aaa... before Zzz...) but ZzzFirst must come before AaaCombined
    const schemas: OpenApiSchemasObject = {
      AaaCombined: {
        allOf: [
          { $ref: '#/components/schemas/ZzzFirst' },
          { $ref: '#/components/schemas/ZzzSecond' },
        ],
      },
      ZzzFirst: {
        type: 'string',
        enum: ['a'],
      },
      ZzzSecond: {
        type: 'string',
        enum: ['b'],
      },
    };

    const specContext: ContextSpec = {
      ...context,
      output: {
        override: { enumGenerationType: 'const', namingConvention: {} },
      },
      spec: {
        components: { schemas },
      },
    };

    const result = generateSchemasDefinition(schemas, specContext, '');

    // Verify spread syntax is generated (the pattern that causes TS error if misordered)
    const combinedSchema = result.find((s) => s.name === 'AaaCombined');
    expect(combinedSchema?.model).toContain('...ZzzFirst');
    expect(combinedSchema?.model).toContain('...ZzzSecond');

    // Verify dependencies come before the schema that spreads them
    const order = result.map((schema) => schema.name);
    expect(order.indexOf('ZzzFirst')).toBeLessThan(
      order.indexOf('AaaCombined'),
    );
    expect(order.indexOf('ZzzSecond')).toBeLessThan(
      order.indexOf('AaaCombined'),
    );
  });

  it('should generate combined enum const for oneOf enum refs', () => {
    const schemas: OpenApiSchemasObject = {
      Enum1: {
        type: 'string',
        enum: ['value1', 'value2'],
      },
      Enum2: {
        type: 'string',
        enum: ['valueA', 'valueB'],
      },
      CombinedEnum: {
        oneOf: [
          { $ref: '#/components/schemas/Enum1' },
          { $ref: '#/components/schemas/Enum2' },
        ],
      },
    };

    const specContext: ContextSpec = {
      ...context,
      output: {
        override: { enumGenerationType: 'const', namingConvention: {} },
      },
      spec: {
        components: { schemas },
      },
    };

    const result = generateSchemasDefinition(schemas, specContext, '');
    const combinedSchema = result.find(
      (schema) => schema.name === 'CombinedEnum',
    );

    expect(combinedSchema).toBeDefined();
    expect(combinedSchema?.model).toContain('export const CombinedEnum');
    expect(combinedSchema?.model).toContain('...Enum1');
    expect(combinedSchema?.model).toContain('...Enum2');
    expect(combinedSchema?.model).toContain(
      'export type CombinedEnum = typeof CombinedEnum[keyof typeof CombinedEnum]',
    );
  });

  it('should avoid invalid spreads for nullable or boolean oneOf enums', () => {
    const schemas: OpenApiSchemasObject = {
      NumberEnum: {
        type: 'integer',
        enum: [1, 2, 3],
      },
      BooleanEnum: {
        type: 'boolean',
        enum: [true, false],
      },
      NumberEnumNullable: {
        nullable: true,
        type: 'number',
        enum: [1.5, 2.5, 3.5],
      },
      NumberEnumNotNull: {
        type: 'number',
        enum: [100.1, 200.2],
      },
      MixedBooleanNumberEnum: {
        oneOf: [
          { $ref: '#/components/schemas/NumberEnum' },
          { $ref: '#/components/schemas/BooleanEnum' },
        ],
      },
      MixedNumberEnum: {
        oneOf: [
          { $ref: '#/components/schemas/NumberEnumNullable' },
          { $ref: '#/components/schemas/NumberEnumNotNull' },
        ],
      },
    };

    const specContext: ContextSpec = {
      ...context,
      output: {
        override: { enumGenerationType: 'const', namingConvention: {} },
      },
      spec: {
        components: { schemas },
      },
    };

    const result = generateSchemasDefinition(schemas, specContext, '');
    const mixedBooleanSchema = result.find(
      (schema) => schema.name === 'MixedBooleanNumberEnum',
    );
    const mixedNumberSchema = result.find(
      (schema) => schema.name === 'MixedNumberEnum',
    );

    expect(mixedBooleanSchema?.model).toContain(
      'export const MixedBooleanNumberEnum',
    );
    expect(mixedBooleanSchema?.model).not.toContain('...BooleanEnum');
    expect(mixedNumberSchema?.model).toContain('export const MixedNumberEnum');
    expect(mixedNumberSchema?.model).not.toContain(
      '...NumberEnumNullable | null',
    );
    expect(mixedNumberSchema?.model).toContain(
      'export type MixedNumberEnum = typeof MixedNumberEnum[keyof typeof MixedNumberEnum] | null;',
    );
  });
});
