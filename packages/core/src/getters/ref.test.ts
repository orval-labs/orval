import { describe, expect, it } from 'vitest';

import type { ContextSpec } from '../types';
import { getRefInfo, isComponentRef } from './ref';

function createRefContext(): ContextSpec {
  return {
    target: 'core-test',
    workspace: '/tmp',
    spec: {},
    output: {
      override: {
        components: {
          schemas: { suffix: '' },
        },
      },
    },
  } as ContextSpec;
}

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

describe('getRefInfo', () => {
  it('decodes ~0 tilde escape per RFC 6901', () => {
    const info = getRefInfo(
      '#/components/schemas/My~0Type',
      createRefContext(),
    );
    expect(info.originalName).toBe('My~Type');
  });

  it('decodes both ~1 and ~0 in the same segment', () => {
    const info = getRefInfo(
      '#/components/schemas/Path~1To~0Thing',
      createRefContext(),
    );
    expect(info.originalName).toBe('Path/To~Thing');
  });

  it('decodes order is ~1 then ~0', () => {
    // "~01" should decode to "~1", not to "/" then "0"
    const info = getRefInfo(
      '#/components/schemas/Foo~01Bar',
      createRefContext(),
    );
    expect(info.originalName).toBe('Foo~1Bar');
  });

  it('percent-decodes before tilde unescaping per RFC 6901 section 6', () => {
    // %7E is the percent-encoding of "~", so %7E0 → ~0 → ~ and %7E1 → ~1 → /
    expect(
      getRefInfo('#/components/schemas/My%7E0Type', createRefContext())
        .originalName,
    ).toBe('My~Type');
    expect(
      getRefInfo('#/components/schemas/A%7E1B', createRefContext())
        .originalName,
    ).toBe('A/B');
  });
});
