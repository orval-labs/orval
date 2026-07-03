import { describe, expect, it } from 'vitest';

import { hasTypeScriptAwaitedType } from './typescript-version';

describe('hasTypeScriptAwaitedType', () => {
  it('prefers the resolved TypeScript version over package specifiers', () => {
    expect(
      hasTypeScriptAwaitedType({
        devDependencies: {
          typescript: '^4.0.0',
        },
        resolvedVersions: {
          typescript: '6.0.3',
        },
      }),
    ).toBe(true);
  });

  it('supports npm-aliased TypeScript package specifiers', () => {
    expect(
      hasTypeScriptAwaitedType({
        devDependencies: {
          typescript: 'npm:@typescript/typescript6@^6.0.0',
        },
      }),
    ).toBe(true);
  });

  it('keeps the legacy fallback when no TypeScript version is detected', () => {
    expect(hasTypeScriptAwaitedType()).toBe(false);
  });
});
