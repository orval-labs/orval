import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  NormalizedOverrideOutput,
  OpenApiSchemaObject,
} from '../types';
import { getScalar, isBinaryScalarSchema, resolveFormatType } from './scalar';

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

describe('getScalar (nullable composition: type: null + combiner)', () => {
  // Some OAS 3.1 producers (e.g. @scalar/openapi-upgrader) encode a nullable
  // $ref as `{ type: 'null', allOf: [{ $ref }] }` rather than the canonical
  // `{ anyOf: [{ $ref }, { type: 'null' }] }`. Orval must treat this as a
  // nullable union (`T | null`) instead of collapsing it to `null` and
  // dropping the composition. See discussion on #3163.
  const compositionContext = {
    output: {
      override: {
        enumGenerationType: 'const',
        components: {
          schemas: { suffix: '', itemSuffix: 'Item' },
          responses: { suffix: '' },
          parameters: { suffix: '' },
          requestBodies: { suffix: 'RequestBody' },
        },
      },
      unionAddMissingProperties: false,
    },
    target: 'spec',
    workspace: '',
    spec: {
      components: {
        schemas: {
          TimeIncrement: {
            type: 'object',
            properties: { value: { type: 'number' } },
          },
        },
      },
    },
  } as unknown as ContextSpec;

  it('type: null with allOf [$ref] produces `Ref | null`', () => {
    const schema: OpenApiSchemaObject = {
      type: 'null',
      allOf: [{ $ref: '#/components/schemas/TimeIncrement' }],
    };

    const result = getScalar({
      item: schema,
      name: 'timeStep',
      context: compositionContext,
    });

    expect(result.value).toBe('TimeIncrement | null');
  });

  it('type: null with anyOf [$ref, scalar] keeps the union and appends null', () => {
    const schema: OpenApiSchemaObject = {
      type: 'null',
      anyOf: [
        { $ref: '#/components/schemas/TimeIncrement' },
        { type: 'string' },
      ],
    };

    const result = getScalar({
      item: schema,
      name: 'timeStep',
      context: compositionContext,
    });

    expect(result.value).toBe('TimeIncrement | string | null');
  });

  it('type: null with oneOf [$ref, scalar] keeps the union and appends null', () => {
    const schema: OpenApiSchemaObject = {
      type: 'null',
      oneOf: [
        { $ref: '#/components/schemas/TimeIncrement' },
        { type: 'string' },
      ],
    };

    const result = getScalar({
      item: schema,
      name: 'timeStep',
      context: compositionContext,
    });

    expect(result.value).toBe('TimeIncrement | string | null');
  });

  it('type: null with allOf [inline object, $ref] keeps both members and appends null', () => {
    const schema: OpenApiSchemaObject = {
      type: 'null',
      allOf: [
        { type: 'object', properties: { x: { type: 'integer' } } },
        { $ref: '#/components/schemas/TimeIncrement' },
      ],
    };

    const result = getScalar({
      item: schema,
      name: 'thing',
      context: compositionContext,
    });

    expect(result.value).toContain('TimeIncrement');
    expect(result.value).toContain('x?: number');
    expect(result.value).toContain('null');
  });

  it('plain type: null (no combiner) still resolves to null', () => {
    const schema: OpenApiSchemaObject = { type: 'null' };

    const result = getScalar({
      item: schema,
      name: 'nothing',
      context: compositionContext,
    });

    expect(result.value).toBe('null');
  });

  it('type: null with an empty combiner array still resolves to null', () => {
    const schema: OpenApiSchemaObject = { type: 'null', allOf: [] };

    const result = getScalar({
      item: schema,
      name: 'nothing',
      context: compositionContext,
    });

    expect(result.value).toBe('null');
  });
});

describe('getScalar (string const value escaping #3505)', () => {
  it('JS-escapes backslashes in string const values', () => {
    const schema = {
      type: 'string',
      const: String.raw`App\Models\Document`,
    } as OpenApiSchemaObject;

    const result = getScalar({ item: schema, name: 'kind', context });

    expect(result.value).toBe(String.raw`'App\\Models\\Document'`);
  });

  it('JS-escapes a const value ending in a backslash', () => {
    const schema = {
      type: 'string',
      const: 'C:\\logs\\',
    } as OpenApiSchemaObject;

    const result = getScalar({ item: schema, name: 'prefix', context });

    expect(result.value).toBe(String.raw`'C:\\logs\\'`);
  });

  it('does not escape forward slashes in const values (#3530)', () => {
    const schema = {
      type: 'string',
      const: 'Asia/Tokyo',
    } as OpenApiSchemaObject;

    const result = getScalar({ item: schema, name: 'timezone', context });

    expect(result.value).toBe("'Asia/Tokyo'");
  });
});

describe('resolveFormatType', () => {
  const override = { useDates: false } as NormalizedOverrideOutput;

  it('returns undefined when no format', () => {
    expect(resolveFormatType(undefined, override)).toBeUndefined();
  });

  it('returns formatType config when present', () => {
    const withFormat = {
      ...override,
      formatType: {
        date: { type: 'Temporal.PlainDate' },
      },
    } as NormalizedOverrideOutput;
    expect(resolveFormatType('date', withFormat)).toEqual({
      type: 'Temporal.PlainDate',
      import: undefined,
    });
  });

  it('returns formatType config with import', () => {
    const withFormat = {
      ...override,
      formatType: {
        'date-time': {
          type: 'Dayjs',
          import: { name: 'Dayjs', importPath: 'dayjs' },
        },
      },
    } as NormalizedOverrideOutput;
    expect(resolveFormatType('date-time', withFormat)).toEqual({
      type: 'Dayjs',
      import: { name: 'Dayjs', importPath: 'dayjs' },
    });
  });

  it('falls back to useDates for date format', () => {
    const withDates = {
      ...override,
      useDates: true,
    } as NormalizedOverrideOutput;
    expect(resolveFormatType('date', withDates)).toEqual({ type: 'Date' });
  });

  it('returns undefined when no formatType and useDates is false', () => {
    expect(resolveFormatType('date', override)).toBeUndefined();
  });

  it('formatType takes precedence over useDates', () => {
    const withBoth = {
      ...override,
      useDates: true,
      formatType: {
        date: { type: 'Temporal.PlainDate' },
      },
    } as NormalizedOverrideOutput;
    expect(resolveFormatType('date', withBoth)).toEqual({
      type: 'Temporal.PlainDate',
      import: undefined,
    });
  });

  it('returns undefined for non-date formats without formatType', () => {
    expect(resolveFormatType('email', override)).toBeUndefined();
  });
});

describe('getScalar with formatType', () => {
  it('uses formatType type for date format', () => {
    const ctx = {
      output: {
        override: {
          formatType: {
            date: { type: 'Temporal.PlainDate' },
          },
        },
      },
    } as ContextSpec;

    const result = getScalar({
      item: { type: 'string', format: 'date' } as OpenApiSchemaObject,
      context: ctx,
    });

    expect(result.value).toBe('Temporal.PlainDate');
  });

  it('uses formatType for non-date formats like uuid', () => {
    const ctx = {
      output: {
        override: {
          formatType: {
            uuid: {
              type: 'UUID',
              import: { name: 'UUID', importPath: '@company/types' },
            },
          },
        },
      },
    } as ContextSpec;

    const result = getScalar({
      item: { type: 'string', format: 'uuid' } as OpenApiSchemaObject,
      context: ctx,
    });

    expect(result.value).toBe('UUID');
    expect(result.imports).toEqual([
      { name: 'UUID', importPath: '@company/types' },
    ]);
  });

  it('preserves enum when formatType is configured', () => {
    const ctx = {
      output: {
        override: {
          formatType: {
            'date-time': { type: 'Dayjs' },
          },
        },
      },
    } as ContextSpec;

    const result = getScalar({
      item: {
        type: 'string',
        format: 'date-time',
        enum: ['2024-01-01T00:00:00Z', '2024-12-31T00:00:00Z'],
      } as OpenApiSchemaObject,
      context: ctx,
    });

    expect(result.isEnum).toBe(true);
    expect(result.value).toContain('2024-01-01');
  });
});
