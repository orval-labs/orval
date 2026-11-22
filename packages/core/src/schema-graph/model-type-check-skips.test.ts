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
) => {
  const context = createTestContextSpec({
    spec: {
      ...document,
      components: { ...document.components, schemas },
    },
    override,
  });
  return Object.fromEntries(
    getModelTypeCheckSkips(context, { library, nameOf: (key) => key }),
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
      });
    });
  });

  describe('a default on an optional property', () => {
    const reason =
      'the default of an optional property makes it required in the schema output only';

    it.each(['valibot'] as const)('is skipped for %s', (library) => {
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
          'valibot',
        ),
      ).toEqual({});
    });

    it('is followed through a reference', () => {
      const schemas = {
        Size: { type: 'integer', default: 1 },
        Box: { type: 'object', properties: { size: ref('Size') } },
      } satisfies Record<string, OpenApiSchemaObject>;
      expect(skipsOf(schemas, 'valibot')).toEqual({ Box: reason });
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

  it.each(['valibot'] as const)(
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

  it.each(['valibot'] as const)(
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

    it.each(['valibot'] as const)(
      'skips the components that hold an array for %s',
      (library) => {
        expect(skipsOf(schemas, library, { useReadonlyArrays: true })).toEqual({
          Tags: reason,
          Pet: reason,
          Nullable: reason,
          Household: 'it references Tags, which is skipped',
        });
      },
    );

    it.each(['valibot'] as const)(
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

    it.each(['valibot'] as const)(
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

    it.each(['valibot'] as const)(
      'is skipped for %s when a key is optional',
      (library) => {
        expect(skipsOf(schemas, library)).toEqual({ Optional: reason });
      },
    );

    it.each(['valibot'] as const)(
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

    it.each(['valibot'] as const)(
      'is skipped with useBigInt for %s, with the components that use it',
      (library) => {
        expect(skipsOf(schemas, library, { useBigInt: true })).toEqual({
          Big: reason,
          Nullable: reason,
          Uses: 'it references Big, which is skipped',
        });
      },
    );

    it.each(['valibot'] as const)(
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

    it.each(['valibot'] as const)(
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
      Patterned: { patternProperties: { '^x-': { type: 'string' } } },
      Bare: { properties: {} },
      Merged: {
        allOf: [ref('Typed'), { additionalProperties: { type: 'string' } }],
      },
      Nested: {
        type: 'object',
        properties: { meta: { additionalProperties: { type: 'string' } } },
      },
      InList: {
        type: 'array',
        items: { patternProperties: { '^x-': { type: 'string' } } },
      },
      Uses: { type: 'object', properties: { value: ref('Dictionary') } },
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

    it('is skipped as a component, as a member and as a nested property', () => {
      expect(skipsOf(schemas, 'valibot')).toEqual({
        Dictionary: reason,
        Patterned: reason,
        Bare: reason,
        Merged: reason,
        Nested: reason,
        InList: reason,
        Uses: 'it references Dictionary, which is skipped',
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

    it.each(['valibot'] as const)('is skipped for %s', (library) => {
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

    it.each(['valibot'] as const)('is skipped for %s', (library) => {
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

    it('is followed to the constructs it holds', () => {
      const reason = 'prefixItems is validated as an array of unknown';
      expect(skipsOf(schemas, 'valibot', undefined, document)).toEqual({
        Pairs: reason,
        ViaResponse: reason,
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
  });
});
