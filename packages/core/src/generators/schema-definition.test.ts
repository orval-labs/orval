import type { SchemasObject } from 'openapi3-ts/oas30';
import { describe, expect, it } from 'vitest';

import type { ContextSpecs, InputFiltersOption } from '../types';
import { generateSchemasDefinition } from './schema-definition';

describe('generateSchemasDefinition', () => {
  const context: ContextSpecs = {
    specKey: 'testSpec',
    output: {
      override: {},
    } as any,
    target: 'typescript',
    specs: {},
  } as any;

  it('should return an empty array if schemas are empty', () => {
    const result = generateSchemasDefinition({}, context, 'Suffix');
    expect(result).toEqual([]);
  });

  it('should generate schemas without filters', () => {
    const schemas: SchemasObject = {
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
    const schemas: SchemasObject = {
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

    const filters: InputFiltersOption = {
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
    const schemas: SchemasObject = {
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

    const filters: InputFiltersOption = {
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
    const schemas: SchemasObject = {
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

    const filters: InputFiltersOption = {
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
    const context: ContextSpecs = {
      specKey: 'testSpec',
      output: {
        override: {
          enumGenerationType: 'enum',
          namingConvention: {
            enum: 'PascalCase',
          },
        },
      },
      target: 'typescript',
      specs: {},
    };

    const schemas: SchemasObject = {
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

  it('should order spread enum dependencies before the enum that uses them', () => {
    // Reproduces issue #1511: BlankEnum used before declaration
    // Input order is alphabetical (Aaa... before Zzz...) but ZzzFirst must come before AaaCombined
    const schemas: SchemasObject = {
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

    const specContext: ContextSpecs = {
      ...context,
      output: {
        override: { enumGenerationType: 'const' },
      } as any,
      specs: {
        testSpec: {
          components: { schemas },
        },
      },
    } as ContextSpecs;

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
});
