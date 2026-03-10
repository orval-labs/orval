import { describe, expect, it } from 'vitest';

import { NamingConvention } from '../types';
import { getEnumImplementation } from './enum';

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

      // "-" is replaced with "Minus" before PascalCase, so both values
      // produce distinct keys
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
  });
});
