import { describe, expect, it } from 'vitest';

import { getOperationTagKey, getTagKey, isOperationInTagBucket } from './tags';
import { kebab } from './case';

describe('getTagKey', () => {
  it('kebab-cases a simple tag', () => {
    expect(getTagKey('pets')).toBe('pets');
  });

  it('kebab-cases multi-word tags', () => {
    expect(getTagKey('Pet Store')).toBe('pet-store');
  });

  it('normalises acronym-prefixed multi-word tags (the bug class)', () => {
    // `camel("AB Widget")` would give "aBWidget", which does NOT round-trip
    // through the bucket key. `kebab` does.
    expect(getTagKey('AB Widget')).toBe('ab-widget');
  });

  it('is idempotent: applying it to its own output is a no-op', () => {
    for (const tag of [
      'pets',
      'Pet Store',
      'AB Widget',
      'user-admin',
      'HTTPServer',
      'v1.users',
    ]) {
      const once = getTagKey(tag);
      expect(getTagKey(once)).toBe(once);
    }
  });

  it('falls back to the default bucket for missing tags', () => {
    expect(getTagKey()).toBe('default');
    expect(getTagKey(undefined)).toBe('default');
  });

  it('agrees with a raw kebab() call on the same input', () => {
    for (const tag of ['pets', 'Pet Store', 'AB Widget', 'user/admin']) {
      expect(getTagKey(tag)).toBe(kebab(tag));
    }
  });
});

describe('getOperationTagKey', () => {
  it('derives the key from the first tag', () => {
    expect(getOperationTagKey({ tags: ['AB Widget', 'Other'] })).toBe(
      'ab-widget',
    );
  });

  it('maps untagged operations to the default bucket', () => {
    expect(getOperationTagKey({ tags: [] })).toBe('default');
  });
});

describe('isOperationInTagBucket', () => {
  it('matches an operation to its own bucket regardless of spelling', () => {
    const op = { tags: ['AB Widget'] };
    expect(isOperationInTagBucket(op, 'ab-widget')).toBe(true);
    // A caller that passes the raw tag still matches, because both sides are
    // normalised.
    expect(isOperationInTagBucket(op, 'AB Widget')).toBe(true);
  });

  it('does not match an operation in a different bucket', () => {
    expect(isOperationInTagBucket({ tags: ['Widget'] }, 'ab-widget')).toBe(
      false,
    );
  });

  it('matches every operation when no tag bucket is given', () => {
    expect(isOperationInTagBucket({ tags: ['anything'] })).toBe(true);
    expect(isOperationInTagBucket({ tags: [] }, undefined)).toBe(true);
  });

  it('places untagged operations in the default bucket', () => {
    expect(isOperationInTagBucket({ tags: [] }, 'default')).toBe(true);
    expect(isOperationInTagBucket({ tags: [] }, 'pets')).toBe(false);
  });
});
