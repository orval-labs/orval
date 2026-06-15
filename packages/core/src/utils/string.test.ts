import { describe, expect, it } from 'vitest';

import {
  dedupeUnionType,
  escape,
  escapeRegExp,
  jsStringEscape,
  jsStringLiteralEscape,
  stringify,
} from './string';

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
      expect(dedupeUnionType(String.raw`'it\'s' | 'it\'s'`)).toBe(
        String.raw`'it\'s'`,
      );
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

describe('jsStringLiteralEscape', () => {
  describe('escapes only what a single-quoted string literal needs', () => {
    it('escapes single quotes', () => {
      expect(jsStringLiteralEscape("don't")).toBe(String.raw`don\'t`);
    });

    it('escapes backslashes', () => {
      expect(jsStringLiteralEscape(String.raw`path\to\file`)).toBe(
        String.raw`path\\to\\file`,
      );
    });

    it('escapes line terminators', () => {
      expect(jsStringLiteralEscape('line1\nline2')).toBe(
        String.raw`line1\nline2`,
      );
      expect(jsStringLiteralEscape('line1\rline2')).toBe(
        String.raw`line1\rline2`,
      );
      // Line/paragraph separators (U+2028/U+2029) escape to text.
      expect(jsStringLiteralEscape('\u2028\u2029')).toBe(
        String.raw`\u2028\u2029`,
      );
    });
  });

  describe('does NOT escape characters that are meaningless inside a string literal', () => {
    // These would produce `no-useless-escape` errors in generated code (#3337).
    it('does not escape asterisks', () => {
      expect(jsStringLiteralEscape('hello*world')).toBe('hello*world');
    });

    it('does not escape forward slashes', () => {
      expect(jsStringLiteralEscape('path/to/file')).toBe('path/to/file');
    });

    it('does not escape double quotes', () => {
      expect(jsStringLiteralEscape('say "hello"')).toBe('say "hello"');
    });

    it('does not escape comment delimiters', () => {
      expect(jsStringLiteralEscape('/* comment */')).toBe('/* comment */');
    });
  });

  describe('RegExp pattern (#3337)', () => {
    it('keeps a quantifier pattern free of useless escapes', () => {
      // `\d` survives the string-literal layer as `\\d`; `*` stays bare so the
      // generated `new RegExp('...')` does not trip `no-useless-escape`.
      const escaped = jsStringLiteralEscape(String.raw`^(0|[1-9]\d*)$`);
      expect(escaped).toBe(String.raw`^(0|[1-9]\\d*)$`);
      expect(escaped).not.toContain(String.raw`\*`);
    });
  });
});

describe('escape', () => {
  it('should escape a single occurrence of the character', () => {
    expect(escape("don't")).toBe(String.raw`don\'t`);
  });

  it('should escape all occurrences of the character', () => {
    expect(escape("it's John's car")).toBe(String.raw`it\'s John\'s car`);
  });

  it('should escape all occurrences of a custom character', () => {
    expect(escape('say "hello" and "goodbye"', '"')).toBe(
      String.raw`say \"hello\" and \"goodbye\"`,
    );
  });
});

describe('escapeRegExp', () => {
  it('escapes regex metacharacters without changing plain characters', () => {
    expect(escapeRegExp(String.raw`foo$bar.(baz)[qux]?`)).toBe(
      String.raw`foo\$bar\.\(baz\)\[qux\]\?`,
    );
  });
});

describe('stringify', () => {
  it('returns undefined for undefined', () => {
    expect(stringify()).toBeUndefined();
  });

  it('returns the null literal for null', () => {
    // eslint-disable-next-line unicorn/no-null -- Regression test for explicit null serialization
    expect(stringify(null)).toBe('null');
  });

  describe('string default values are JS-escaped (#3583)', () => {
    it('escapes backslashes so the value round-trips', () => {
      // Without escaping, `App\Models\Document` evaluates to `AppModelsDocument`.
      expect(stringify('App\\Models\\Document')).toBe(
        "'App\\\\Models\\\\Document'",
      );
    });

    it('escapes a trailing backslash so the literal stays terminated', () => {
      // Without escaping, the trailing `\'` escapes the closing quote and the
      // generated file fails to parse.
      expect(stringify('C:\\logs\\')).toBe("'C:\\\\logs\\\\'");
    });

    it('does not over-escape forward slashes (#3530 guard)', () => {
      expect(stringify('Asia/Tokyo')).toBe("'Asia/Tokyo'");
    });

    it('keeps escaping single quotes', () => {
      expect(stringify("it's")).toBe(String.raw`'it\'s'`);
    });
  });

  describe('object keys are quoted when not valid identifiers (#3583)', () => {
    it('quotes a non-identifier key', () => {
      expect(stringify({ 'foo-bar': 1 })).toBe("{ 'foo-bar': 1, }");
    });

    it('leaves a valid identifier key unquoted', () => {
      expect(stringify({ version: 1 })).toBe('{ version: 1, }');
    });

    it('emits __proto__ as a computed key so it is a data property, not a prototype setter', () => {
      // Both `{ __proto__: x }` and `{ '__proto__': x }` set the object's
      // prototype (Annex B.3.1); only the computed form `{ ['__proto__']: x }`
      // creates a normal own data property. Defaults arrive via spec parsing
      // (JSON.parse), which carries a real own `__proto__` property.
      const parsed = JSON.parse('{ "__proto__": "x" }');
      expect(stringify(parsed)).toBe("{ ['__proto__']: 'x', }");
    });
  });
});
