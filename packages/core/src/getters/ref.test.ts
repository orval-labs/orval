import { describe, expect, it } from 'vitest';

import { getDynamicAnchorName, isComponentRef } from './ref';

describe('isComponentRef', () => {
  it.each([
    '#/components/schemas/Pet',
    '#/components/responses/ErrorResponse',
    '#/components/parameters/PetId',
    '#/components/requestBodies/CreatePetBody',
  ])('returns true for named component ref %s', (ref) => {
    expect(isComponentRef(ref)).toBe(true);
  });

  it.each([
    '#/paths/~1{id}/get/parameters/0/schema',
    '#/paths/~1%7Bid%7D/get/parameters/0/schema',
    '#/components/headers/X-Rate-Limit',
    '#/components/examples/PetExample',
    '#/components/securitySchemes/ApiKey',
    '#/$defs/Pet',
    'other.yaml#/components/schemas/Pet',
    'http://example.com/schemas#/components/schemas/Pet',
    '#/components/schemas/Foo/Bar',
    '#/components/schemas/',
    '',
  ])('returns false for non-named ref %s', (ref) => {
    expect(isComponentRef(ref)).toBe(false);
  });

  it('handles JSON-Pointer-encoded names containing slashes', () => {
    expect(isComponentRef('#/components/schemas/My~1Type')).toBe(true);
  });
});

describe('getDynamicAnchorName', () => {
  it('extracts anchor name from fragment-only dynamic ref', () => {
    expect(getDynamicAnchorName('#category')).toBe('category');
  });

  it('returns undefined for external document refs', () => {
    expect(getDynamicAnchorName('other-file.json#anchor')).toBeUndefined();
  });

  it('returns undefined for URL-based refs', () => {
    expect(
      getDynamicAnchorName('https://example.com/schemas/base#anchor'),
    ).toBeUndefined();
  });
});
