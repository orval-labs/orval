import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils';
import type { NormalizedOverrideOutput, OpenApiSchemaObject } from '../types';
import type { FormDataContext } from './object';
import {
  findCustomFormatType,
  getFormatTypeFunctionImports,
  getModelFormatType,
  getScalar,
  isBinaryScalarSchema,
  resolveFormatType,
} from './scalar';

const context = createTestContextSpec({
  override: {
    useDates: false,
  },
});

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

  // `resolveSpec` turns a 3.0 `{ type: 'string', format: 'binary',
  // nullable: true }` part into this union. The `atPart` arm of getScalar's
  // else-if chain runs before the `isBinaryScalarSchema` arm, so when
  // `getFormDataFieldFileType` rejected the union the part silently degraded
  // to `string | null` — contradicting the zod/effect validators, which read
  // `contentMediaType` directly and still emitted a Blob check. (#4141)
  it('nullable multipart part with octet-stream contentMediaType → Blob | File | null', () => {
    const schema = {
      type: ['string', 'null'],
      contentMediaType: 'application/octet-stream',
    } satisfies OpenApiSchemaObject;

    const result = getScalar({
      item: schema,
      name: 'attachment',
      context,
      formDataContext: { atPart: true },
    });

    expect(result.value).toBe('Blob | File | null');
  });

  it('nullable multipart part with a text encoding contentType → Blob | File | string | null', () => {
    const schema = {
      type: ['string', 'null'],
    } satisfies OpenApiSchemaObject;

    const result = getScalar({
      item: schema,
      name: 'notes',
      context,
      formDataContext: { atPart: true, partContentType: 'text/csv' },
    });

    expect(result.value).toBe('Blob | File | string | null');
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

  // Media type names are case-insensitive (RFC 9110 §8.3.1) (#4369).
  it('returns true for a contentMediaType of application/octet-stream in mixed case', () => {
    expect(
      isBinaryScalarSchema({
        type: 'string',
        contentMediaType: 'Application/Octet-Stream',
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
      }),
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
      } satisfies OpenApiSchemaObject),
    ).toBe(true);
  });

  it('accepts OAS 3.1 nullable union [string, null] + contentMediaType: octet-stream', () => {
    expect(
      isBinaryScalarSchema({
        type: ['string', 'null'],
        contentMediaType: 'application/octet-stream',
      } satisfies OpenApiSchemaObject),
    ).toBe(true);
  });

  it('rejects mixed unions that include non-string non-null members', () => {
    // e.g. ['string','integer'] would not dispatch to case 'string' in
    // getScalar, so isBinaryScalarSchema must not promise binary semantics.
    expect(
      isBinaryScalarSchema({
        type: ['string', 'integer'],
        format: 'binary',
      } satisfies OpenApiSchemaObject),
    ).toBe(false);
  });
});

describe('getScalar (nullable composition: type: null + combiner)', () => {
  // Some OAS 3.1 producers (e.g. @scalar/openapi-upgrader) encode a nullable
  // $ref as `{ type: 'null', allOf: [{ $ref }] }` rather than the canonical
  // `{ anyOf: [{ $ref }, { type: 'null' }] }`. Orval must treat this as a
  // nullable union (`T | null`) instead of collapsing it to `null` and
  // dropping the composition. See discussion on #3163.
  const compositionContext = createTestContextSpec({
    target: 'spec',
    output: {
      unionAddMissingProperties: false,
    },
    override: {
      enumGenerationType: 'const',
      components: {
        schemas: { suffix: '', itemSuffix: 'Item' },
        responses: { suffix: '' },
        parameters: { suffix: '' },
        requestBodies: { suffix: 'RequestBody' },
      },
    },
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
  });

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
    } satisfies OpenApiSchemaObject;

    const result = getScalar({ item: schema, name: 'kind', context });

    expect(result.value).toBe(String.raw`'App\\Models\\Document'`);
  });

  it('JS-escapes a const value ending in a backslash', () => {
    const schema = {
      type: 'string',
      const: 'C:\\logs\\',
    } satisfies OpenApiSchemaObject;

    const result = getScalar({ item: schema, name: 'prefix', context });

    expect(result.value).toBe(String.raw`'C:\\logs\\'`);
  });

  it('does not escape forward slashes in const values (#3530)', () => {
    const schema = {
      type: 'string',
      const: 'Asia/Tokyo',
    } satisfies OpenApiSchemaObject;

    const result = getScalar({ item: schema, name: 'timezone', context });

    expect(result.value).toBe("'Asia/Tokyo'");
  });
});

describe('getScalar integer enum + const (#3758)', () => {
  it('keeps a string type value when both enum and const are present', () => {
    // FastAPI/Pydantic Literal[1] emits { type: integer, enum: [1], const: 1 }.
    // The const branch used to overwrite the enum union with a raw number, which
    // later crashed getTypeConstEnum via value.endsWith(...).
    const schema: OpenApiSchemaObject = {
      type: 'integer',
      enum: [1],
      const: 1,
    };

    const result = getScalar({ item: schema, name: 'flag', context });

    expect(typeof result.value).toBe('string');
    expect(result.value).toBe('1');
    expect(result.isEnum).toBe(true);
  });

  it('preserves nullable suffix when const is present', () => {
    const schema: OpenApiSchemaObject = {
      type: ['integer', 'null'],
      enum: [1, null],
      const: 1,
    };

    const result = getScalar({ item: schema, name: 'flag', context });

    expect(typeof result.value).toBe('string');
    expect(result.value).toBe('1 | null');
  });
});

describe('getScalar null-only enum branch', () => {
  it('returns the null literal instead of an empty enum value', () => {
    const result = getScalar({
      item: { enum: [null] } as OpenApiSchemaObject,
      name: 'nullBranch',
      context,
    });

    expect(result.value).toBe('null');
    expect(result.type).toBe('null');
    expect(result.isEnum).toBe(false);
  });

  it('returns the null literal when a declared type allows only null', () => {
    const result = getScalar({
      item: { type: ['string', 'null'], enum: [null] } as OpenApiSchemaObject,
      name: 'typedNullBranch',
      context,
    });

    expect(result.value).toBe('null');
    expect(result.type).toBe('null');
    expect(result.isEnum).toBe(false);
  });
});

describe('getScalar (const/enum type confusion)', () => {
  const payload = '0; console.log("pwned"); type Tail = 0';

  // The value lands in a bare type position (`export type X = <here>`), so a
  // mismatched string spliced in raw would close the declaration and turn what
  // follows into live module statements.
  it.each<[string, OpenApiSchemaObject]>([
    ['numeric const', { type: 'number', const: payload }],
    ['integer const', { type: 'integer', const: payload }],
    ['boolean const', { type: 'boolean', const: payload }],
    [
      'boolean enum member',
      { type: 'boolean', enum: [payload] } satisfies OpenApiSchemaObject,
    ],
  ])(
    'renders a mismatched string as a string literal for a %s',
    (_label, schema) => {
      const result = getScalar({ item: schema, name: 'field', context });

      expect(result.value).toBe(`'${payload}'`);
      // No bare `;` outside the literal — that is what breaks the declaration.
      expect(result.value.endsWith("'")).toBe(true);
    },
  );

  it('escapes a quote in a mismatched string so it cannot close the literal', () => {
    const schema = {
      type: 'number',
      const: "0'; console.log('pwned'); type Tail = 0",
    } satisfies OpenApiSchemaObject;

    const result = getScalar({ item: schema, name: 'field', context });

    expect(result.value).toBe(
      String.raw`'0\'; console.log(\'pwned\'); type Tail = 0'`,
    );
  });

  it('keeps the nullable suffix outside the literal', () => {
    const schema = {
      type: ['number', 'null'],
      const: payload,
    } satisfies OpenApiSchemaObject;

    const result = getScalar({ item: schema, name: 'field', context });

    expect(result.value).toBe(`'${payload}' | null`);
  });

  it('still emits genuine numeric and boolean consts unquoted', () => {
    expect(
      getScalar({
        item: { type: 'number', const: 42 } satisfies OpenApiSchemaObject,
        name: 'n',
        context,
      }).value,
    ).toBe('42');

    expect(
      getScalar({
        item: { type: 'boolean', const: true } satisfies OpenApiSchemaObject,
        name: 'b',
        context,
      }).value,
    ).toBe('true');
  });
});

describe('getScalar (string-schema const presence and nullability)', () => {
  // `if (schemaConst)` treated these as absent and fell back to the wide type.
  it.each<[string, unknown, string]>([
    ['empty string', '', "''"],
    ['zero', 0, '0'],
    ['false', false, 'false'],
  ])('keeps a falsy %s const', (_label, constValue, expected) => {
    const schema = {
      type: 'string',
      const: constValue,
    } satisfies OpenApiSchemaObject;

    expect(getScalar({ item: schema, name: 'f', context }).value).toBe(
      expected,
    );
  });

  // The const branch overwrites the value assigned above it, so the suffix has
  // to be re-applied — the number and boolean branches already did.
  it('keeps the nullable suffix for a type-array nullable const', () => {
    const schema = {
      type: ['string', 'null'],
      const: 'x',
    } satisfies OpenApiSchemaObject;

    expect(getScalar({ item: schema, name: 'f', context }).value).toBe(
      "'x' | null",
    );
  });

  it('leaves a schema without a const alone', () => {
    expect(
      getScalar({
        item: { type: 'string' } satisfies OpenApiSchemaObject,
        name: 'f',
        context,
      }).value,
    ).toBe('string');
  });
});

describe('getScalar (boolean schemas)', () => {
  it('emits unknown for true', () => {
    expect(getScalar({ item: true, name: 'any', context }).value).toBe(
      'unknown',
    );
  });

  it('emits never for false', () => {
    expect(getScalar({ item: false, name: 'none', context }).value).toBe(
      'never',
    );
  });
});

// A component named `File` / `Blob` is emitted as a same-named interface that
// shadows the DOM global wherever both share a module, so the binary types
// are qualified with `globalThis.` only when such a collision exists (#4259).
describe('getScalar (binary types shadowed by components)', () => {
  const binary: OpenApiSchemaObject = { type: 'string', format: 'binary' };
  const multipart: FormDataContext = { atPart: false, encoding: {} };

  const contextWith = (
    components: Record<string, Record<string, unknown>>,
    componentOverride?: { schemas?: { prefix?: string; suffix?: string } },
  ) => {
    const base = createTestContextSpec({ override: { useDates: false } });
    return {
      ...base,
      spec: { ...base.spec, components },
      output: {
        ...base.output,
        override: {
          ...base.output.override,
          components: {
            ...base.output.override.components,
            schemas: {
              ...base.output.override.components.schemas,
              ...componentOverride?.schemas,
            },
          },
        },
      },
    } as ReturnType<typeof createTestContextSpec>;
  };

  it('keeps bare globals when no component collides', () => {
    expect(
      getScalar({
        item: binary,
        name: 'file',
        context,
        formDataContext: multipart,
      }).value,
    ).toBe('Blob | File');
  });

  it('qualifies File when a `File` schema exists', () => {
    const ctx = contextWith({ schemas: { File: { type: 'object' } } });

    expect(
      getScalar({
        item: binary,
        name: 'file',
        context: ctx,
        formDataContext: multipart,
      }).value,
    ).toBe('Blob | globalThis.File');
    expect(
      getScalar({
        item: { type: 'string' },
        name: 'file',
        context: ctx,
        formDataContext: { atPart: true, partContentType: 'text/plain' },
      }).value,
    ).toBe('Blob | globalThis.File | string');
  });

  it('qualifies Blob outside multipart when a `blob` schema exists', () => {
    const ctx = contextWith({ schemas: { blob: { type: 'object' } } });

    expect(getScalar({ item: binary, name: 'file', context: ctx }).value).toBe(
      'globalThis.Blob',
    );
  });

  it('qualifies File when a `File` request body component exists', () => {
    const ctx = contextWith({
      requestBodies: { File: { content: {} } },
    });

    // The test context uses an empty requestBodies suffix, so the generated
    // type is `File` and collides.
    expect(
      getScalar({
        item: binary,
        name: 'file',
        context: ctx,
        formDataContext: multipart,
      }).value,
    ).toBe('Blob | globalThis.File');
  });

  it('respects the schemas suffix when matching names', () => {
    const ctx = contextWith(
      { schemas: { File: { type: 'object' } } },
      { schemas: { suffix: 'Dto' } },
    );

    expect(
      getScalar({
        item: binary,
        name: 'file',
        context: ctx,
        formDataContext: multipart,
      }).value,
    ).toBe('Blob | File');
  });

  it('does not reuse names across outputs sharing a spec', () => {
    const suffixed = contextWith(
      { schemas: { File: { type: 'object' } } },
      { schemas: { suffix: 'Dto' } },
    );
    const plain = contextWith({}, { schemas: { suffix: '' } });
    const shared = { ...plain, spec: suffixed.spec };
    const fileType = (ctx: typeof plain) =>
      getScalar({
        item: binary,
        name: 'file',
        context: ctx,
        formDataContext: multipart,
      }).value;

    expect(fileType(suffixed)).toBe('Blob | File');
    expect(fileType(shared)).toBe('Blob | globalThis.File');
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
    const ctx = createTestContextSpec({
      override: { formatType: { date: { type: 'Temporal.PlainDate' } } },
    });

    const result = getScalar({
      item: { type: 'string', format: 'date' },
      context: ctx,
    });

    expect(result.value).toBe('Temporal.PlainDate');
  });

  it('uses formatType for non-date formats like uuid', () => {
    const ctx = createTestContextSpec({
      override: {
        formatType: {
          uuid: {
            type: 'UUID',
            import: { name: 'UUID', importPath: '@company/types' },
          },
        },
      },
    });

    const result = getScalar({
      item: { type: 'string', format: 'uuid' },
      context: ctx,
    });

    expect(result.value).toBe('UUID');
    expect(result.imports).toEqual([
      { name: 'UUID', importPath: '@company/types' },
    ]);
  });

  it('preserves enum when formatType is configured', () => {
    const ctx = createTestContextSpec({
      override: { formatType: { 'date-time': { type: 'Dayjs' } } },
    });

    const result = getScalar({
      item: {
        type: 'string',
        format: 'date-time',
        enum: ['2024-01-01T00:00:00Z', '2024-12-31T00:00:00Z'],
      },
      context: ctx,
    });

    expect(result.isEnum).toBe(true);
    expect(result.value).toContain('2024-01-01');
  });

  it('keeps typing a date enum as Date under useDates', () => {
    const ctx = createTestContextSpec({ override: { useDates: true } });

    const result = getScalar({
      item: {
        type: 'string',
        format: 'date-time',
        enum: ['2024-01-01T00:00:00Z'],
      },
      context: ctx,
    });

    expect(result.value).toBe('Date');
  });

  it('ignores inherited members for document-supplied formats', () => {
    const ctx = createTestContextSpec({
      override: { formatType: { uuid: { type: 'UUID' } } },
    });

    const result = getScalar({
      item: { type: 'string', format: 'constructor' },
      context: ctx,
    });

    expect(result.value).toBe('string');
  });

  it('maps a nullable string but leaves a union with other types unmapped', () => {
    const ctx = createTestContextSpec({
      override: {
        useDates: true,
        formatType: { 'date-time': { type: 'Dayjs' }, date: { type: 'Date' } },
      },
    });
    const value = (
      type: ('string' | 'number' | 'null')[],
      format = 'date-time',
    ) => getScalar({ item: { type, format }, context: ctx }).value;

    expect(value(['string', 'null'])).toBe('Dayjs | null');
    expect(value(['string', 'number'])).toBe('string | number');
    expect(value(['string', 'number'], 'date')).toBe('Date | number');
  });

  it('keeps the mapped formats of an object member of the union', () => {
    const ctx = createTestContextSpec({
      override: { formatType: { 'date-time': { type: 'Dayjs' } } },
    });
    const { value } = getScalar({
      item: {
        type: ['string', 'object'],
        format: 'date-time',
        properties: { at: { type: 'string', format: 'date-time' } },
      },
      context: ctx,
    });

    expect(value).toMatch(/^string | /);
    expect(value).toContain('at?: Dayjs');
  });
});

describe('findCustomFormatType', () => {
  const dayjs = { type: 'Dayjs', decode: 'dayjs' };
  const ctx = createTestContextSpec({
    spec: {
      components: {
        schemas: {
          Event: {
            type: 'object',
            properties: {
              startsAt: { type: 'string', format: 'date-time' },
              next: { $ref: '#/components/schemas/Event' },
            },
          },
          Day: { type: 'string', format: 'date' },
        },
      },
    },
    override: {
      formatType: { 'date-time': dayjs, date: { type: 'Date' } },
    },
  });

  it('finds a mapped format through properties, items and refs', () => {
    expect(
      findCustomFormatType(
        { type: 'array', items: { $ref: '#/components/schemas/Event' } },
        ctx,
      ),
    ).toEqual({ format: 'date-time', config: dayjs });
  });

  it('skips Date mappings, enums, non-strings and unmapped formats', () => {
    expect(
      findCustomFormatType(
        {
          type: 'object',
          properties: {
            day: { $ref: '#/components/schemas/Day' },
            fixed: { type: 'string', format: 'date-time', enum: ['x'] },
            count: { type: 'integer', format: 'date-time' },
            email: { type: 'string', format: 'email' },
          },
        },
        ctx,
      ),
    ).toBeUndefined();
  });
});

describe('getModelFormatType', () => {
  const dateTime: OpenApiSchemaObject = { type: 'string', format: 'date-time' };
  const dayjs = { type: 'Dayjs', decode: 'dayjs' };

  it('keeps mapped values as strings under Zod schema output', () => {
    const ctx = createTestContextSpec({
      override: { formatType: { 'date-time': dayjs } },
    });
    expect(getModelFormatType(dateTime, ctx)).toEqual(dayjs);
    ctx.output.schemas = { path: './model', type: 'zod', splitByTags: false };
    expect(getModelFormatType(dateTime, ctx)).toBeUndefined();
  });

  it('keeps them as strings in the schemas the zod client promotes', () => {
    const ctx = createTestContextSpec({
      output: { client: 'zod', schemas: './model' },
      override: {
        formatType: { 'date-time': dayjs },
        zod: { generateReusableSchemas: true },
      },
    });
    expect(getModelFormatType(dateTime, ctx)).toBeUndefined();
    ctx.output.override.zod.generateReusableSchemas = false;
    expect(getModelFormatType(dateTime, ctx)).toEqual(dayjs);
  });
});

describe('getFormatTypeFunctionImports', () => {
  const dayjs = { name: 'dayjs', importPath: 'dayjs', default: true };
  const toIso = { name: 'toIso', importPath: './dates' };
  const override = {
    formatType: {
      'date-time': {
        type: 'Dayjs',
        decodeImport: dayjs,
        encode: 'toIso',
        encodeImport: toIso,
      },
    },
  };

  it('returns the decode and encode imports the code references', () => {
    expect(
      getFormatTypeFunctionImports('data.at = dayjs(data.at);', override),
    ).toEqual([{ ...dayjs, values: true }]);
    expect(
      getFormatTypeFunctionImports('const toIsoString = 1; Dayjs', override),
    ).toEqual([]);
  });

  it('matches names starting with $ but not member accesses', () => {
    const $date = { name: '$date', importPath: './dates' };
    const parse = { name: 'parse', importPath: './dates' };
    const imports = {
      formatType: {
        date: { type: 'Day', decodeImport: $date, encodeImport: parse },
      },
    };
    expect(
      getFormatTypeFunctionImports('$date(x); Schema.parse(y)', imports),
    ).toEqual([{ ...$date, values: true }]);
  });
});
