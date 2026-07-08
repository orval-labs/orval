import { describe, expect, it } from 'vitest';

import { getKey } from './keys';

describe('getKey', () => {
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
