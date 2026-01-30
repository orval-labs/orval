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
    it('should not corrupt objects with similar nested unions', () => {
      // If we incorrectly split on inner |, "{ a: 'x'" would appear twice and get deduped
      expect(dedupeUnionType("{ a: 'x' | 'y' } | { a: 'x' | 'z' }")).toBe(
        "{ a: 'x' | 'y' } | { a: 'x' | 'z' }",
      );
    });

    it('should not corrupt parenthesized unions with similar content', () => {
      // If we incorrectly split on inner |, "'a'" would appear twice and get deduped
      expect(dedupeUnionType("('a' | 'b')[] | ('a' | 'c')[]")).toBe(
        "('a' | 'b')[] | ('a' | 'c')[]",
      );
    });

    it('should not corrupt generics with similar type parameters', () => {
      // If we incorrectly split on inner |, "Array<'a'" would appear twice and get deduped
      expect(dedupeUnionType("Array<'a' | 'b'> | Array<'a' | 'c'>")).toBe(
        "Array<'a' | 'b'> | Array<'a' | 'c'>",
      );
    });

    it('should not corrupt tuples with similar element types', () => {
      // If we incorrectly split on inner |, "[string" would appear twice and get deduped
      expect(dedupeUnionType('[string | number] | [string | boolean]')).toBe(
        '[string | number] | [string | boolean]',
      );
    });

    it('should dedupe identical complex types', () => {
      expect(dedupeUnionType("{ a: 'x' | 'y' } | { a: 'x' | 'y' }")).toBe(
        "{ a: 'x' | 'y' }",
      );
      expect(dedupeUnionType("('a' | 'b')[] | ('a' | 'b')[]")).toBe(
        "('a' | 'b')[]",
      );
      expect(dedupeUnionType("Array<'a' | 'b'> | Array<'a' | 'b'>")).toBe(
        "Array<'a' | 'b'>",
      );
    });

    it('should not split on | inside string literals', () => {
      // If we incorrectly split inside the string, "'a" would appear twice and get deduped
      expect(dedupeUnionType("'a | a' | 'a | b'")).toBe("'a | a' | 'a | b'");
      expect(dedupeUnionType('"a | a" | "a | b"')).toBe('"a | a" | "a | b"');
      // Verify deduping still works for identical string literals
      expect(dedupeUnionType("'a | a' | 'a | a'")).toBe("'a | a'");
      // Without escape handling, \' would close the string, trapping | inside
      expect(dedupeUnionType("'it\\'s' | 'it\\'s'")).toBe("'it\\'s'");
    });

    it('should not be confused by unbalanced brackets inside string literals', () => {
      // The duplicate 'a' should be deduped. If the '(' inside the string
      // incorrectly affects bracket depth, deduping wouldn't happen.
      expect(dedupeUnionType("a | '(' | a")).toBe("a | '('");
      expect(dedupeUnionType("a | '{' | a")).toBe("a | '{'");
      expect(dedupeUnionType("a | '[' | a")).toBe("a | '['");
      expect(dedupeUnionType("a | '<' | a")).toBe("a | '<'");
    });
  });
});
