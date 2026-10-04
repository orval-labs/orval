import { describe, expect, it } from 'vite-plus/test';

import { isEffectVersionV4, resolveIsEffectV4 } from './compatible-v4';

describe('isEffectVersionV4', () => {
  it('returns false when effect is not in package.json', () => {
    expect(isEffectVersionV4({ dependencies: { other: '1.0.0' } })).toBe(false);
  });

  it('prefers the resolved version over the declared range', () => {
    expect(
      isEffectVersionV4({
        dependencies: { effect: '^3.21.0' },
        resolvedVersions: { effect: '4.0.0' },
      }),
    ).toBe(true);
  });

  it('reads devDependencies and peerDependencies', () => {
    expect(isEffectVersionV4({ devDependencies: { effect: '4.0.0' } })).toBe(
      true,
    );
    expect(isEffectVersionV4({ peerDependencies: { effect: '3.21.2' } })).toBe(
      false,
    );
  });

  it('reads the major from a declared range', () => {
    expect(isEffectVersionV4({ dependencies: { effect: '^4.0.0' } })).toBe(
      true,
    );
    expect(isEffectVersionV4({ dependencies: { effect: '~3.21.0' } })).toBe(
      false,
    );
    expect(isEffectVersionV4({ dependencies: { effect: '^3 || ^4' } })).toBe(
      false,
    );
  });

  it('treats a v4 prerelease as v4', () => {
    expect(
      isEffectVersionV4({ dependencies: { effect: '4.0.0-rc.118' } }),
    ).toBe(true);
  });
});

describe('resolveIsEffectV4', () => {
  const v3PackageJson = { dependencies: { effect: '3.21.2' } };
  const v4PackageJson = { dependencies: { effect: '4.0.0' } };

  it("infers the target from the installed effect when 'auto'", () => {
    expect(resolveIsEffectV4('auto', v4PackageJson)).toBe(true);
    expect(resolveIsEffectV4('auto', v3PackageJson)).toBe(false);
  });

  it('falls back to Effect 4 when no effect version is detectable', () => {
    expect(resolveIsEffectV4('auto', undefined)).toBe(true);
    expect(resolveIsEffectV4('auto', { dependencies: {} })).toBe(true);
  });

  it('treats a specifier that is not a version as undetectable', () => {
    expect(
      resolveIsEffectV4('auto', { dependencies: { effect: 'workspace:*' } }),
    ).toBe(true);
  });

  it('lets a pinned version win over the installed one', () => {
    expect(resolveIsEffectV4(4, v3PackageJson)).toBe(true);
    expect(resolveIsEffectV4(3, v4PackageJson)).toBe(false);
    expect(resolveIsEffectV4(4, undefined)).toBe(true);
  });

  it("treats an undefined version like 'auto'", () => {
    expect(resolveIsEffectV4(undefined, v4PackageJson)).toBe(true);
    expect(resolveIsEffectV4(undefined, undefined)).toBe(true);
  });
});
