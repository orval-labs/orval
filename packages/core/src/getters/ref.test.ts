import { describe, expect, it } from 'vitest';

import type { ContextSpec, OpenApiDocument } from '../types';
import { getDynamicAnchorName, getRefInfo, isComponentRef } from './ref';

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

  it('returns undefined for a bare # with no anchor', () => {
    expect(getDynamicAnchorName('#')).toBeUndefined();
  });
});

function createRefInfoContext(spec: OpenApiDocument): ContextSpec {
  return {
    target: 'core-test',
    workspace: '/tmp',
    spec,
    output: {
      override: { components: { schemas: { suffix: '' } } },
    },
  } as ContextSpec;
}

describe('getRefInfo', () => {
  it('resolves a fragment-only ref to its local schema name', () => {
    const context = createRefInfoContext({
      openapi: '3.1.0',
      components: { schemas: { Pet: { type: 'object' } } },
    });

    const info = getRefInfo('#/components/schemas/Pet', context);

    expect(info.name).toBe('Pet');
    expect(info.originalName).toBe('Pet');
    expect(info.refPaths).toEqual(['components', 'schemas', 'Pet']);
  });

  it('resolves an external-file ref (pathname branch) and derives name from filename', () => {
    // Exercises line 97: the return branch reached when pathname is non-empty
    const context = createRefInfoContext({
      openapi: '3.1.0',
      components: { schemas: {} },
    });

    const info = getRefInfo(
      './models/pet-model.yaml#/components/schemas/Pet',
      context,
    );

    expect(info.name).toBe('Pet');
    expect(info.originalName).toBe('Pet');
  });

  it('decodes JSON Pointer tilde-escapes in ref paths', () => {
    const context = createRefInfoContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          'My/Type': { type: 'object' },
          'My~Type': { type: 'object' },
        },
      },
    });

    expect(
      getRefInfo('#/components/schemas/My~1Type', context).originalName,
    ).toBe('My/Type');
    expect(
      getRefInfo('#/components/schemas/My~0Type', context).originalName,
    ).toBe('My~Type');
  });
});
