import { describe, expect, it } from 'vitest';

import { dedupeUnionType, jsStringEscape } from './string';

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

describe('jsStringEscape', () => {
  describe('basic escaping', () => {
    it('should escape double quotes', () => {
      expect(jsStringEscape('say "hello"')).toBe(String.raw`say \"hello\"`);
    });

    it('should escape single quotes', () => {
      expect(jsStringEscape("don't")).toBe(String.raw`don\'t`);
    });

    it('should escape backslashes', () => {
      expect(jsStringEscape(String.raw`path\to\file`)).toBe(
        String.raw`path\\to\\file`,
      );
    });

    it('should escape multiple occurrences', () => {
      expect(jsStringEscape('"hello" and "world"')).toBe(
        String.raw`\"hello\" and \"world\"`,
      );
    });

    it('should escape forward slashes', () => {
      expect(jsStringEscape('path/to/file')).toBe(String.raw`path\/to\/file`);
    });

    it('should escape asterisks', () => {
      expect(jsStringEscape('hello*world')).toBe(String.raw`hello\*world`);
    });

    it('should escape comment start delimiter (/*)', () => {
      expect(jsStringEscape('/* comment */')).toBe(
        String.raw`\/\* comment \*\/`,
      );
    });

    it('should escape comment end delimiter (*/)', () => {
      expect(jsStringEscape('end */')).toBe(String.raw`end \*\/`);
    });
  });

  describe('line terminators', () => {
    it('should escape newline character', () => {
      expect(jsStringEscape('line1\nline2')).toBe(String.raw`line1\nline2`);
    });

    it('should escape carriage return character', () => {
      expect(jsStringEscape('line1\rline2')).toBe(String.raw`line1\rline2`);
    });

    it(String.raw`should escape line separator (\u2028)`, () => {
      expect(jsStringEscape('line1\u2028line2')).toBe(
        String.raw`line1\u2028line2`,
      );
    });

    it(String.raw`should escape paragraph separator (\u2029)`, () => {
      expect(jsStringEscape('line1\u2029line2')).toBe(
        String.raw`line1\u2029line2`,
      );
    });

    it(String.raw`should escape Windows line ending (\r\n)`, () => {
      expect(jsStringEscape('line1\r\nline2')).toBe(String.raw`line1\r\nline2`);
    });
  });

  describe('combined characters', () => {
    it('should escape multiple different characters', () => {
      expect(jsStringEscape('say "hello"\nand \'world\'')).toBe(
        String.raw`say \"hello\"\nand \'world\'`,
      );
    });

    it('should escape backslashes with quotes', () => {
      expect(jsStringEscape(String.raw`path\to\"file"`)).toBe(
        String.raw`path\\to\\\"file\"`,
      );
    });

    it('should escape all special characters together', () => {
      expect(jsStringEscape('"quotes"\n\r\u2028\u2029\\backslash/*')).toBe(
        String.raw`\"quotes\"\n\r\u2028\u2029\\backslash\/\*`,
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(jsStringEscape('')).toBe('');
    });

    it('should handle string with no special characters', () => {
      expect(jsStringEscape('hello world')).toBe('hello world');
    });

    it('should handle string with only special characters', () => {
      expect(jsStringEscape('"\'\\\n/*')).toBe(String.raw`\"\'\\\n\/\*`);
    });

    it('should handle string starting with special character', () => {
      expect(jsStringEscape('"hello')).toBe(String.raw`\"hello`);
    });

    it('should handle string ending with special character', () => {
      expect(jsStringEscape('hello"')).toBe(String.raw`hello\"`);
    });

    it('should handle consecutive special characters', () => {
      expect(jsStringEscape('""')).toBe(String.raw`\"\"`);
      expect(jsStringEscape("''")).toBe(String.raw`\'\'`);
      expect(jsStringEscape(String.raw`\\`)).toBe(String.raw`\\\\`);
      expect(jsStringEscape('\n\n')).toBe(String.raw`\n\n`);
      expect(jsStringEscape('/*')).toBe(String.raw`\/\*`);
      expect(jsStringEscape('*/')).toBe(String.raw`\*\/`);
    });
  });
});
