import { describe, expect, it } from 'vitest';

import { NamingConvention, type OpenApiSchemaObject } from '../types';
import {
  getEnumDescriptions,
  getEnumImplementation,
  getEnumNames,
} from './enum';

describe('getEnumImplementation', () => {
  it('should generate enum keys without naming convention', () => {
    const result = getEnumImplementation("'created_at' | '-created_at'");

    // Without naming convention, keys preserve the original form
    expect(result).toContain('created_at');
    expect(result).toContain("'-created_at'");
  });

  describe('PascalCase naming convention', () => {
    it('should disambiguate keys that would collide after PascalCase transform', () => {
      const result = getEnumImplementation(
        "'created_at' | '-created_at' | 'email' | '-email'",
        undefined,
        undefined,
        NamingConvention.PASCAL_CASE,
      );

      expect(result).toContain('CreatedAt');
      expect(result).toContain('MinusCreatedAt');
      expect(result).toContain('Email');
      expect(result).toContain('MinusEmail');

      // All four values are present
      expect(result).toContain("'created_at'");
      expect(result).toContain("'-created_at'");
      expect(result).toContain("'email'");
      expect(result).toContain("'-email'");

      // No duplicate keys
      const lines = result.split('\n').filter((l) => l.includes(':'));
      const keys = lines.map((l) => l.trim().split(':')[0].replaceAll("'", ''));
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('should handle "+" prefix the same way', () => {
      const result = getEnumImplementation(
        "'score' | '+score' | '-score'",
        undefined,
        undefined,
        NamingConvention.PASCAL_CASE,
      );

      expect(result).toContain('Score');
      expect(result).toContain('PlusScore');
      expect(result).toContain('MinusScore');
    });

    it('should not affect enums without special characters', () => {
      const result = getEnumImplementation(
        "'active' | 'inactive' | 'pending'",
        undefined,
        undefined,
        NamingConvention.PASCAL_CASE,
      );

      expect(result).toContain('Active');
      expect(result).toContain('Inactive');
      expect(result).toContain('Pending');
    });

    it('should not change keys when dash values do not collide', () => {
      // "-date" alone (no "date") should still produce "Date", not "MinusDate"
      const result = getEnumImplementation(
        "'-date' | 'name'",
        undefined,
        undefined,
        NamingConvention.PASCAL_CASE,
      );

      expect(result).toContain('Date');
      expect(result).toContain('Name');
      expect(result).not.toContain('Minus');
    });
  });
});

describe('getEnumDescriptions', () => {
  it('should return undefined when no descriptions are present', () => {
    const schema = { enum: ['a', 'b'] } as OpenApiSchemaObject;
    expect(getEnumDescriptions(schema)).toBeUndefined();
  });

  it('should handle array format (existing behavior)', () => {
    const schema = {
      enum: ['active', 'inactive'],
      'x-enumDescriptions': ['Active status', 'Inactive status'],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumDescriptions(schema)).toEqual([
      'Active status',
      'Inactive status',
    ]);
  });

  it('should handle object/Map format (Redocly spec)', () => {
    const schema = {
      enum: ['active', 'inactive'],
      'x-enumDescriptions': {
        active: 'Active status',
        inactive: 'Inactive status',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumDescriptions(schema)).toEqual([
      'Active status',
      'Inactive status',
    ]);
  });

  it('should handle object format with partial descriptions', () => {
    const schema = {
      enum: ['active', 'inactive', 'pending'],
      'x-enumDescriptions': {
        active: 'Active status',
        pending: 'Pending status',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumDescriptions(schema)).toEqual([
      'Active status',
      undefined,
      'Pending status',
    ]);
  });

  it('should handle object format with numeric enum values', () => {
    const schema = {
      enum: [0, 1, 2],
      'x-enumDescriptions': {
        '0': 'Zero',
        '1': 'One',
        '2': 'Two',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumDescriptions(schema)).toEqual(['Zero', 'One', 'Two']);
  });

  it('should escape special characters in descriptions (array format)', () => {
    const schema = {
      enum: ['a'],
      'x-enumDescriptions': ["It's a test"],
    } as unknown as OpenApiSchemaObject;

    const result = getEnumDescriptions(schema);
    expect(result).toBeDefined();
    expect(result?.[0]).toBe(String.raw`It\'s a test`);
  });

  it('should escape special characters in descriptions (object format)', () => {
    const schema = {
      enum: ['a'],
      'x-enumDescriptions': {
        a: "It's a test",
      },
    } as unknown as OpenApiSchemaObject;

    const result = getEnumDescriptions(schema);
    expect(result).toBeDefined();
    expect(result?.[0]).toBe(String.raw`It\'s a test`);
  });

  it('should support x-enumdescriptions (lowercase) in object format', () => {
    const schema = {
      enum: ['a', 'b'],
      'x-enumdescriptions': {
        a: 'Description A',
        b: 'Description B',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumDescriptions(schema)).toEqual([
      'Description A',
      'Description B',
    ]);
  });

  it('should support x-enum-descriptions (hyphenated) in object format', () => {
    const schema = {
      enum: ['a', 'b'],
      'x-enum-descriptions': {
        a: 'Description A',
        b: 'Description B',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumDescriptions(schema)).toEqual([
      'Description A',
      'Description B',
    ]);
  });
});

describe('getEnumNames', () => {
  it('should return undefined when no names are present', () => {
    const schema = { enum: ['a', 'b'] } as OpenApiSchemaObject;
    expect(getEnumNames(schema)).toBeUndefined();
  });

  it('should handle array format (existing behavior)', () => {
    const schema = {
      enum: ['a', 'b'],
      'x-enumNames': ['Alpha', 'Beta'],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumNames(schema)).toEqual(['Alpha', 'Beta']);
  });

  it('should handle object/Map format', () => {
    const schema = {
      enum: ['a', 'b'],
      'x-enumNames': {
        a: 'Alpha',
        b: 'Beta',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumNames(schema)).toEqual(['Alpha', 'Beta']);
  });

  it('should handle object format with partial names', () => {
    const schema = {
      enum: ['a', 'b', 'c'],
      'x-enumNames': {
        a: 'Alpha',
        c: 'Charlie',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumNames(schema)).toEqual(['Alpha', undefined, 'Charlie']);
  });
});

describe('getEnumImplementation with object-format descriptions', () => {
  it('should generate JSDoc comments from object format descriptions', () => {
    const schema = {
      enum: ['active', 'inactive'],
      'x-enumDescriptions': {
        active: 'Active status',
        inactive: 'Inactive status',
      },
    } as unknown as OpenApiSchemaObject;

    const descriptions = getEnumDescriptions(schema);
    const result = getEnumImplementation(
      "'active' | 'inactive'",
      undefined,
      descriptions,
    );

    expect(result).toContain('/** Active status */');
    expect(result).toContain('/** Inactive status */');
    expect(result).toContain("active: 'active'");
    expect(result).toContain("inactive: 'inactive'");
  });

  it('should skip JSDoc for undefined descriptions in partial object format', () => {
    const schema = {
      enum: ['active', 'inactive'],
      'x-enumDescriptions': {
        active: 'Active status',
      },
    } as unknown as OpenApiSchemaObject;

    const descriptions = getEnumDescriptions(schema);
    const result = getEnumImplementation(
      "'active' | 'inactive'",
      undefined,
      descriptions,
    );

    expect(result).toContain('/** Active status */');
    // inactive should not have a JSDoc comment
    const lines = result.split('\n');
    const inactiveLine = lines.findIndex((l) =>
      l.includes("inactive: 'inactive'"),
    );
    expect(lines[inactiveLine - 1]).not.toContain('/**');
  });
});
