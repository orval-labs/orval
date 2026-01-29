import { describe, expect, it } from 'vitest';

import { dedupeUnionType } from './string';

describe('dedupeUnionType', () => {
  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(dedupeUnionType('')).toBe('');
    });

    it('should handle single type', () => {
      expect(dedupeUnionType('Pet')).toBe('Pet');
    });

    it('should handle whitespace variations', () => {
      expect(dedupeUnionType('Pet|Pet')).toBe('Pet');
      expect(dedupeUnionType('Pet  |  Pet')).toBe('Pet');
      expect(dedupeUnionType('  Pet | Pet  ')).toBe('Pet');
    });

    it('should preserve order when removing duplicates', () => {
      expect(dedupeUnionType('A | B | A | C | B')).toBe('A | B | C');
    });
  });

  describe('nested structures', () => {
    it('should only split on top-level |', () => {
      expect(dedupeUnionType("{ a: 'x' | 'y' } | { b: 'z' }")).toBe(
        "{ a: 'x' | 'y' } | { b: 'z' }",
      );
      expect(dedupeUnionType("('a' | 'b')[] | string")).toBe(
        "('a' | 'b')[] | string",
      );
      expect(dedupeUnionType("Array<'a' | 'b'> | string")).toBe(
        "Array<'a' | 'b'> | string",
      );
      expect(dedupeUnionType('[string | number, boolean] | null')).toBe(
        '[string | number, boolean] | null',
      );
    });

    it('should dedupe identical complex types', () => {
      expect(dedupeUnionType("{ a: 'x' | 'y' } | { a: 'x' | 'y' }")).toBe(
        "{ a: 'x' | 'y' }",
      );
    });
  });
});
