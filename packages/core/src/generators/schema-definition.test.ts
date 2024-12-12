import { describe, expect, it } from 'vitest';
import type { ContextSpecs, InputFiltersOption, SchemasObject } from '../types';
import { generateSchemasDefinition } from './schema-definition';

describe('generateSchemasDefinition', () => {
  const context: ContextSpecs = {
    specKey: 'testSpec',
    output: {
      override: {
        useNativeEnums: false,
      },
    },
    target: 'typescript',
    specs: {},
  };

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
});
