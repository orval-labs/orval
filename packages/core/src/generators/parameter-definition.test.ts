import { ComponentsObject } from 'openapi3-ts/oas30';
import { describe, expect, it } from 'vitest';
import { ContextSpecs } from '../types';
import { generateParameterDefinition } from './parameter-definition';

describe('generateParameterDefinition', () => {
  const context: ContextSpecs = {
    specKey: 'testSpec',
    output: {
      override: {
        useNativeEnums: false,
        components: {
          schemas: { itemSuffix: 'Parameter' },
        },
      },
    },
    target: 'typescript',
    specs: {},
  };

  it('should return an empty array if parameters are empty', () => {
    const result = generateParameterDefinition({}, context, 'Suffix');
    expect(result).toEqual([]);
  });

  it('should generate parameter definitions for query parameters', () => {
    const parameters: ComponentsObject['parameters'] = {
      PetNames: {
        name: 'names',
        in: 'query',
        schema: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    };
    const result = generateParameterDefinition(
      parameters,
      context,
      'Parameter',
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('PetNamesParameter');
    expect(result[0].model).toBe('export type PetNamesParameter = string[];\n');
  });

  it('should generate parameter definitions for header parameters', () => {
    const parameters: ComponentsObject['parameters'] = {
      XUserId: {
        name: 'X-User-Id',
        in: 'header',
        schema: {
          type: 'string',
        },
      },
    };
    const result = generateParameterDefinition(
      parameters,
      context,
      'Parameter',
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('XUserIdParameter');
    expect(result[0].model).toBe('export type XUserIdParameter = string;\n');
  });

  it('should generate parameter definitions for header parameters', () => {
    const parameters: ComponentsObject['parameters'] = {
      XUserId: {
        name: 'X-User-Id',
        in: 'header',
        schema: {
          type: 'string',
        },
      },
    };
    const result = generateParameterDefinition(
      parameters,
      context,
      'Parameter',
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('XUserIdParameter');
    expect(result[0].model).toBe('export type XUserIdParameter = string;\n');
  });
});
