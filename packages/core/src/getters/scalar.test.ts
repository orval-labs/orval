import { describe, expect, it } from 'vitest';

import type { ContextSpec, OpenApiSchemaObject } from '../types';
import { getScalar } from './scalar';

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

describe('getScalar (nullable-only schema without type — GH-3149)', () => {
  it('nullable: true without type → "unknown | null" with useTypeAlias', () => {
    const schema: OpenApiSchemaObject = {
      nullable: true,
    };

    const result = getScalar({ item: schema, name: 'NullableOnly', context });

    expect(result.value).toBe('unknown | null');
    expect(result.useTypeAlias).toBe(true);
  });

  it('blank schema {} → "unknown" without useTypeAlias', () => {
    const schema: OpenApiSchemaObject = {};

    const result = getScalar({ item: schema, name: 'BlankSchema', context });

    expect(result.value).toBe('unknown');
    expect(result.useTypeAlias).toBe(false);
  });
});
