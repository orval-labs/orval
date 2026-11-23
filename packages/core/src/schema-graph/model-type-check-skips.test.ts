import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec, type TestOverride } from '../test-utils';
import type {
  OpenApiComponentsObject,
  OpenApiPathsObject,
  OpenApiSchemaObject,
} from '../types';
import {
  getModelTypeCheckSkips,
  type ModelTypeCheckLibrary,
  type ModelTypeCheckSkipOptions,
} from './model-type-check-skips';
import { createSharedRefPolicy } from './shared-ref-policy';

const skipsOf = (
  schemas: Record<string, OpenApiSchemaObject>,
  library: ModelTypeCheckLibrary,
  override?: TestOverride,
  // Parts of the document next to the component schemas.
  document: {
    paths?: OpenApiPathsObject;
    components?: OpenApiComponentsObject;
  } = {},
  options: Partial<ModelTypeCheckSkipOptions> = {},
) => {
  const context = createTestContextSpec({
    spec: {
      ...document,
      components: { ...document.components, schemas },
    },
    override,
  });
  return Object.fromEntries(
    getModelTypeCheckSkips(context, {
      library,
      nameOf: (key) => key,
      ...options,
    }),
  );
};

const ref = (key: string) => ({ $ref: `#/components/schemas/${key}` });

describe('getModelTypeCheckSkips', () => {
  it('skips nothing a library types exactly', () => {
    expect(
      skipsOf(
        {
          Pet: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'integer', default: 1 },
              tags: { type: 'array', items: { type: 'string' } },
              owner: ref('Owner'),
            },
            additionalProperties: true,
          },
          Owner: { type: 'object', properties: { name: { type: 'string' } } },
        },
        'valibot',
      ),
    ).toEqual({});
  });

  describe('prefixItems', () => {
    const tuple: OpenApiSchemaObject = {
      type: 'array',
      prefixItems: [{ type: 'number' }, { type: 'string' }],
    };
    const schemas: Record<string, OpenApiSchemaObject> = {
      Point: tuple,
      Line: { type: 'object', properties: { from: tuple } },
    };

    it('is skipped for Valibot, in a component and in a property', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({
        Point: 'prefixItems is validated as an array of unknown',
        Line: 'prefixItems is validated as an array of unknown',
      });
    });

    it('is checked for Zod, which has tuples', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({});
    });
  });

  describe('a binary string', () => {
    const schemas = {
      Upload: {
        type: 'object',
        properties: { file: { type: 'string', format: 'binary' } },
      },
      // Orval reads `format: binary` of an OpenAPI 3.1 document this way.
      Octets: { type: 'string', contentMediaType: 'application/octet-stream' },
      Encoded: {
        type: 'string',
        contentMediaType: 'application/octet-stream',
        contentEncoding: 'base64',
      },
      // An empty encoding is no encoding.
      Unencoded: {
        type: 'string',
        contentMediaType: 'application/octet-stream',
        contentEncoding: '',
      },
      // Without a type, nothing is validated as a file.
      Typeless: {
        type: 'object',
        properties: { file: { format: 'binary' } },
      },
      // A number never reaches the string branch, so it stays a number.
      Numeric: { type: 'integer', format: 'binary' },
      NullableFile: { type: ['string', 'null'], format: 'binary' },
      // Each member of a type list is generated, so the string one is a file.
      FileOrNumber: { type: ['string', 'number'], format: 'binary' },
      // Without a string member, or with an encoding, nothing is a file.
      NumberOrNull: { type: ['number', 'null'], format: 'binary' },
      EncodedOrNumber: {
        type: ['string', 'number'],
        contentMediaType: 'application/octet-stream',
        contentEncoding: 'base64',
      },
    } satisfies Record<string, OpenApiSchemaObject>;

    it('is skipped for Valibot', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({
        Upload:
          'a binary string is validated as File, which the model types as Blob',
        Octets:
          'a binary string is validated as File, which the model types as Blob',
        Unencoded:
          'a binary string is validated as File, which the model types as Blob',
        NullableFile:
          'a binary string is validated as File, which the model types as Blob',
        FileOrNumber:
          'a binary string is validated as File, which the model types as Blob',
      });
    });

    it('is checked for Zod', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({});
    });
  });

  describe('a default on an optional property', () => {
    const reason =
      'the default of an optional property makes it required in the schema output only';

    it.each(['valibot', 'zod'] as const)('is skipped for %s', (library) => {
      expect(
        skipsOf(
          {
            Flat: {
              type: 'object',
              properties: { size: { type: 'integer', default: 1 } },
            },
            Nested: {
              type: 'object',
              required: ['inner'],
              properties: {
                inner: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { size: { type: 'integer', default: 1 } },
                  },
                },
              },
            },
          },
          library,
        ),
      ).toEqual({ Flat: reason, Nested: reason });
    });

    it('is checked on a required property', () => {
      expect(
        skipsOf(
          {
            Flat: {
              type: 'object',
              required: ['size'],
              properties: { size: { type: 'integer', default: 1 } },
            },
          },
          'zod',
        ),
      ).toEqual({});
    });

    it('is followed through a reference for Valibot only', () => {
      const schemas = {
        Size: { type: 'integer', default: 1 },
        Box: { type: 'object', properties: { size: ref('Size') } },
      } satisfies Record<string, OpenApiSchemaObject>;
      expect(skipsOf(schemas, 'valibot')).toEqual({ Box: reason });
      expect(skipsOf(schemas, 'zod')).toEqual({});
    });
  });

  describe('a readOnly array', () => {
    const schemas = {
      Item: {
        type: 'object',
        properties: {
          tags: { type: 'array', readOnly: true, items: { type: 'string' } },
          id: { type: 'integer', readOnly: true },
        },
      },
      Plain: {
        type: 'object',
        properties: { id: { type: 'integer', readOnly: true } },
      },
    } satisfies Record<string, OpenApiSchemaObject>;

    it('is skipped for Zod, whose output is not readonly', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({
        Item: 'a readOnly array is readonly in the model, which the schema output is not',
      });
    });

    it('is checked for Zod when the array has no items, which the model leaves mutable', () => {
      expect(
        skipsOf(
          {
            Bare: { type: 'array', readOnly: true },
            Holder: {
              type: 'object',
              properties: { list: ref('Bare') },
            },
          } as Record<string, OpenApiSchemaObject>,
          'zod',
        ),
      ).toEqual({});
    });

    it('is checked for Zod with suppressReadonlyModifier, which keeps the model mutable', () => {
      expect(
        skipsOf(schemas, 'zod', { suppressReadonlyModifier: true }),
      ).toEqual({});
    });

    it('is checked for Valibot, which pipes `v.readonly()`', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({});
    });

    describe('where the model puts the readonly elsewhere', () => {
      const tags = { type: 'array', items: { type: 'string' } } as const;
      const placed: Record<string, OpenApiSchemaObject> = {
        Tags: tags,
        TagsReadOnly: { ...tags, readOnly: true },
        OnReference: {
          type: 'object',
          properties: { tags: { ...ref('Tags'), readOnly: true } },
        },
        InArray: {
          type: 'array',
          items: { ...tags, readOnly: true },
        },
        InArrays: {
          type: 'object',
          properties: {
            matrix: { type: 'array', items: { ...tags, readOnly: true } },
          },
        },
        // These match the model.
        OfReadOnly: {
          type: 'object',
          properties: { tags: ref('TagsReadOnly') },
        },
        ObjectReference: {
          type: 'object',
          properties: {
            owner: { ...ref('Owner'), readOnly: true },
          },
        },
        Owner: { type: 'object', properties: { id: { type: 'string' } } },
        InObject: {
          type: 'object',
          additionalProperties: { ...tags, readOnly: true },
        },
        OfReference: {
          type: 'array',
          items: ref('TagsReadOnly'),
        },
      };

      it('is skipped for Valibot, for a reference and for an item', () => {
        expect(skipsOf(placed, 'valibot')).toEqual({
          OnReference:
            'the readOnly of a reference to an array is readonly in the schema output only',
          InArray:
            'a readOnly array in an array is readonly in the schema, which the model applies to the outer array',
          InArrays:
            'a readOnly array in an array is readonly in the schema, which the model applies to the outer array',
        });
      });
    });
  });

  it.each(['valibot', 'zod'] as const)(
    'skips additionalProperties next to properties for %s',
    (library) => {
      expect(
        skipsOf(
          {
            Mixed: {
              type: 'object',
              properties: { a: { type: 'string' } },
              additionalProperties: { type: 'string' },
            },
            Map: { type: 'object', additionalProperties: { type: 'string' } },
            Open: {
              type: 'object',
              properties: { a: { type: 'string' } },
              additionalProperties: {},
            },
            Closed: {
              type: 'object',
              properties: { a: { type: 'string' } },
              additionalProperties: false,
            },
          },
          library,
        ),
      ).toEqual({
        Mixed:
          'additionalProperties next to properties is typed unknown by the model',
      });
    },
  );

  it.each(['valibot', 'zod'] as const)(
    'skips a const that is an object or an array for %s',
    (library) => {
      expect(
        skipsOf(
          {
            Fixed: {
              type: 'object',
              properties: { kind: { const: { a: 1 } } },
            },
            Tuple: { type: 'array', items: { const: [1] } },
            Label: { const: 'a' },
          },
          library,
        ),
      ).toEqual({
        Fixed: 'a const that is an object or an array is not validated',
        Tuple: 'a const that is an object or an array is not validated',
      });
    },
  );

  describe('a tuple', () => {
    const rest = 'a tuple of a fixed length keeps its rest items in the model';
    const tuple = (extra: Record<string, unknown>): OpenApiSchemaObject => ({
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'number' }],
      ...extra,
    });
    const schemas: Record<string, OpenApiSchemaObject> = {
      Open: tuple({}),
      Longer: tuple({ items: { type: 'string' }, maxItems: 3 }),
      Unbounded: tuple({ items: { type: 'string' } }),
      Closed: tuple({ items: { type: 'string' }, minItems: 2, maxItems: 2 }),
      NoRest: tuple({ items: false, maxItems: 2 }),
      Nested: {
        type: 'object',
        properties: { pair: tuple({ items: {}, maxItems: 1 }) },
      },
      ReadOnly: {
        type: 'object',
        properties: { pair: tuple({ readOnly: true }) },
      },
    };

    it('is skipped for Zod when it cannot grow past its prefix and has rest items', () => {
      const skips = skipsOf(schemas, 'zod');
      expect(Object.keys(skips)).toEqual(['Closed', 'Nested']);
      expect(skips.Closed).toContain(rest);
    });

    it('keeps the readOnly of a tuple checked for Zod, which the model leaves alone', () => {
      expect(skipsOf(schemas, 'zod')).not.toHaveProperty('ReadOnly');
    });
  });

  describe('with useReadonlyArrays', () => {
    const reason =
      'with useReadonlyArrays an array is readonly in the model, which the schema output is only for a readOnly array';

    // The schema output of a readOnly array is readonly too, so the pair
    // matches; `suppressReadonlyModifier` keeps it mutable.
    const readOnlySchemas: Record<string, OpenApiSchemaObject> = {
      ReadOnlyTags: {
        type: 'array',
        readOnly: true,
        items: { type: 'string' },
      },
      Holder: {
        type: 'object',
        properties: {
          tags: { type: 'array', readOnly: true, items: { type: 'string' } },
        },
      },
    };

    it('checks a readOnly array, whose schema output is readonly too', () => {
      expect(
        skipsOf(readOnlySchemas, 'valibot', { useReadonlyArrays: true }),
      ).toEqual({});
    });

    it('skips a readOnly array with suppressReadonlyModifier', () => {
      expect(
        skipsOf(readOnlySchemas, 'valibot', {
          useReadonlyArrays: true,
          suppressReadonlyModifier: true,
        }),
      ).toEqual({ ReadOnlyTags: reason, Holder: reason });
    });
    const schemas: Record<string, OpenApiSchemaObject> = {
      Tags: { type: 'array', items: { type: 'string' } },
      Pet: {
        type: 'object',
        properties: { tags: { type: 'array', items: { type: 'string' } } },
      },
      Nullable: {
        type: 'object',
        properties: { tags: { type: ['array', 'null'], items: {} } },
      },
      Owner: { type: 'object', properties: { name: { type: 'string' } } },
      Household: { type: 'object', properties: { pets: ref('Tags') } },
    };

    it.each([
      ['valibot', reason],
      [
        'zod',
        'with useReadonlyArrays an array is readonly in the model, which the schema output is not',
      ],
    ] as const)(
      'skips the components that hold an array for %s',
      (library, expected) => {
        expect(skipsOf(schemas, library, { useReadonlyArrays: true })).toEqual({
          Tags: expected,
          Pet: expected,
          Nullable: expected,
          Household: 'it references Tags, which is skipped',
        });
      },
    );

    // Zod writes no readonly array, even for a readOnly one, so every array
    // differs from the model.
    it('skips a readOnly array for Zod', () => {
      expect(
        Object.keys(
          skipsOf(readOnlySchemas, 'zod', { useReadonlyArrays: true }),
        ),
      ).toEqual(['ReadOnlyTags', 'Holder']);
    });

    it.each(['valibot', 'zod'] as const)(
      'checks them without it for %s',
      (library) => {
        expect(skipsOf(schemas, library)).toEqual({});
      },
    );
  });

  describe('an enum with an object member', () => {
    const schemas: Record<string, OpenApiSchemaObject> = {
      Listed: {
        type: 'object',
        properties: { kind: { enum: ['a', { b: 1 }] } },
      },
      Arrays: { type: 'array', items: { enum: [[1], [2]] } },
      Labels: { type: 'string', enum: ['a', 'b'] },
    };

    it('is skipped for Valibot, which validates it as unknown', () => {
      const reason =
        'an enum with an object or an array member is validated as unknown';
      expect(skipsOf(schemas, 'valibot')).toEqual({
        Listed: reason,
        Arrays: reason,
      });
    });

    it('is checked for Zod, whose empty enum matches the model', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({});
    });
  });

  describe('a required key without a property', () => {
    const reason =
      'a required key without a property is validated as unknown, which the model leaves out';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Declared: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      Missing: {
        type: 'object',
        required: ['id', 'extra'],
        properties: { id: { type: 'string' } },
      },
      NoProperties: { type: 'object', required: ['extra'] },
      Nested: {
        type: 'object',
        properties: {
          inner: { type: 'object', required: ['extra'] },
        },
      },
      Alternative: {
        oneOf: [
          {
            type: 'object',
            required: ['extra'],
            properties: { id: { type: 'string' } },
          },
          { type: 'string' },
        ],
      },
      // The members of an allOf are read through their parent.
      Base: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
      Required: { allOf: [ref('Base'), { required: ['name'] }] },
      ParentRequires: { required: ['name'], allOf: [ref('Base')] },
      Alien: {
        type: 'object',
        required: ['name', 'alien'],
        properties: { own: { type: 'string' } },
        allOf: [ref('Base')],
      },
      Unrelated: {
        allOf: [
          {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id', 'extra'],
          },
        ],
      },
    };

    it('is skipped for Valibot, in a component, a property and an alternative', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({
        Missing: reason,
        NoProperties: reason,
        Nested: reason,
        Alternative: reason,
      });
    });
  });

  describe('a required key that only the alternatives declare', () => {
    const reason =
      'a required key that only the alternatives declare is required in each of them, which the model does not';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Optional: { type: 'object', properties: { name: { type: 'string' } } },
      Declares: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
        oneOf: [ref('Optional')],
      },
      Leaves: {
        type: 'object',
        required: ['name'],
        oneOf: [
          ref('Optional'),
          { type: 'object', properties: { id: { type: 'string' } } },
        ],
      },
      LeavesWithProperties: {
        type: 'object',
        required: ['name'],
        properties: { extra: { type: 'string' } },
        anyOf: [ref('Optional')],
      },
      // Every alternative requires the key already.
      Requires: {
        type: 'object',
        required: ['name'],
        oneOf: [
          {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' } },
          },
          {
            type: 'object',
            required: ['name', 'id'],
            properties: { name: { type: 'string' }, id: { type: 'string' } },
          },
        ],
      },
      // The members of an allOf are read through their parent.
      Merges: {
        type: 'object',
        required: ['name'],
        allOf: [ref('Optional')],
      },
      // An alternative that does not declare the key is left alone, and the
      // others require it already.
      Unrelated: {
        type: 'object',
        required: ['name'],
        oneOf: [
          {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' } },
          },
          { type: 'object', properties: { id: { type: 'string' } } },
          { type: 'null' },
        ],
      },
      // One alternative declares the key without requiring it, next to
      // others that do not declare it.
      Mixed: {
        type: 'object',
        required: ['name'],
        oneOf: [
          { type: 'object', properties: { id: { type: 'string' } } },
          ref('Optional'),
        ],
      },
    };

    it('is skipped for Valibot, which requires it in each alternative', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({
        Leaves: reason,
        LeavesWithProperties: reason,
        Mixed: reason,
      });
    });

    it('is checked for Zod, which leaves the key out like the model', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({});
    });
  });

  describe('an alternative that only requires keys', () => {
    const reason =
      'an alternative that only requires keys is validated as an object with them, which the model types as unknown';
    const schemas: Record<string, OpenApiSchemaObject> = {
      WithProperties: {
        properties: { a: { type: 'string' }, b: { type: 'string' } },
        oneOf: [{ required: ['a'] }, { required: ['b'] }],
      },
      Typed: {
        type: 'object',
        anyOf: [{ required: ['a'] }, { required: ['b'] }],
      },
      Nullable: {
        type: ['object', 'null'],
        oneOf: [{ required: ['a'] }],
      },
      // Without an object of its own, every alternative stays unknown.
      NoObject: { oneOf: [{ required: ['a'] }, { required: ['b'] }] },
      Described: {
        properties: { a: { type: 'string' } },
        oneOf: [{ description: 'a', required: ['a'] }],
      },
      // A typed alternative is validated as what it says.
      Typed2: {
        properties: { a: { type: 'string' } },
        oneOf: [{ type: 'object', properties: { a: { type: 'string' } } }],
      },
      AllOf: {
        properties: { a: { type: 'string' } },
        allOf: [{ required: ['a'] }],
      },
    };

    it('is skipped for Valibot, next to an object', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({
        WithProperties: reason,
        Typed: reason,
        Nullable: reason,
        Described: reason,
      });
    });

    it('is skipped for Zod, next to properties', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({
        WithProperties: reason,
        Described: reason,
      });
    });
  });

  describe('a const typed with null', () => {
    const reason = 'a const typed with null is typed without null by the model';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Alone: {
        type: 'object',
        required: ['kind'],
        properties: { kind: { type: ['string', 'null'], const: 'circle' } },
      },
      Mixed: {
        type: 'object',
        required: ['kind', 'name'],
        properties: {
          kind: { type: ['string', 'null'], const: 'circle' },
          name: { type: 'string' },
        },
      },
      Nested: {
        type: 'object',
        required: ['marker'],
        properties: {
          marker: {
            type: 'object',
            required: ['kind'],
            properties: { kind: { type: ['string', 'null'], const: 'a' } },
          },
        },
      },
      NullableFlag: {
        type: 'object',
        properties: {
          kind: { type: 'string', const: 'a', nullable: true },
          name: { type: 'string' },
        },
      },
      Uses: { type: 'object', properties: { value: ref('Alone') } },
      // Without null in the type, the const is typed as it is.
      Plain: {
        type: 'object',
        required: ['kind', 'name'],
        properties: { kind: { const: 'circle' }, name: { type: 'string' } },
      },
    };

    it.each(['valibot', 'zod'] as const)(
      'is skipped for %s whatever the options are',
      (library) => {
        const skipped = {
          Alone: reason,
          Mixed: reason,
          NullableFlag: reason,
          Nested: reason,
          Uses: 'it references Alone, which is skipped',
        };
        expect(skipsOf(schemas, library)).toEqual(skipped);
        expect(
          skipsOf(schemas, library, { useTypeOverInterfaces: true }),
        ).toEqual(skipped);
      },
    );
  });

  describe('a component of constants', () => {
    const reason =
      'a component of constants is a constant object in the model, with every key required';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Required: {
        type: 'object',
        required: ['kind'],
        properties: { kind: { const: 'circle' } },
      },
      Optional: { type: 'object', properties: { kind: { const: 'circle' } } },
      // Another property makes it an interface.
      Mixed: {
        type: 'object',
        properties: { kind: { const: 'circle' }, name: { type: 'string' } },
      },
      // Only a component is written that way.
      Nested: {
        type: 'object',
        required: ['marker'],
        properties: {
          marker: { type: 'object', properties: { kind: { const: 'a' } } },
        },
      },
    };

    it.each(['valibot', 'zod'] as const)(
      'is skipped for %s when a key is optional',
      (library) => {
        expect(skipsOf(schemas, library)).toEqual({ Optional: reason });
      },
    );

    it.each(['valibot', 'zod'] as const)(
      'is checked for %s with useTypeOverInterfaces',
      (library) => {
        expect(
          skipsOf(schemas, library, { useTypeOverInterfaces: true }),
        ).toEqual({});
      },
    );
  });

  describe('a 64-bit integer', () => {
    const reason =
      'a 64-bit integer is a bigint in the model with useBigInt, and a number in the schema';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Big: {
        type: 'object',
        properties: { id: { type: 'integer', format: 'int64' } },
      },
      Nullable: {
        type: 'object',
        properties: { id: { type: ['integer', 'null'], format: 'uint64' } },
      },
      Small: {
        type: 'object',
        properties: { id: { type: 'integer', format: 'int32' } },
      },
      Text: {
        type: 'object',
        properties: { id: { type: 'string', format: 'int64' } },
      },
      Uses: { type: 'object', properties: { big: ref('Big') } },
      // The literals are numbers in both.
      Literal: { type: 'integer', format: 'int64', enum: [1, 2] },
    };

    it.each(['valibot', 'zod'] as const)(
      'is skipped with useBigInt for %s, with the components that use it',
      (library) => {
        expect(skipsOf(schemas, library, { useBigInt: true })).toEqual({
          Big: reason,
          Nullable: reason,
          Uses: 'it references Big, which is skipped',
        });
      },
    );

    it.each(['valibot', 'zod'] as const)(
      'is checked without useBigInt for %s',
      (library) => {
        expect(skipsOf(schemas, library)).toEqual({});
      },
    );
  });

  describe('a schema without a type', () => {
    const schemas: Record<string, OpenApiSchemaObject> = {
      Anything: {},
      Described: { description: 'any value' },
      Bounded: { minimum: 1 },
      Typed: { type: 'string' },
      Listed: { enum: ['a', 'b'] },
      Alias: ref('Typed'),
      Holder: {
        type: 'object',
        properties: { value: {}, note: { description: 'any value' } },
      },
      Uses: { type: 'object', properties: { value: ref('Anything') } },
    };

    it.each(['valibot', 'zod'] as const)(
      'is skipped as a component for %s, not as a subschema',
      (library) => {
        const reason =
          'a schema without a type is validated as unknown, which the model types as {}';
        expect(skipsOf(schemas, library)).toEqual({
          Anything: reason,
          Described: reason,
          Bounded: reason,
          Uses: 'it references Anything, which is skipped',
        });
      },
    );
  });

  describe('a schema without a type that describes an object', () => {
    const reason =
      'a schema without a type that describes an object is validated as unknown, which the model types as an object';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Dictionary: { additionalProperties: { type: 'string' } },
      Open: { additionalProperties: true },
      Closed: { additionalProperties: false },
      Patterned: { patternProperties: { '^x-': { type: 'string' } } },
      Bare: { properties: {} },
      Merged: {
        allOf: [ref('Typed'), { additionalProperties: { type: 'string' } }],
      },
      MergedPattern: {
        allOf: [
          ref('Typed'),
          { patternProperties: { '^x-': { type: 'string' } } },
        ],
      },
      Nested: {
        type: 'object',
        properties: { meta: { additionalProperties: { type: 'string' } } },
      },
      NestedPattern: {
        type: 'object',
        properties: { meta: { patternProperties: { '^x-': {} } } },
      },
      InList: {
        type: 'array',
        items: { patternProperties: { '^x-': { type: 'string' } } },
      },
      Uses: { type: 'object', properties: { value: ref('Dictionary') } },
      UsesBare: { type: 'object', properties: { value: ref('Bare') } },
      // Typed, so the model and the schema agree.
      Typed: { type: 'object', properties: { id: { type: 'integer' } } },
      Record: { type: 'object', additionalProperties: { type: 'string' } },
      Described: {
        type: 'object',
        properties: { any: { description: 'any value' } },
      },
      Declared: {
        type: 'object',
        properties: {
          meta: { properties: { id: { type: 'integer' } } },
        },
      },
    };

    it('is skipped for Valibot in a component, a member and a property', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({
        Dictionary: reason,
        Open: reason,
        Closed: reason,
        Patterned: reason,
        Bare: reason,
        Merged: reason,
        MergedPattern: reason,
        Nested: reason,
        NestedPattern: reason,
        InList: reason,
        Uses: 'it references Dictionary, which is skipped',
        UsesBare: 'it references Bare, which is skipped',
      });
    });

    it('is skipped for Zod only as a component, where it has no record', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({
        Closed: reason,
        Patterned: reason,
        Bare: reason,
        UsesBare: 'it references Bare, which is skipped',
      });
    });
  });

  describe('properties next to a null or enum alternative', () => {
    const reason =
      'a null, nullable or enum alternative next to properties or allOf is merged by the model and intersected in the schema';
    const left: OpenApiSchemaObject = {
      type: 'object',
      properties: { left: { type: 'string' } },
    };
    const own: OpenApiSchemaObject = {
      type: 'object',
      properties: { id: { type: 'string' } },
    };
    const schemas: Record<string, OpenApiSchemaObject> = {
      Left: left,
      NullableLeft: { ...left, type: ['object', 'null'] },
      Letters: { type: 'string', enum: ['a', 'b'] },
      NullAlt: { ...own, anyOf: [left, { type: 'null' }] },
      NullAltOneOf: { ...own, oneOf: [left, { type: 'null' }] },
      NullableInline: {
        ...own,
        anyOf: [{ ...left, nullable: true }, left],
      },
      NullTyped: {
        ...own,
        anyOf: [{ ...left, type: ['object', 'null'] }, left],
      },
      NullableRef: {
        ...own,
        anyOf: [{ ...ref('Left'), nullable: true }, left],
      },
      RefToNullable: { ...own, oneOf: [ref('NullableLeft'), left] },
      EnumAlts: {
        ...own,
        anyOf: [
          { type: 'string', enum: ['a'] },
          { type: 'string', enum: ['b'] },
        ],
      },
      RefToEnum: { ...own, anyOf: [ref('Letters'), ref('Left')] },
      Nested: { ...own, anyOf: [{ anyOf: [left, { type: 'null' }] }, left] },
      AllOfSibling: {
        allOf: [ref('Left')],
        anyOf: [
          { type: 'string', enum: ['a'] },
          { type: 'string', enum: ['b'] },
        ],
      },
      Uses: { type: 'object', properties: { value: ref('NullAlt') } },
      // Objects and plain types are merged as they are intersected.
      Objects: { ...own, anyOf: [left, { ...left, required: ['left'] }] },
      Plain: { ...own, anyOf: [{ type: 'string' }, left] },
      // Without properties or allOf of its own there is nothing to drop.
      Bare: { anyOf: [left, { type: 'null' }] },
      Typed: { type: 'object', oneOf: [left, { type: 'null' }] },
    };

    it.each(['valibot', 'zod'] as const)('is skipped for %s', (library) => {
      expect(skipsOf(schemas, library)).toEqual({
        NullAlt: reason,
        NullAltOneOf: reason,
        NullableInline: reason,
        NullTyped: reason,
        NullableRef: reason,
        RefToNullable: reason,
        EnumAlts: reason,
        RefToEnum: reason,
        Nested: reason,
        AllOfSibling: reason,
        Uses: 'it references NullAlt, which is skipped',
      });
    });
  });

  describe('properties next to an enum allOf member', () => {
    const reason =
      'an enum allOf member next to properties is an alternative in the model and intersected in the schema';
    const own: OpenApiSchemaObject = {
      type: 'object',
      properties: { a: { type: 'string' } },
    };
    const schemas: Record<string, OpenApiSchemaObject> = {
      Status: { type: 'string', enum: ['on', 'off'] },
      Inline: { ...own, allOf: [{ type: 'integer', enum: [1, 2] }] },
      ByRef: { ...own, allOf: [ref('Status')] },
      Uses: { type: 'object', properties: { value: ref('ByRef') } },
      // Without properties of its own, the member is the whole type.
      Bare: { allOf: [ref('Status')] },
      // A const member is intersected like the model merges it.
      Constant: { ...own, allOf: [{ type: 'string', const: 'x' }] },
    };

    it.each(['valibot', 'zod'] as const)('is skipped for %s', (library) => {
      expect(skipsOf(schemas, library)).toEqual({
        Inline: reason,
        ByRef: reason,
        Uses: 'it references ByRef, which is skipped',
      });
    });
  });

  describe('a reference outside the component schemas', () => {
    const responseSchema = (path: string) =>
      `#/paths/~1${path}/get/responses/200/content/application~1json/schema`;
    const pairsRef = responseSchema('pairs');
    const loopRef = responseSchema('loop');
    const document = {
      paths: {
        '/pairs': {
          get: {
            responses: {
              '200': {
                description: 'A pair',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      prefixItems: [{ type: 'string' }],
                    },
                  },
                },
              },
            },
          },
        },
        // A reference that points back at itself.
        '/loop': {
          get: {
            responses: {
              '200': {
                description: 'A loop',
                content: { 'application/json': { schema: { $ref: loopRef } } },
              },
            },
          },
        },
      },
      components: {
        responses: {
          Pairs: {
            description: 'A pair',
            content: { 'application/json': { schema: { $ref: pairsRef } } },
          },
        },
      },
    } satisfies {
      paths: OpenApiPathsObject;
      components: OpenApiComponentsObject;
    };

    const schemas: Record<string, OpenApiSchemaObject> = {
      Pairs: {
        type: 'object',
        properties: {
          list: { $ref: pairsRef },
        },
      },
      // The target of a reference to a response is followed on to its own.
      ViaResponse: {
        type: 'object',
        properties: {
          list: {
            $ref: '#/components/responses/Pairs/content/application~1json/schema',
          },
        },
      },
      Plain: { type: 'object', properties: { id: { type: 'string' } } },
      Dangling: {
        type: 'object',
        properties: { id: { $ref: '#/paths/~1gone' } },
      },
      Cycle: {
        type: 'object',
        properties: { id: { $ref: loopRef } },
      },
    };

    it('is followed to the constructs it holds for Valibot', () => {
      const reason = 'prefixItems is validated as an array of unknown';
      expect(skipsOf(schemas, 'valibot', undefined, document)).toEqual({
        Pairs: reason,
        ViaResponse: reason,
      });
    });

    it('is skipped for Zod, which validates it as unknown', () => {
      const reason =
        'a reference to anything but a whole component schema is validated as unknown';
      expect(
        skipsOf(
          {
            ...schemas,
            Src: { type: 'object', properties: { name: { type: 'string' } } },
            SubSchema: {
              type: 'object',
              properties: {
                name: { $ref: '#/components/schemas/Src/properties/name' },
              },
            },
            Whole: { type: 'object', properties: { src: ref('Src') } },
          },
          'zod',
          undefined,
          document,
        ),
      ).toEqual({
        Pairs: reason,
        ViaResponse: reason,
        Dangling: reason,
        Cycle: reason,
        SubSchema: reason,
      });
    });

    it('treats the components it references as dependencies', () => {
      const withPaths = {
        paths: {
          '/owner': {
            get: {
              responses: {
                '200': {
                  description: 'An owner',
                  content: {
                    'application/json': { schema: ref('Owner') },
                  },
                },
              },
            },
          },
        },
      };
      expect(
        skipsOf(
          {
            Owner: {
              type: 'object',
              properties: { tags: { type: 'array', prefixItems: [{}] } },
            },
            Holder: {
              type: 'object',
              properties: {
                owner: {
                  $ref: '#/paths/~1owner/get/responses/200/content/application~1json/schema',
                },
              },
            },
          },
          'valibot',
          undefined,
          withPaths,
        ),
      ).toEqual({
        Owner: 'prefixItems is validated as an array of unknown',
        Holder: 'it references Owner, which is skipped',
      });
    });
  });

  describe('a component that references a skipped one', () => {
    const schemas: Record<string, OpenApiSchemaObject> = {
      Point: { type: 'array', prefixItems: [{ type: 'number' }] },
      Line: { type: 'object', properties: { from: ref('Point') } },
      Shape: { type: 'array', items: ref('Line') },
      Either: { oneOf: [ref('Shape'), { type: 'string' }] },
      Other: { type: 'object', properties: { name: { type: 'string' } } },
    };

    it('is skipped too, however far the reference is', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({
        Point: 'prefixItems is validated as an array of unknown',
        Line: 'it references Point, which is skipped',
        Shape: 'it references Line, which is skipped',
        Either: 'it references Shape, which is skipped',
      });
    });

    it('names the model in the reason', () => {
      const context = createTestContextSpec({
        spec: { components: { schemas } },
      });
      const skips = getModelTypeCheckSkips(context, {
        library: 'valibot',
        nameOf: (key) => `Models.${key}`,
      });
      expect(skips.get('Line')).toBe(
        'it references Models.Point, which is skipped',
      );
    });
  });

  describe('definitions', () => {
    const prefixItems = 'prefixItems is validated as an array of unknown';
    const pair: OpenApiSchemaObject = {
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'number' }],
    };

    it('leaves out a definition nothing references', () => {
      expect(
        skipsOf({ Name: { type: 'string', $defs: { Pair: pair } } }, 'valibot'),
      ).toEqual({});
    });

    it('follows a reference into a definition', () => {
      expect(
        skipsOf(
          {
            Line: {
              type: 'object',
              properties: {
                ends: { $ref: '#/components/schemas/Line/$defs/Pair' },
              },
              $defs: { Pair: pair },
            },
          },
          'valibot',
        ),
      ).toEqual({ Line: prefixItems });
    });
  });

  describe('a reference to a subschema of a component', () => {
    const prefixItems = 'prefixItems is validated as an array of unknown';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Owner: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          pair: { type: 'array', prefixItems: [{ type: 'string' }] },
        },
      },
      OwnerId: { $ref: '#/components/schemas/Owner/properties/id' },
      OwnerPair: { $ref: '#/components/schemas/Owner/properties/pair' },
    };

    it('is followed to its target, not taken for the whole component', () => {
      // OwnerId's target is a string, whatever else Owner holds, so it is
      // checked. OwnerPair's target is the tuple itself, so it is skipped for
      // that, not for referencing Owner.
      expect(skipsOf(schemas, 'valibot')).toEqual({
        Owner: prefixItems,
        OwnerPair: prefixItems,
      });
    });
  });

  describe('a target reached in several roles', () => {
    const itemRef =
      '#/paths/~1item/get/responses/200/content/application~1json/schema';
    const document = {
      paths: {
        '/item': {
          get: {
            responses: {
              '200': {
                description: 'An item',
                content: {
                  'application/json': {
                    // Requires `extra` without declaring it, which matters
                    // for a property but not for an `allOf` member.
                    schema: {
                      type: 'object',
                      required: ['id', 'extra'],
                      properties: { id: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } satisfies { paths: OpenApiPathsObject };

    it('is checked in each, after an allOf member', () => {
      // The walk reaches the `allOf` member before the property, which sits
      // a level deeper.
      expect(
        skipsOf(
          {
            Holder: {
              allOf: [{ $ref: itemRef }],
              properties: {
                wrap: {
                  type: 'object',
                  properties: { item: { $ref: itemRef } },
                },
              },
            },
          },
          'valibot',
          undefined,
          document,
        ),
      ).toEqual({
        Holder:
          'a required key without a property is validated as unknown, which the model leaves out',
      });
    });

    it('is not skipped for an allOf member alone', () => {
      expect(
        skipsOf(
          { Holder: { allOf: [{ $ref: itemRef }] } },
          'valibot',
          undefined,
          document,
        ),
      ).toEqual({});
    });
  });

  describe('a circular reference', () => {
    const schemas: Record<string, OpenApiSchemaObject> = {
      Tree: { type: 'object', additionalProperties: ref('Tree') },
      Node: {
        type: 'object',
        properties: { next: ref('Node') },
      },
    };
    const context = createTestContextSpec({
      spec: { components: { schemas } },
    });

    it('is skipped when the policy cannot keep it', () => {
      const skips = getModelTypeCheckSkips(context, {
        library: 'valibot',
        nameOf: (key) => key,
        refPolicy: () => false,
      });
      expect(Object.fromEntries(skips)).toEqual({
        Tree: 'a circular reference is validated as unknown',
        Node: 'a circular reference is validated as unknown',
      });
    });

    it('is checked when the policy keeps it', () => {
      const skips = getModelTypeCheckSkips(context, {
        library: 'valibot',
        nameOf: (key) => key,
        refPolicy: createSharedRefPolicy(context, undefined, () => false),
      });
      expect(skips.has('Node')).toBe(false);
    });

    it('is checked for Zod, which reads it lazily', () => {
      const skips = getModelTypeCheckSkips(context, {
        library: 'zod',
        nameOf: (key) => key,
        refPolicy: () => false,
      });
      expect(skips.size).toBe(0);
    });
  });
  describe('a circular reference through prefixItems', () => {
    const reason =
      'a circular reference through prefixItems is validated as unknown';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Direct: {
        type: 'object',
        properties: {
          t: {
            type: 'array',
            prefixItems: [{ type: 'string' }, ref('Direct')],
          },
        },
      },
      Self: { type: 'array', prefixItems: [ref('Self')] },
      First: { type: 'array', prefixItems: [ref('Second')] },
      Second: { type: 'object', properties: { back: ref('First') } },
      Either: {
        oneOf: [
          { type: 'array', prefixItems: [ref('Either')] },
          { type: 'string' },
        ],
      },
      Uses: { type: 'object', properties: { direct: ref('Direct') } },
      Plain: { type: 'array', prefixItems: [{ type: 'string' }, ref('Leaf')] },
      Leaf: { type: 'object', properties: { id: { type: 'string' } } },
      List: {
        type: 'object',
        properties: {
          next: ref('List'),
          pair: { type: 'array', prefixItems: [{ type: 'string' }] },
        },
      },
    };

    it('is skipped for Zod, which stops inlining after one level', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({
        Direct: reason,
        Self: reason,
        First: reason,
        Second: 'it references First, which is skipped',
        Either: reason,
        Uses: 'it references Direct, which is skipped',
      });
    });

    it('leaves a tuple that no cycle passes through, and a cycle outside tuples', () => {
      const skips = skipsOf(schemas, 'zod');
      expect(skips).not.toHaveProperty('Plain');
      expect(skips).not.toHaveProperty('List');
    });

    it('is left to the circular policy for Valibot', () => {
      expect(skipsOf({ Self: schemas.Self }, 'valibot')).toEqual({
        Self: 'prefixItems is validated as an array of unknown',
      });
    });
  });

  describe('a type with null next to a composition', () => {
    const reason =
      'a null type next to allOf, oneOf or anyOf is validated without the null';
    const base: OpenApiSchemaObject = {
      type: 'object',
      properties: { a: { type: 'string' } },
    };
    const schemas: Record<string, OpenApiSchemaObject> = {
      Base: base,
      Prop: {
        type: 'object',
        properties: { p: { type: 'null', allOf: [ref('Base')] } },
      },
      Root: { type: 'null', allOf: [ref('Base')] },
      Nullable: {
        type: 'object',
        properties: { p: { type: ['null', 'string'], allOf: [ref('Base')] } },
      },
      Any: {
        type: 'object',
        properties: {
          p: { type: 'null', anyOf: [ref('Base'), { type: 'string' }] },
        },
      },
      One: {
        type: ['null', 'object'],
        oneOf: [ref('Base'), { type: 'string' }],
      },
      Flag: {
        type: 'object',
        properties: { p: { nullable: true, allOf: [ref('Base')] } },
      },
      Alone: { type: 'object', properties: { p: { type: 'null' } } },
      ObjectOne: { type: ['object', 'null'], oneOf: [ref('Base')] },
      ObjectAll: {
        type: ['null', 'object'],
        properties: { b: { type: 'string' } },
        allOf: [ref('Base')],
      },
      ObjectProp: {
        type: 'object',
        properties: {
          p: { type: ['object', 'null'], anyOf: [ref('Base'), ref('Base')] },
        },
      },
      ArrayOne: {
        type: ['array', 'null'],
        oneOf: [{ type: 'array', items: { type: 'string' } }],
      },
    };

    it('is skipped for Zod, which drops the null', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({
        Prop: reason,
        Root: reason,
        Nullable: reason,
        Any: reason,
        ArrayOne: reason,
      });
    });

    it('is checked for an object type, which keeps its null', () => {
      const skips = skipsOf(schemas, 'zod');
      for (const key of ['One', 'ObjectOne', 'ObjectAll', 'ObjectProp']) {
        expect(skips).not.toHaveProperty(key);
      }
    });

    it('is checked for Valibot', () => {
      expect(skipsOf(schemas, 'valibot')).not.toHaveProperty('Prop');
    });
  });

  describe('a required property without a type', () => {
    const reason =
      'a required property without a type is optional in the Zod 3 output';
    const required = (property: OpenApiSchemaObject | true) =>
      ({
        type: 'object',
        required: ['a'],
        properties: { a: property },
      }) as OpenApiSchemaObject;
    const schemas: Record<string, OpenApiSchemaObject> = {
      Empty: required({}),
      Always: required(true),
      Described: required({ description: 'any' }),
      Excluded: required({ not: { type: 'string' } }),
      Union: required({ oneOf: [{}, { type: 'string' }] }),
      Either: required({ anyOf: [{ type: 'string' }, {}] }),
      Merged: required({ allOf: [{}] }),
      ViaRef: required({ oneOf: [ref('Free'), { type: 'string' }] }),
      Free: {},
      Typed: required({ type: 'string' }),
      Mixed: required({ allOf: [{}, { type: 'string' }] }),
      Optional: { type: 'object', properties: { a: {} } },
    };

    it('is skipped for Zod 3, which makes the key optional', () => {
      const skips = skipsOf(schemas, 'zod', undefined, {}, { isZodV4: false });
      expect(skips).toEqual({
        Empty: reason,
        Always: reason,
        Described: reason,
        Excluded: reason,
        Union: reason,
        Either: reason,
        Merged: reason,
        ViaRef: reason,
        Free: 'a schema without a type is validated as unknown, which the model types as {}',
      });
    });

    it('is skipped for Zod 3 when an allOf member declares or requires the key', () => {
      const split: Record<string, OpenApiSchemaObject> = {
        Declares: { allOf: [{ properties: { a: {} } }, { required: ['a'] }] },
        Requires: { required: ['a'], allOf: [{ properties: { a: {} } }] },
        Typed: {
          type: 'object',
          required: ['a'],
          allOf: [{ type: 'object', properties: { a: {} } }],
        },
        ViaRef: { allOf: [ref('Has'), { required: ['a'] }] },
        Has: { type: 'object', properties: { a: {} } },
        Known: {
          allOf: [
            { properties: { a: { type: 'string' } } },
            { required: ['a'] },
          ],
        },
        Unrequired: {
          allOf: [{ properties: { a: {} } }, { properties: { b: {} } }],
        },
      };
      const skips = skipsOf(split, 'zod', undefined, {}, { isZodV4: false });
      expect(Object.keys(skips).toSorted()).toEqual(
        ['Declares', 'Requires', 'Typed', 'ViaRef'].toSorted(),
      );
      expect(skips.Declares).toBe(reason);
      expect(
        skipsOf(split, 'zod', undefined, {}, { isZodV4: true }),
      ).not.toHaveProperty('Declares');
    });

    it('reads the property from the object itself before its allOf members', () => {
      const split: Record<string, OpenApiSchemaObject> = {
        OwnUnknown: {
          type: 'object',
          required: ['a'],
          properties: { a: {} },
          allOf: [{ type: 'object', properties: { a: { type: 'string' } } }],
        },
        OwnTyped: {
          type: 'object',
          required: ['a'],
          properties: { a: { type: 'string' } },
          allOf: [{ type: 'object', properties: { a: {} } }],
        },
        LaterMember: {
          allOf: [
            { properties: { a: { type: 'string' } } },
            { properties: { a: {} } },
            { required: ['a'] },
          ],
        },
        EarlierMember: {
          allOf: [
            { properties: { a: {} } },
            { properties: { a: { type: 'string' } } },
            { required: ['a'] },
          ],
        },
      };
      expect(
        Object.keys(
          skipsOf(split, 'zod', undefined, {}, { isZodV4: false }),
        ).toSorted(),
      ).toEqual(['LaterMember', 'OwnUnknown']);
    });

    it('walks an allOf ancestor shared by many references once', () => {
      const depth = 60;
      const layered: Record<string, OpenApiSchemaObject> = {
        Base: { type: 'object', required: ['id'], properties: { id: {} } },
      };
      for (let level = 0; level < depth; level++) {
        const below =
          level === 0 ? ['Base'] : [`L${level - 1}A`, `L${level - 1}B`];
        for (const side of ['A', 'B']) {
          layered[`L${level}${side}`] = {
            allOf: below.map((key) => ref(key)),
          };
        }
      }
      const skips = skipsOf(layered, 'zod', undefined, {}, { isZodV4: false });
      expect(skips[`L${depth - 1}A`]).toBe(reason);
    });

    it('is skipped for Zod 3 when the property references true or is a closed shape', () => {
      const shapes: Record<string, OpenApiSchemaObject> = {
        Free: true as unknown as OpenApiSchemaObject,
        ViaTrue: required(ref('Free')),
        ViaAlias: required(ref('FreeAlias')),
        FreeAlias: ref('Free'),
        Closed: required({ additionalProperties: false }),
        NoProperties: required({ properties: {} }),
        Open: required({ additionalProperties: true }),
        Record: required({ additionalProperties: { type: 'string' } }),
        Loop: required(ref('LoopA')),
        LoopA: ref('LoopB'),
        LoopB: ref('LoopA'),
      };
      expect(skipsOf(shapes, 'zod', undefined, {}, { isZodV4: false })).toEqual(
        {
          ViaTrue: reason,
          ViaAlias: reason,
          Closed: reason,
          NoProperties: reason,
        },
      );
    });

    it('reuses the answer for an acyclic reference shared by many branches', () => {
      const depth = 30;
      const layered: Record<string, OpenApiSchemaObject> = {
        Deep: required(ref(`L${depth - 1}A`)),
      };
      for (let level = 0; level < depth; level++) {
        for (const side of ['A', 'B']) {
          layered[`L${level}${side}`] =
            level === 0
              ? { type: 'string' }
              : {
                  anyOf: [ref(`L${level - 1}A`), ref(`L${level - 1}B`)],
                };
        }
      }
      expect(
        skipsOf(layered, 'zod', undefined, {}, { isZodV4: false }),
      ).toEqual({});
    });

    it('is checked for Zod 4, which keeps the key required', () => {
      const skips = skipsOf(schemas, 'zod', undefined, {}, { isZodV4: true });
      expect(skips).toEqual({
        Free: 'a schema without a type is validated as unknown, which the model types as {}',
        ViaRef: 'it references Free, which is skipped',
      });
    });

    it('is checked for Zod by default, which means Zod 4', () => {
      expect(skipsOf(schemas, 'zod')).toEqual(
        skipsOf(schemas, 'zod', undefined, {}, { isZodV4: true }),
      );
    });

    it('is not a Valibot concern', () => {
      expect(skipsOf({ Empty: schemas.Empty }, 'valibot')).toEqual({});
    });
  });

  describe('a const next to a string format', () => {
    const reason =
      'a const next to a string format is validated as the format, not as the literal';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Prop: {
        type: 'object',
        required: ['mail'],
        properties: {
          mail: { type: 'string', format: 'email', const: 'a@b.co' },
        },
      },
      Root: {
        type: 'string',
        format: 'uuid',
        const: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      },
      Plain: { type: 'string', const: 'a' },
      Enum: { type: 'string', format: 'email', enum: ['a@b.co'] },
      Number: { type: 'integer', format: 'int32', const: 1 },
    };

    it('is skipped for Zod, in a property and a component', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({ Prop: reason, Root: reason });
    });

    it('keeps the check of a format that Zod does not map, which is a literal', () => {
      const unmapped: Record<string, OpenApiSchemaObject> = {
        Status: { type: 'string', format: 'status-code', const: 'active' },
        Holder: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', format: 'status-code', const: 'active' },
          },
        },
        Address: { type: 'string', format: 'ipv4', const: '10.0.0.1' },
      };
      for (const isZodV4 of [true, false]) {
        expect(skipsOf(unmapped, 'zod', undefined, {}, { isZodV4 })).toEqual(
          {},
        );
      }
    });

    it('is checked for Valibot', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({});
    });

    it('is skipped for a const that Zod validates as a file', () => {
      const binary: Record<string, OpenApiSchemaObject> = {
        Octet: {
          type: 'object',
          required: ['file'],
          properties: {
            file: {
              type: 'string',
              const: 'a',
              contentMediaType: 'application/octet-stream',
            },
          },
        },
        Format: { type: 'string', format: 'binary', const: 'a' },
        Encoded: {
          type: 'string',
          const: 'a',
          contentMediaType: 'application/octet-stream',
          contentEncoding: 'base64',
        },
        Text: { type: 'string', const: 'a', contentMediaType: 'text/plain' },
        Plain: { type: 'string', const: 'a' },
      };
      for (const isZodV4 of [true, false]) {
        expect(skipsOf(binary, 'zod', undefined, {}, { isZodV4 })).toEqual({
          Octet: reason,
          Format: reason,
        });
      }
    });
  });

  describe('items that are false', () => {
    const reason =
      'items of false is typed unknown[] by the model and never[] by the schema';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Root: { type: 'array', items: false },
      Prop: {
        type: 'object',
        properties: { list: { type: 'array', items: false } },
      },
      Tuple: { type: 'array', prefixItems: [{ type: 'string' }], items: false },
    };

    it('is skipped for Zod, without prefixItems', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({ Root: reason, Prop: reason });
    });
  });

  describe('a type next to a composition validated as unknown', () => {
    const reason =
      'a type next to a composition that is validated as unknown is kept by the model';
    const property = (schema: OpenApiSchemaObject | true) =>
      ({
        type: 'object',
        required: ['a'],
        properties: { a: schema },
      }) as OpenApiSchemaObject;
    const schemas: Record<string, OpenApiSchemaObject> = {
      AllOfTrue: property({ type: 'boolean', allOf: [true] }),
      OptionalAllOfTrue: {
        type: 'object',
        properties: { a: { type: 'boolean', allOf: [true] } },
      },
      Root: { type: 'number', allOf: [true] },
      OneOfAny: property({ type: 'boolean', oneOf: [{}] }),
      AnyOfMixed: property({
        type: 'boolean',
        anyOf: [{}, { type: 'string' }],
      }),
      ArrayAllOfTrue: property({ type: 'array', allOf: [true] }),
      // A member without a type takes the scalar type of its parent.
      AllOfEmpty: property({ type: 'boolean', allOf: [{}] }),
      AllOfRef: property({ type: 'boolean', allOf: [ref('Free')] }),
      Free: { type: 'object', properties: {} },
      AllOfMixed: property({
        type: 'string',
        allOf: [true, { type: 'string' }],
      }),
      OneOfTyped: property({ type: 'boolean', oneOf: [{ type: 'boolean' }] }),
      ObjectAllOfTrue: property({ type: 'object', allOf: [true] }),
    };

    it('is skipped for Zod, where the schema loses the type', () => {
      expect(
        skipsOf(schemas, 'zod', undefined, {}, { isZodV4: true }),
      ).toMatchObject({
        AllOfTrue: reason,
        OptionalAllOfTrue: reason,
        Root: reason,
        OneOfAny: reason,
        AnyOfMixed: reason,
        ArrayAllOfTrue: reason,
      });
      expect(
        skipsOf(schemas, 'zod', undefined, {}, { isZodV4: false }),
      ).toMatchObject({
        AllOfTrue: reason,
        OptionalAllOfTrue: reason,
        Root: reason,
        ArrayAllOfTrue: reason,
      });
    });

    it('is checked when the schema keeps the type', () => {
      const skips = skipsOf(schemas, 'zod', undefined, {}, { isZodV4: true });
      for (const key of [
        'AllOfEmpty',
        'AllOfRef',
        'AllOfMixed',
        'OneOfTyped',
        'ObjectAllOfTrue',
      ]) {
        expect(skips).not.toHaveProperty(key);
      }
    });

    it('is checked for Valibot', () => {
      expect(skipsOf(schemas, 'valibot')).not.toHaveProperty('AllOfTrue');
    });
  });

  describe('unevaluatedProperties', () => {
    const reason =
      'unevaluatedProperties of a schema is typed by the model and not by the schema';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Alone: { type: 'object', unevaluatedProperties: { type: 'string' } },
      Beside: {
        type: 'object',
        properties: { a: { type: 'string' } },
        unevaluatedProperties: { type: 'string' },
      },
      Closed: {
        type: 'object',
        properties: { a: { type: 'string' } },
        unevaluatedProperties: false,
      },
      // The model reads `additionalProperties` first, as the schema does.
      Additional: {
        type: 'object',
        additionalProperties: { type: 'string' },
        unevaluatedProperties: { type: 'number' },
      },
      AdditionalOpen: {
        type: 'object',
        additionalProperties: true,
        unevaluatedProperties: { type: 'number' },
      },
      AdditionalClosed: {
        type: 'object',
        additionalProperties: false,
        unevaluatedProperties: { type: 'number' },
      },
    };

    it('is skipped for Zod without properties and additionalProperties', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({ Alone: reason });
    });
  });

  describe('a widened multipart part', () => {
    const reason =
      'the media type of a multipart part widens the model to a file, which the schema does not';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Upload: {
        type: 'object',
        properties: { report: { type: 'string' }, note: { type: 'string' } },
      },
      Untouched: {
        type: 'object',
        properties: { report: { type: 'string' } },
      },
      Wrapper: { type: 'object', properties: { upload: ref('Upload') } },
      Image: {
        type: 'object',
        properties: { img: { type: 'string', contentMediaType: 'image/png' } },
      },
      Json: {
        type: 'object',
        properties: {
          doc: { type: 'string', contentMediaType: 'application/json' },
        },
      },
      Files: {
        type: 'object',
        properties: { files: { type: 'array', items: { type: 'string' } } },
      },
      Base: { type: 'object', properties: { id: { type: 'string' } } },
      Composed: {
        allOf: [
          ref('Base'),
          { type: 'object', properties: { report: { type: 'string' } } },
        ],
      },
      Choice: {
        type: 'object',
        properties: { v: { anyOf: [{ type: 'string' }, { type: 'integer' }] } },
      },
      Nullable: {
        type: 'object',
        properties: { v: { type: ['string', 'null'] } },
      },
      Binary: {
        type: 'object',
        properties: {
          f: { type: 'string', format: 'binary' },
          g: { type: 'string', contentMediaType: 'application/octet-stream' },
        },
      },
      Encoded: {
        type: 'object',
        properties: {
          f: {
            type: 'string',
            contentMediaType: 'image/png',
            contentEncoding: 'base64',
          },
        },
      },
      Nested: {
        type: 'object',
        properties: {
          o: {
            type: 'object',
            properties: {
              q: { type: 'string', contentMediaType: 'image/png' },
            },
          },
        },
      },
      Named: { type: 'string' },
      Referenced: { type: 'object', properties: { r: ref('Named') } },
    };
    const multipart = (
      encodings: Record<string, Record<string, { contentType?: string }>>,
    ): OpenApiPathsObject =>
      Object.fromEntries(
        Object.entries(encodings).map(([key, encoding]) => [
          `/${key}`,
          {
            post: {
              requestBody: {
                content: {
                  'multipart/form-data': { schema: ref(key), encoding },
                },
              },
              responses: {},
            },
          },
        ]),
      );
    const csv = { contentType: 'text/csv' };

    it('is skipped for Zod, for the part with the contentType and what references it', () => {
      expect(
        skipsOf(schemas, 'zod', undefined, {
          paths: multipart({ Upload: { report: csv } }),
        }),
      ).toEqual({
        Upload: reason,
        Wrapper: 'it references Upload, which is skipped',
      });
    });

    it('is skipped for a part the model widens through its media type or its shape', () => {
      const skips = skipsOf(schemas, 'zod', undefined, {
        paths: multipart({
          Image: {},
          Json: {},
          Files: { files: { contentType: 'image/png' } },
          Composed: { report: csv },
          Choice: { v: csv },
          Nullable: { v: csv },
        }),
      });
      expect(skips).toEqual({
        Image: reason,
        Json: reason,
        Files: reason,
        Composed: reason,
        Choice: reason,
        Nullable: reason,
      });
    });

    it('leaves a string constant, which the model keeps over the file type', () => {
      const constants: Record<string, OpenApiSchemaObject> = {
        Fixed: {
          type: 'object',
          properties: {
            report: { type: 'string', const: 'csv' },
            note: { type: 'string' },
          },
        },
        Wrapper: { type: 'object', properties: { fixed: ref('Fixed') } },
        Plain: { type: 'object', properties: { report: { type: 'string' } } },
      };
      expect(
        skipsOf(constants, 'zod', undefined, {
          paths: multipart({ Fixed: { report: csv }, Plain: { report: csv } }),
        }),
      ).toEqual({ Plain: reason });
    });

    it('leaves the rest items of a tuple, which the model reads without the part', () => {
      expect(
        skipsOf(
          {
            Tuple: {
              type: 'object',
              properties: {
                row: {
                  type: 'array',
                  prefixItems: [{ type: 'integer' }],
                  items: { type: 'string' },
                },
              },
            },
          },
          'zod',
          undefined,
          { paths: multipart({ Tuple: { row: csv } }) },
        ),
      ).toEqual({});
    });

    it('leaves what the model keeps as it is', () => {
      expect(
        skipsOf(schemas, 'zod', undefined, {
          paths: multipart({
            Upload: {},
            Binary: { f: csv, g: {} },
            Encoded: { f: csv },
            Nested: { o: csv },
            Referenced: { r: csv },
            Untouched: { missing: csv },
          }),
        }),
      ).toEqual({});
    });

    it('is not a Valibot concern', () => {
      expect(
        skipsOf({ Image: schemas.Image }, 'valibot', undefined, {
          paths: multipart({ Image: {} }),
        }),
      ).toEqual({});
    });
  });

  describe('a not of an empty schema', () => {
    const reason =
      'a not of an empty schema is validated as never, which the model types as unknown';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Prop: { type: 'object', properties: { a: { not: {} } } },
      Items: { type: 'array', items: { not: {} } },
      Record: { type: 'object', additionalProperties: { not: {} } },
      Typed: { type: 'object', properties: { a: { not: { type: 'string' } } } },
    };

    it('is skipped for Zod, which validates it as never', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({
        Prop: reason,
        Items: reason,
        Record: reason,
      });
    });
  });

  describe('an enum without a primitive member, in the Zod 3 output', () => {
    const reason =
      'in the Zod 3 output an enum without a primitive member is validated as never, which the model types as unknown';
    const schemas: Record<string, OpenApiSchemaObject> = {
      Objects: { type: 'object', properties: { kind: { enum: [{ a: 1 }] } } },
      Empty: { type: 'object', properties: { kind: { enum: [] } } },
      Plain: { type: 'object', properties: { kind: { enum: ['a', 'b'] } } },
    };

    it('is skipped for Zod 3', () => {
      expect(
        skipsOf(schemas, 'zod', undefined, {}, { isZodV4: false }),
      ).toEqual({ Objects: reason, Empty: reason });
    });

    it('is checked for Zod 4', () => {
      expect(skipsOf(schemas, 'zod')).toEqual({});
    });
  });
});
