import { describe, expect, it } from 'vitest';

import { isComponentRef } from './ref';

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
    // issue #398: bundler-emitted JSON Pointer into an inline schema
    '#/paths/~1{id}/get/parameters/0/schema',
    '#/paths/~1%7Bid%7D/get/parameters/0/schema',
    // component sections that orval does not emit as named imports
    '#/components/headers/X-Rate-Limit',
    '#/components/examples/PetExample',
    '#/components/securitySchemes/ApiKey',
    // OAS 3.1 inline definitions
    '#/$defs/Pet',
    // External-file refs (after dereferenceExternalRef these never reach value resolution,
    // but the predicate must reject them defensively)
    'other.yaml#/components/schemas/Pet',
    'http://example.com/schemas#/components/schemas/Pet',
    // Malformed / nested-name variants
    '#/components/schemas/Foo/Bar',
    '#/components/schemas/',
    '',
  ])('returns false for non-named ref %s', (ref) => {
    expect(isComponentRef(ref)).toBe(false);
  });

  it('handles JSON-Pointer-encoded names containing slashes', () => {
    // RFC 6901: literal "/" inside a name is encoded as "~1".
    // The decoded name is "My/Type" but the ref string segment has no literal slash.
    expect(isComponentRef('#/components/schemas/My~1Type')).toBe(true);
  });
});
