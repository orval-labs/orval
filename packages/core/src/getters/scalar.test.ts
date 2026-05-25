import { describe, expect, it } from 'vitest';

import type { ContextSpec, OpenApiSchemaObject } from '../types';
import { getScalar, isBinaryScalarSchema } from './scalar';

const context = {
  output: {
    override: {
      useDates: false,
    },
  },
} as ContextSpec;

describe('getScalar (contentMediaType: application/octet-stream)', () => {
  it('contentMediaType: application/octet-stream without formDataContext → Blob', () => {
    // Simulates $ref-based schema after upgrader converts format: binary →
    // contentMediaType: application/octet-stream (Swagger 2.0 / OAS 3.0 → 3.1)
    const schema: OpenApiSchemaObject = {
      type: 'string',
      contentMediaType: 'application/octet-stream',
    };

    const result = getScalar({ item: schema, name: 'file', context });

    expect(result.value).toBe('Blob');
  });

  it('contentEncoding: base64 with contentMediaType: application/octet-stream → string', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      contentMediaType: 'application/octet-stream',
      contentEncoding: 'base64',
    };

    const result = getScalar({ item: schema, name: 'data', context });

    expect(result.value).toBe('string');
  });

  it('plain string without contentMediaType or format: binary → string', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
    };

    const result = getScalar({ item: schema, name: 'name', context });

    expect(result.value).toBe('string');
  });

  it('non-octet-stream contentMediaType without formDataContext → string', () => {
    // contentMediaType other than application/octet-stream is only handled
    // in the form-data context (formDataContext?.atPart)
    const schema: OpenApiSchemaObject = {
      type: 'string',
      contentMediaType: 'image/png',
    };

    const result = getScalar({ item: schema, name: 'avatar', context });

    expect(result.value).toBe('string');
  });
});

describe('isBinaryScalarSchema', () => {
  it('returns true for { type: "string", format: "binary" }', () => {
    expect(isBinaryScalarSchema({ type: 'string', format: 'binary' })).toBe(
      true,
    );
  });

  it('returns true for { type: "string", contentMediaType: "application/octet-stream" }', () => {
    expect(
      isBinaryScalarSchema({
        type: 'string',
        contentMediaType: 'application/octet-stream',
      }),
    ).toBe(true);
  });

  it('returns false when contentMediaType has a contentEncoding (base64)', () => {
    expect(
      isBinaryScalarSchema({
        type: 'string',
        contentMediaType: 'application/octet-stream',
        contentEncoding: 'base64',
      }),
    ).toBe(false);
  });

  it('returns false for plain string without binary signals', () => {
    expect(isBinaryScalarSchema({ type: 'string' })).toBe(false);
  });

  it('returns false for non-string scalars (number)', () => {
    expect(
      isBinaryScalarSchema({
        type: 'number',
        format: 'binary',
      } as OpenApiSchemaObject),
    ).toBe(false);
  });

  it('accepts OAS 3.1 nullable union [string, null] + format: binary', () => {
    // getScalar normalizes ['string','null'] → case 'string' before invoking
    // this predicate, so the predicate must agree to keep the url-encoded
    // $ref short-circuit firing for nullable binary scalars.
    expect(
      isBinaryScalarSchema({
        type: ['string', 'null'],
        format: 'binary',
      } as unknown as OpenApiSchemaObject),
    ).toBe(true);
  });

  it('accepts OAS 3.1 nullable union [string, null] + contentMediaType: octet-stream', () => {
    expect(
      isBinaryScalarSchema({
        type: ['string', 'null'],
        contentMediaType: 'application/octet-stream',
      } as unknown as OpenApiSchemaObject),
    ).toBe(true);
  });

  it('rejects mixed unions that include non-string non-null members', () => {
    // e.g. ['string','integer'] would not dispatch to case 'string' in
    // getScalar, so isBinaryScalarSchema must not promise binary semantics.
    expect(
      isBinaryScalarSchema({
        type: ['string', 'integer'],
        format: 'binary',
      } as unknown as OpenApiSchemaObject),
    ).toBe(false);
  });
});
