import { describe, expect, it } from 'vitest';

import { getKey, getPropertyAccessor } from './keys';

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
