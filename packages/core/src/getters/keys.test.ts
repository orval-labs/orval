import { describe, expect, it } from 'vite-plus/test';

import {
  getKey,
  getPropertyAccessor,
  getStringLiteralType,
  getStringLiteralTypeUnion,
} from './keys';

describe('getKey', () => {
  it('leaves a valid identifier name unchanged', () => {
    expect(getKey('scopeId')).toBe('scopeId');
  });

  it('quotes a dotted key', () => {
    expect(getKey('scope.id')).toBe("'scope.id'");
  });

  it('quotes a dashed key', () => {
    expect(getKey('user-id')).toBe("'user-id'");
  });

  it('escapes single quote in key', () => {
    const result = getKey("x':[require('fs').execSync('id'),");
    expect(result).toMatch(/^'(.*)'$/);
    const inner = result.slice(1, -1);
    expect(inner).not.toMatch(/(?<!\\)'/);
  });

  it('escapes backslash in key', () => {
    const result = getKey('a\\b');
    expect(result).toBe(String.raw`'a\\b'`);
  });
});

describe('getPropertyAccessor', () => {
  it('uses dot access for a valid identifier name', () => {
    expect(getPropertyAccessor('scopeId')).toBe('.scopeId');
  });

  it('uses quoted bracket access for a dotted name', () => {
    expect(getPropertyAccessor('scope.id')).toBe("['scope.id']");
  });

  it('escapes quotes inside a bracket-access name', () => {
    expect(getPropertyAccessor("it's")).toBe(String.raw`['it\'s']`);
  });
});

describe('getStringLiteralType', () => {
  it('quotes a plain name', () => {
    expect(getStringLiteralType('petId')).toBe("'petId'");
  });

  it('quotes a valid identifier too, unlike getKey', () => {
    // A string literal type has no bare form: `Extract<keyof T, petId>` would
    // be a type reference, not the literal `'petId'`.
    expect(getKey('petId')).toBe('petId');
    expect(getStringLiteralType('petId')).toBe("'petId'");
  });

  it('escapes a quote so the name cannot close the literal', () => {
    expect(getStringLiteralType("id'>>>;type X = '")).toBe(
      String.raw`'id\'>>>;type X = \''`,
    );
  });

  it('escapes newlines so a name cannot open a new statement line', () => {
    expect(getStringLiteralType('a\nb')).toBe(String.raw`'a\nb'`);
  });
});

describe('getStringLiteralTypeUnion', () => {
  it('joins names as a union of literal types', () => {
    expect(getStringLiteralTypeUnion(['a', 'b'])).toBe("'a' | 'b'");
  });

  it('escapes every member', () => {
    expect(getStringLiteralTypeUnion(["a'", "b'"])).toBe(
      String.raw`'a\'' | 'b\''`,
    );
  });

  it('returns an empty string for no names', () => {
    expect(getStringLiteralTypeUnion([])).toBe('');
  });
});
