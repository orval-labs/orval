import { describe, expect, it } from 'vitest';

import {
  EnumGeneration,
  NamingConvention,
  type OpenApiSchemaObject,
} from '../types';
import {
  getEnum,
  getEnumImplementation,
  getEnumMembers,
  getEnumUnion,
} from './enum';

describe('getEnumImplementation', () => {
  it('should generate enum keys without naming convention', () => {
    const result = getEnumImplementation(
      [{ value: 'created_at' }, { value: '-created_at' }],
      {
        enumGenerationType: EnumGeneration.CONST,
      },
    );
    // Without naming convention, keys preserve the original form
    expect(result).toContain('created_at');
    expect(result).toContain("'-created_at'");
  });

  describe('PascalCase naming convention', () => {
    it('should disambiguate keys that would collide after PascalCase transform', () => {
      const result = getEnumImplementation(
        [
          { value: 'created_at' },
          { value: '-created_at' },
          { value: 'email' },
          { value: '-email' },
        ],
        {
          enumNamingConvention: NamingConvention.PASCAL_CASE,
          enumGenerationType: EnumGeneration.CONST,
        },
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
        [{ value: 'score' }, { value: '+score' }, { value: '-score' }],
        {
          enumNamingConvention: NamingConvention.PASCAL_CASE,
          enumGenerationType: EnumGeneration.CONST,
        },
      );

      expect(result).toContain('Score');
      expect(result).toContain('PlusScore');
      expect(result).toContain('MinusScore');
    });

    it('should not affect enums without special characters', () => {
      const result = getEnumImplementation(
        [{ value: 'active' }, { value: 'inactive' }, { value: 'pending' }],
        {
          enumNamingConvention: NamingConvention.PASCAL_CASE,
          enumGenerationType: EnumGeneration.CONST,
        },
      );

      expect(result).toContain('Active');
      expect(result).toContain('Inactive');
      expect(result).toContain('Pending');
    });

    it('should not change keys when dash values do not collide', () => {
      // "-date" alone (no "date") should still produce "Date", not "MinusDate"
      const result = getEnumImplementation(
        [{ value: '-date' }, { value: 'name' }],
        {
          enumNamingConvention: NamingConvention.PASCAL_CASE,
          enumGenerationType: EnumGeneration.CONST,
        },
      );

      expect(result).toContain('Date');
      expect(result).toContain('Name');
      expect(result).not.toContain('Minus');
    });
  });
});

describe('getEnumMembers', () => {
  it('should return enum values without metadata', () => {
    const schema = {
      enum: ['a', 'b'],
    } as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'a',
      },
      {
        value: 'b',
      },
    ]);
  });

  it('should handle enum names in array format', () => {
    const schema = {
      enum: ['a', 'b'],
      'x-enumNames': ['Alpha', 'Beta'],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'a',
        name: 'Alpha',
      },
      {
        value: 'b',
        name: 'Beta',
      },
    ]);
  });

  it('should handle enum names in object format', () => {
    const schema = {
      enum: ['a', 'b'],
      'x-enumNames': {
        a: 'Alpha',
        b: 'Beta',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'a',
        name: 'Alpha',
      },
      {
        value: 'b',
        name: 'Beta',
      },
    ]);
  });

  it('should handle partial enum names', () => {
    const schema = {
      enum: ['a', 'b', 'c'],
      'x-enumNames': {
        a: 'Alpha',
        c: 'Charlie',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'a',
        name: 'Alpha',
      },
      {
        value: 'b',
      },
      {
        value: 'c',
        name: 'Charlie',
      },
    ]);
  });

  it('should generate a nullable const enum', () => {
    const schema = {
      nullable: true,
      type: 'integer',
      enum: [10, 20, 30],
    } as unknown as OpenApiSchemaObject;

    const result = getEnum(
      getEnumMembers(schema),
      'IntegerEnumNullable',
      schema.nullable,
      EnumGeneration.CONST,
    );

    expect(result).toContain(
      'export type IntegerEnumNullable = typeof IntegerEnumNullable[keyof typeof IntegerEnumNullable] | null;',
    );

    expect(result).toContain('export const IntegerEnumNullable = {');

    expect(result).toContain('10: 10');
    expect(result).toContain('20: 20');
    expect(result).toContain('30: 30');
  });

  it('should handle enum descriptions', () => {
    const schema = {
      enum: ['active', 'inactive'],
      'x-enumDescriptions': {
        active: 'Active status',
        inactive: 'Inactive status',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'active',
        description: 'Active status',
      },
      {
        value: 'inactive',
        description: 'Inactive status',
      },
    ]);
  });

  it('should not add null to enum members for a nullable enum', () => {
    const schema = {
      nullable: true,
      type: 'integer',
      enum: [10, 20, 30],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      { value: 10 },
      { value: 20 },
      { value: 30 },
    ]);
  });

  it('should handle names and descriptions together', () => {
    const schema = {
      enum: ['active', 'inactive'],
      'x-enumNames': ['Active', 'Inactive'],
      'x-enumDescriptions': ['Active status', 'Inactive status'],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'active',
        name: 'Active',
        description: 'Active status',
      },
      {
        value: 'inactive',
        name: 'Inactive',
        description: 'Inactive status',
      },
    ]);
  });

  it('should handle enum descriptions in array format', () => {
    const schema = {
      enum: ['active', 'inactive'],
      'x-enumDescriptions': ['Active status', 'Inactive status'],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'active',
        description: 'Active status',
      },
      {
        value: 'inactive',
        description: 'Inactive status',
      },
    ]);
  });

  it('should handle numeric enum values in metadata maps', () => {
    const schema = {
      enum: [0, 1, 2],
      'x-enumDescriptions': {
        '0': 'Zero',
        '1': 'One',
        '2': 'Two',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 0,
        description: 'Zero',
      },
      {
        value: 1,
        description: 'One',
      },
      {
        value: 2,
        description: 'Two',
      },
    ]);
  });

  it('should handle const branches without metadata', () => {
    const schema = {
      oneOf: [{ const: 'PENDING' }, { const: 'APPROVED' }],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'PENDING',
      },
      {
        value: 'APPROVED',
      },
    ]);
  });

  it('should handle const branch names from title', () => {
    const schema = {
      oneOf: [
        {
          const: 'PENDING',
          title: 'Pending',
        },
        {
          const: 'APPROVED',
          title: 'Approved',
        },
      ],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'PENDING',
        name: 'Pending',
      },
      {
        value: 'APPROVED',
        name: 'Approved',
      },
    ]);
  });

  it('should handle const branch descriptions', () => {
    const schema = {
      oneOf: [
        {
          const: 'PENDING',
          description: 'Awaiting manual review',
        },
        {
          const: 'APPROVED',
          description: 'Reviewed and approved',
        },
      ],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'PENDING',
        description: 'Awaiting manual review',
      },
      {
        value: 'APPROVED',
        description: 'Reviewed and approved',
      },
    ]);
  });

  it('should handle deprecated const branches', () => {
    const schema = {
      oneOf: [
        {
          const: 'ACTIVE',
        },
        {
          const: 'LEGACY',
          deprecated: true,
        },
      ],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'ACTIVE',
      },
      {
        value: 'LEGACY',
        deprecated: true,
      },
    ]);
  });

  it('should handle all const branch metadata together', () => {
    const schema = {
      oneOf: [
        {
          const: 'PENDING',
          title: 'Pending',
          description: 'Awaiting manual review',
        },
        {
          const: 'LEGACY',
          title: 'Legacy',
          description: 'No longer issued',
          deprecated: true,
        },
      ],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'PENDING',
        name: 'Pending',
        description: 'Awaiting manual review',
      },
      {
        value: 'LEGACY',
        name: 'Legacy',
        description: 'No longer issued',
        deprecated: true,
      },
    ]);
  });
});

describe('getEnumMembers metadata precedence', () => {
  it('uses metadata from the schema when no outer metadata is present', () => {
    const schema = {
      enum: ['a', 'b'],
      'x-enumNames': ['Alpha', 'Beta'],
      'x-enumDescriptions': ['Description A', 'Description B'],
    } as unknown as OpenApiSchemaObject;

    const metadataObject = {
      enum: ['a', 'b'],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema, metadataObject)).toEqual([
      {
        value: 'a',
        name: 'Alpha',
        description: 'Description A',
      },
      {
        value: 'b',
        name: 'Beta',
        description: 'Description B',
      },
    ]);
  });

  it('should escape enum names in object metadata format', () => {
    const schema = {
      enum: ['a'],
      'x-enumNames': {
        a: "It's active",
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema)).toEqual([
      {
        value: 'a',
        name: String.raw`It\'s active`,
      },
    ]);
  });

  it('prefers metadata from the outer object over schema metadata', () => {
    const schema = {
      enum: ['a', 'b'],
      'x-enumNames': ['SchemaAlpha', 'SchemaBeta'],
      'x-enumDescriptions': ['Schema description A', 'Schema description B'],
    } as unknown as OpenApiSchemaObject;

    const metadataObject = {
      'x-enumNames': ['ParameterAlpha', 'ParameterBeta'],
      'x-enumDescriptions': [
        'Parameter description A',
        'Parameter description B',
      ],
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema, metadataObject)).toEqual([
      {
        value: 'a',
        name: 'ParameterAlpha',
        description: 'Parameter description A',
      },
      {
        value: 'b',
        name: 'ParameterBeta',
        description: 'Parameter description B',
      },
    ]);
  });

  it('only overrides metadata provided by the outer object', () => {
    const schema = {
      enum: ['a', 'b', 'c'],
      'x-enumNames': {
        a: 'Alpha',
        b: 'Beta',
        c: 'Charlie',
      },
      'x-enumDescriptions': {
        a: 'Description A',
        b: 'Description B',
        c: 'Description C',
      },
    } as unknown as OpenApiSchemaObject;

    const metadataObject = {
      'x-enumNames': {
        b: 'ParameterBeta',
      },
      'x-enumDescriptions': {
        c: 'Parameter description C',
      },
    } as unknown as OpenApiSchemaObject;

    expect(getEnumMembers(schema, metadataObject)).toEqual([
      {
        value: 'a',
        name: 'Alpha',
        description: 'Description A',
      },
      {
        value: 'b',
        name: 'ParameterBeta',
        description: 'Description B',
      },
      {
        value: 'c',
        name: 'Charlie',
        description: 'Parameter description C',
      },
    ]);
  });
});

describe('getEnumUnionFromSchema — value escaping (#3505)', () => {
  it('should JS-escape backslashes in enum values', () => {
    const result = getEnumUnion([
      {
        value: String.raw`App\Models\Document`,
      },
      {
        value: String.raw`App\Models\Template`,
      },
    ]);

    expect(result).toBe(
      String.raw`'App\\Models\\Document' | 'App\\Models\\Template'`,
    );
  });

  it('should JS-escape a value ending in a backslash', () => {
    const result = getEnumUnion([
      {
        value: 'C:\\logs\\',
      },
    ]);
    expect(result).toBe(String.raw`'C:\\logs\\'`);
  });

  it('should not escape forward slashes (#3530)', () => {
    const result = getEnumUnion([
      {
        value: 'Asia/Tokyo',
      },
      {
        value: 'America/New_York',
      },
    ]);

    expect(result).toBe("'Asia/Tokyo' | 'America/New_York'");
  });

  it('should not escape asterisks', () => {
    const result = getEnumUnion([
      {
        value: 'a*b',
      },
    ]);

    expect(result).toBe("'a*b'");
  });
});

describe('getEnumImplementation — backslash escaping (#3505)', () => {
  it('should preserve backslash-escaped values in keys and values of the const body', () => {
    const result = getEnumImplementation(
      [
        { value: String.raw`App\Models\Document` },
        { value: String.raw`App\Models\Template` },
      ],
      {
        enumGenerationType: EnumGeneration.CONST,
      },
    );

    expect(result).toContain(
      String.raw`'App\\Models\\Document': 'App\\Models\\Document'`,
    );
    expect(result).toContain(
      String.raw`'App\\Models\\Template': 'App\\Models\\Template'`,
    );
  });
});

describe('getEnumImplementation with object-format descriptions', () => {
  it('should generate JSDoc comments from enum member descriptions', () => {
    const result = getEnumImplementation(
      [
        {
          value: 'active',
          description: 'Active status',
        },
        {
          value: 'inactive',
          description: 'Inactive status',
        },
      ],
      {
        enumGenerationType: EnumGeneration.CONST,
      },
    );

    expect(result).toContain('/** Active status */');
    expect(result).toContain('/** Inactive status */');
    expect(result).toContain("active: 'active'");
    expect(result).toContain("inactive: 'inactive'");
  });

  it('should skip JSDoc for undefined descriptions', () => {
    const result = getEnumImplementation(
      [
        {
          value: 'active',
          description: 'Active status',
        },
        {
          value: 'inactive',
        },
      ],
      {
        enumGenerationType: EnumGeneration.CONST,
      },
    );

    expect(result).toContain('/** Active status */');

    const lines = result.split('\n');
    const inactiveLine = lines.findIndex((line) =>
      line.includes("inactive: 'inactive'"),
    );

    expect(inactiveLine).toBeGreaterThan(0);
    expect(lines[inactiveLine - 1]).not.toContain('/**');
  });
});

describe('getEnum integer const coercion (#3758)', () => {
  it('does not throw when value is a numeric string from integer const/enum', () => {
    // After the scalar fix, value is already a string; this guards the helper
    // itself against non-string inputs so the crash cannot resurface.
    const result = getEnum(
      [
        {
          value: 1,
        },
      ],
      'Flag',
      false,
      EnumGeneration.CONST,
    );
    expect(result).toContain('export type Flag');
    expect(result).toContain('export const Flag');
  });
});
