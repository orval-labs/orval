import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  InputFiltersOptions,
  OpenApiSchemasObject,
} from '../types';
import { generateSchemasDefinition } from './schema-definition';

describe('generateSchemasDefinition', () => {
  const context: ContextSpec = {
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
});
