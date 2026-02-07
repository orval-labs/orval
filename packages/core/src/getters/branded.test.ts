import { describe, expect, it } from 'vitest';

import type { BrandedTypeRegistry, OpenApiSchemaObject } from '../types';
import {
  BRANDABLE_TYPES,
  createBrandedTypeRegistry,
  extractBrandName,
  isBrandableSchemaType,
  registerBrandedType,
} from './branded';

describe('extractBrandName', () => {
  it('should extract x-brand string value correctly', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': 'Email',
    };

    expect(extractBrandName(schema)).toBe('Email');
  });

  it('should return undefined for non-string x-brand values', () => {
    const schemaNumber: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': 123,
    };
    expect(extractBrandName(schemaNumber)).toBeUndefined();

    const schemaObject: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': { name: 'Email' },
    };

    expect(extractBrandName(schemaObject)).toBeUndefined();

    const schemaNull: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': null,
    };

    expect(extractBrandName(schemaNull)).toBeUndefined();
  });

  it('should convert brand names to PascalCase', () => {
    const schemaLowercase: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': 'email',
    };

    expect(extractBrandName(schemaLowercase)).toBe('Email');

    const schemaCamelCase: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': 'userId',
    };

    expect(extractBrandName(schemaCamelCase)).toBe('UserId');

    const schemaSnakeCase: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': 'user_id',
    };

    expect(extractBrandName(schemaSnakeCase)).toBe('UserId');

    const schemaKebabCase: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': 'user-id',
    };

    expect(extractBrandName(schemaKebabCase)).toBe('UserId');

    const schemaMultipleWords: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': 'my_branded_type',
    };

    expect(extractBrandName(schemaMultipleWords)).toBe('MyBrandedType');
  });

  it('should handle brand names starting with numbers', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      'x-brand': '123Id',
    };

    expect(extractBrandName(schema)).toBe('N123Id');
  });
});

describe('isBrandableSchemaType', () => {
  it('should return true for string type', () => {
    const schema: OpenApiSchemaObject = { type: 'string' };
    expect(isBrandableSchemaType(schema)).toBe(true);
  });

  it('should return true for number type', () => {
    const schema: OpenApiSchemaObject = { type: 'number' };
    expect(isBrandableSchemaType(schema)).toBe(true);
  });

  it('should return true for integer type (OpenAPI)', () => {
    const schema: OpenApiSchemaObject = { type: 'integer' };
    expect(isBrandableSchemaType(schema)).toBe(true);
  });

  it('should return true for boolean type', () => {
    const schema: OpenApiSchemaObject = { type: 'boolean' };
    expect(isBrandableSchemaType(schema)).toBe(true);
  });

  it('should return false for object type', () => {
    const schema: OpenApiSchemaObject = { type: 'object' };
    expect(isBrandableSchemaType(schema)).toBe(false);
  });

  it('should return false for array type', () => {
    const schema: OpenApiSchemaObject = { type: 'array' };
    expect(isBrandableSchemaType(schema)).toBe(false);
  });

  it('should return false when type is undefined', () => {
    const schema: OpenApiSchemaObject = {};
    expect(isBrandableSchemaType(schema)).toBe(false);
  });

  it('should return false when type is an array (union types in OpenAPI 3.1)', () => {
    const schema: OpenApiSchemaObject = {
      type: ['string', 'null'],
    };
    expect(isBrandableSchemaType(schema)).toBe(false);
  });
});

describe('createBrandedTypeRegistry', () => {
  it('should return an empty Map', () => {
    const registry = createBrandedTypeRegistry();
    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBe(0);
  });
});

describe('registerBrandedType', () => {
  it('should register a new branded type successfully', () => {
    const registry: BrandedTypeRegistry = new Map();

    registerBrandedType(registry, 'UserId', 'number');

    expect(registry.size).toBe(1);
    expect(registry.get('UserId')).toEqual({
      name: 'UserId',
      baseType: 'number',
      brand: 'UserId',
    });
  });

  it('should allow same brand name with same base type (idempotent)', () => {
    const registry: BrandedTypeRegistry = new Map();

    registerBrandedType(registry, 'UserId', 'number');
    registerBrandedType(registry, 'UserId', 'number');

    expect(registry.size).toBe(1);
  });

  it('should throw error when brand name used with different base types', () => {
    const registry: BrandedTypeRegistry = new Map();

    registerBrandedType(registry, 'Id', 'number');

    expect(() => {
      registerBrandedType(registry, 'Id', 'string');
    }).toThrow(
      'Branded type conflict: "Id" is used with different base types: "number" and "string"',
    );
  });

  it('should throw error when brand name conflicts with schema name', () => {
    const registry: BrandedTypeRegistry = new Map();
    const schemaNames = new Set(['UserId', 'Pet', 'Order']);

    expect(() => {
      registerBrandedType(registry, 'UserId', 'number', schemaNames);
    }).toThrow(
      'Branded type name collision: "UserId" conflicts with an existing schema name',
    );
  });

  it('should register multiple different branded types', () => {
    const registry: BrandedTypeRegistry = new Map();

    registerBrandedType(registry, 'UserId', 'number');
    registerBrandedType(registry, 'Email', 'string');
    registerBrandedType(registry, 'IsActive', 'boolean');

    expect(registry.size).toBe(3);
    expect(registry.get('UserId')?.baseType).toBe('number');
    expect(registry.get('Email')?.baseType).toBe('string');
    expect(registry.get('IsActive')?.baseType).toBe('boolean');
  });

  it('should register branded type with Date base type (useDates)', () => {
    const registry: BrandedTypeRegistry = new Map();

    registerBrandedType(registry, 'CreatedAt', 'Date');

    expect(registry.get('CreatedAt')).toEqual({
      name: 'CreatedAt',
      baseType: 'Date',
      brand: 'CreatedAt',
    });
  });

  it('should register branded type with bigint base type (useBigInt)', () => {
    const registry: BrandedTypeRegistry = new Map();

    registerBrandedType(registry, 'UserId', 'bigint');

    expect(registry.get('UserId')).toEqual({
      name: 'UserId',
      baseType: 'bigint',
      brand: 'UserId',
    });
  });
});
