import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  OpenApiSchemasObject,
} from '../types';
import { resolveDiscriminators } from './discriminators';

const context: ContextSpec = {
  target: 'spec',
  workspace: '',
  spec: {} as ContextSpec['spec'],
  output: {
    override: {},
  },
} as ContextSpec;

describe('resolveDiscriminators getter', () => {
  it('adds discriminator property when missing in subtype schema', () => {
    const schemas: OpenApiSchemasObject = {
      Animal: {
        type: 'object',
        discriminator: {
          propertyName: 'type',
          mapping: {
            CAT: '#/components/schemas/Cat',
          },
        },
      },
      Cat: {
        type: 'object',
        required: ['livesLeft'],
        properties: {
          livesLeft: {
            type: 'integer',
          },
        },
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const catSchema = result.Cat as NonNullable<OpenApiSchemasObject[string]>;
    // Bridge assertion: properties is `any` due to AnyOtherAttribute
    const catProps = catSchema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;

    expect(catProps?.type).toMatchObject({
      type: 'string',
      enum: ['CAT'],
    });
    expect(catSchema.required).toEqual(
      expect.arrayContaining(['livesLeft', 'type']),
    );
  });

  it('merges discriminator enum with existing property', () => {
    const schemas: OpenApiSchemasObject = {
      Animal: {
        type: 'object',
        discriminator: {
          propertyName: 'type',
          mapping: {
            CAT: '#/components/schemas/Cat',
          },
        },
      },
      Cat: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['CAT', 'DOG'],
            description: 'animal type',
          },
        },
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const catSchema = result.Cat as NonNullable<OpenApiSchemasObject[string]>;
    // Bridge assertion: properties is `any` due to AnyOtherAttribute
    const catProps = catSchema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    const typeProp = catProps?.type;
    const enumValues =
      typeProp && 'enum' in typeProp
        ? ((typeProp as OpenApiSchemaObject).enum as string[] | undefined)
        : undefined;

    expect(enumValues).toEqual(expect.arrayContaining(['CAT', 'DOG']));
    if (typeProp && !('$ref' in typeProp)) {
      expect((typeProp as OpenApiSchemaObject).description).toBe('animal type');
    }
  });

  it('overrides discriminator property when it is a $ref', () => {
    const schemas: OpenApiSchemasObject = {
      Animal: {
        type: 'object',
        discriminator: {
          propertyName: 'type',
          mapping: {
            CAT: '#/components/schemas/Cat',
          },
        },
      },
      Type: {
        type: 'string',
        enum: ['CAT', 'DOG'],
      },
      Cat: {
        type: 'object',
        properties: {
          type: {
            $ref: '#/components/schemas/Type',
          },
        },
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const catSchema = result.Cat as NonNullable<OpenApiSchemasObject[string]>;
    // Bridge assertion: properties is `any` due to AnyOtherAttribute
    const catProps = catSchema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    const typeProperty = catProps?.type;

    expect(typeProperty).toBeDefined();
    if (typeProperty && !('$ref' in typeProperty)) {
      expect((typeProperty as OpenApiSchemaObject).enum).toEqual(['CAT']);
    }
  });

  it('strips const from discriminator property to prevent DogValue object bug (#3139)', () => {
    const schemas: OpenApiSchemasObject = {
      Pet: {
        oneOf: [
          { $ref: '#/components/schemas/Cat' },
          { $ref: '#/components/schemas/Dog' },
        ],
        discriminator: {
          propertyName: 'type',
          mapping: {
            cat: '#/components/schemas/Cat',
            dog: '#/components/schemas/Dog',
          },
        },
      },
      Cat: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'name'],
        properties: {
          type: { const: 'cat' },
          name: { type: 'string' },
        },
      },
      Dog: {
        type: 'object',
        additionalProperties: false,
        required: ['type'],
        properties: {
          type: { const: 'dog', description: 'animal type' },
        },
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const dogSchema = result.Dog as NonNullable<OpenApiSchemasObject[string]>;
    const dogProps = dogSchema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    const typeProp = dogProps?.type as OpenApiSchemaObject | undefined;

    // The merged property must NOT retain `const` — otherwise interface.ts
    // generates `const DogValue = { type: DogType }` where DogType is the
    // runtime enum object instead of the string literal.
    expect(typeProp).toBeDefined();
    expect(typeProp).not.toHaveProperty('const');
    expect(typeProp?.enum).toEqual(['dog']);
    expect(typeProp?.type).toBe('string');
    expect((typeProp as Record<string, unknown>).description).toBe(
      'animal type',
    );
  });

  it('preserves boolean type for boolean discriminator', () => {
    const schemas: OpenApiSchemasObject = {
      ApiResult: {
        type: 'object',
        discriminator: {
          propertyName: 'success',
          mapping: {
            true: '#/components/schemas/SuccessResult',
            false: '#/components/schemas/ErrorResult',
          },
        },
      },
      SuccessResult: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
          },
        },
      },
      ErrorResult: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
          },
        },
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const successSchema = result.SuccessResult as NonNullable<
      OpenApiSchemasObject[string]
    >;
    const errorSchema = result.ErrorResult as NonNullable<
      OpenApiSchemasObject[string]
    >;
    const successProps = successSchema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    const errorProps = errorSchema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;

    expect(successProps?.success).toMatchObject({
      type: 'boolean',
      enum: [true],
    });
    expect(errorProps?.success).toMatchObject({
      type: 'boolean',
      enum: [false],
    });
  });

  it('preserves integer type for number discriminator', () => {
    const schemas: OpenApiSchemasObject = {
      StatusResult: {
        type: 'object',
        discriminator: {
          propertyName: 'code',
          mapping: {
            '1': '#/components/schemas/ActiveStatus',
            '0': '#/components/schemas/InactiveStatus',
          },
        },
      },
      ActiveStatus: {
        type: 'object',
        properties: {
          code: {
            type: 'integer',
          },
        },
      },
      InactiveStatus: {
        type: 'object',
        properties: {
          code: {
            type: 'integer',
          },
        },
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const activeSchema = result.ActiveStatus as NonNullable<
      OpenApiSchemasObject[string]
    >;
    const inactiveSchema = result.InactiveStatus as NonNullable<
      OpenApiSchemasObject[string]
    >;
    const activeProps = activeSchema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    const inactiveProps = inactiveSchema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;

    expect(activeProps?.code).toMatchObject({
      type: 'integer',
      enum: [1],
    });
    expect(inactiveProps?.code).toMatchObject({
      type: 'integer',
      enum: [0],
    });
  });

  it('rewrites variant allOf $ref to parent when parent has top-level oneOf (#3432)', () => {
    // When a discriminator parent has top-level `oneOf` listing variants that
    // inherit via `allOf: [$ref: parent, ...]`, the variant's $ref-back-to-parent
    // creates a circular type alias in the generated TS. We break the cycle at
    // the schema level: drop the parent $ref (or inline its non-discriminator
    // properties) so the variant no longer depends on the parent's alias.
    const schemas: OpenApiSchemasObject = {
      DiscriminatorTest: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: ['item1', 'item2'],
          },
        },
        discriminator: {
          propertyName: 'type',
          mapping: {
            item1: '#/components/schemas/Item1',
            item2: '#/components/schemas/Item2',
          },
        },
        oneOf: [
          { $ref: '#/components/schemas/Item1' },
          { $ref: '#/components/schemas/Item2' },
        ],
      },
      Item1: {
        allOf: [
          { $ref: '#/components/schemas/DiscriminatorTest' },
          {
            type: 'object',
            properties: {
              property1: { type: 'string' },
            },
          },
        ],
      },
      Item2: {
        allOf: [
          { $ref: '#/components/schemas/DiscriminatorTest' },
          {
            type: 'object',
            properties: {
              property2: { type: 'string' },
            },
          },
        ],
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const item1 = result.Item1 as NonNullable<OpenApiSchemasObject[string]>;
    const item2 = result.Item2 as NonNullable<OpenApiSchemasObject[string]>;

    // Parent had only the discriminator key, so inheritable props are empty —
    // the $ref-to-parent entry should be dropped, leaving only the inline
    // object that contributed `property1` / `property2`.
    const item1AllOf = item1.allOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    expect(item1AllOf).toHaveLength(1);
    expect(item1AllOf?.[0]).not.toHaveProperty('$ref');
    const item2AllOf = item2.allOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    expect(item2AllOf).toHaveLength(1);
    expect(item2AllOf?.[0]).not.toHaveProperty('$ref');

    // The existing discriminator-key injection still runs, so each variant's
    // own `properties.type` is constrained to its mapping value.
    const item1Props = item1.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    expect(item1Props?.type).toMatchObject({
      type: 'string',
      enum: ['item1'],
    });
  });

  it('inlines parent non-discriminator properties into variant allOf (#3432)', () => {
    // When the parent has additional properties beyond the discriminator key,
    // those properties must survive on each variant. Replace the $ref with an
    // inline object carrying parent's properties minus the discriminator key.
    const schemas: OpenApiSchemasObject = {
      Parent: {
        type: 'object',
        required: ['kind', 'commonField'],
        properties: {
          kind: { type: 'string', enum: ['a', 'b'] },
          commonField: { type: 'string' },
        },
        discriminator: {
          propertyName: 'kind',
          mapping: {
            a: '#/components/schemas/VariantA',
            b: '#/components/schemas/VariantB',
          },
        },
        oneOf: [
          { $ref: '#/components/schemas/VariantA' },
          { $ref: '#/components/schemas/VariantB' },
        ],
      },
      VariantA: {
        allOf: [
          { $ref: '#/components/schemas/Parent' },
          { type: 'object', properties: { extraA: { type: 'number' } } },
        ],
      },
      VariantB: {
        allOf: [
          { $ref: '#/components/schemas/Parent' },
          { type: 'object', properties: { extraB: { type: 'boolean' } } },
        ],
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const variantA = result.VariantA as NonNullable<
      OpenApiSchemasObject[string]
    >;

    const allOf = variantA.allOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    expect(allOf).toHaveLength(2);
    expect(allOf?.[0]).not.toHaveProperty('$ref');
    const inlined = allOf?.[0] as OpenApiSchemaObject | undefined;
    const inlinedProps = inlined?.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    expect(inlinedProps).toHaveProperty('commonField');
    // The discriminator key must not appear in the inlined props.
    expect(inlinedProps).not.toHaveProperty('kind');
    expect(inlined?.required).toEqual(['commonField']);
  });

  it('preserves parent object-level constraints when inlining (#3432)', () => {
    // Replacing the parent $ref with `{type:'object', properties, required}`
    // alone would silently drop other parent constraints like
    // `additionalProperties`, `minProperties`, `description`, etc. The inline
    // schema must carry those forward so variant validation semantics match
    // the dereferenced behavior we replaced.
    const schemas: OpenApiSchemasObject = {
      Parent: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        description: 'parent shape',
        required: ['kind', 'commonField'],
        properties: {
          kind: { type: 'string', enum: ['a'] },
          commonField: { type: 'string' },
        },
        discriminator: {
          propertyName: 'kind',
          mapping: {
            a: '#/components/schemas/VariantA',
          },
        },
        oneOf: [{ $ref: '#/components/schemas/VariantA' }],
      },
      VariantA: {
        allOf: [
          { $ref: '#/components/schemas/Parent' },
          { type: 'object', properties: { extraA: { type: 'number' } } },
        ],
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const variantA = result.VariantA as NonNullable<
      OpenApiSchemasObject[string]
    >;
    const allOf = variantA.allOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    const inlined = allOf?.[0] as Record<string, unknown> | undefined;

    expect(inlined?.additionalProperties).toBe(false);
    expect(inlined?.minProperties).toBe(1);
    expect(inlined?.description).toBe('parent shape');
    // Composition keys that would re-create the cycle must NOT be copied.
    expect(inlined).not.toHaveProperty('oneOf');
    expect(inlined).not.toHaveProperty('discriminator');
    expect(inlined).not.toHaveProperty('allOf');
  });

  it('gives each variant its own properties object (#3432)', () => {
    // The inlined parent properties must be cloned per variant — sharing the
    // same Record across siblings would couple downstream in-place mutations
    // (e.g. one variant's property tweak leaking into the other).
    const schemas: OpenApiSchemasObject = {
      Parent: {
        type: 'object',
        required: ['kind', 'shared'],
        properties: {
          kind: { type: 'string', enum: ['a', 'b'] },
          shared: { type: 'string' },
        },
        discriminator: {
          propertyName: 'kind',
          mapping: {
            a: '#/components/schemas/VariantA',
            b: '#/components/schemas/VariantB',
          },
        },
        oneOf: [
          { $ref: '#/components/schemas/VariantA' },
          { $ref: '#/components/schemas/VariantB' },
        ],
      },
      VariantA: {
        allOf: [
          { $ref: '#/components/schemas/Parent' },
          { type: 'object', properties: { extraA: { type: 'number' } } },
        ],
      },
      VariantB: {
        allOf: [
          { $ref: '#/components/schemas/Parent' },
          { type: 'object', properties: { extraB: { type: 'boolean' } } },
        ],
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const aAllOf = (
      result.VariantA as NonNullable<OpenApiSchemasObject[string]>
    ).allOf as (OpenApiSchemaObject | OpenApiReferenceObject)[] | undefined;
    const bAllOf = (
      result.VariantB as NonNullable<OpenApiSchemasObject[string]>
    ).allOf as (OpenApiSchemaObject | OpenApiReferenceObject)[] | undefined;
    const aInlined = aAllOf?.[0] as OpenApiSchemaObject | undefined;
    const bInlined = bAllOf?.[0] as OpenApiSchemaObject | undefined;

    expect(aInlined?.properties).not.toBe(bInlined?.properties);
    expect(aInlined).not.toBe(bInlined);
  });

  it('leaves allOf untouched when parent has no top-level oneOf (#3432 guard)', () => {
    // Sanity check: the existing recursive-discriminator-allof shape (parent
    // is a plain interface, variants inherit via allOf) must keep emitting an
    // unmodified `$ref` so the interface-based emit path remains intact.
    const schemas: OpenApiSchemasObject = {
      Base: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: { type: 'string' },
        },
        discriminator: {
          propertyName: 'kind',
          mapping: {
            a: '#/components/schemas/Derived',
          },
        },
      },
      Derived: {
        allOf: [
          { $ref: '#/components/schemas/Base' },
          { type: 'object', properties: { extra: { type: 'string' } } },
        ],
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const derived = result.Derived as NonNullable<OpenApiSchemasObject[string]>;
    const allOf = derived.allOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    expect(allOf).toHaveLength(2);
    expect(allOf?.[0]).toHaveProperty('$ref', '#/components/schemas/Base');
  });

  it('rewrites variant allOf $ref to parent when parent has oneOf but no discriminator mapping', () => {
    const schemas: OpenApiSchemasObject = {
      Animal: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string' },
        },
        discriminator: { propertyName: 'type' },
        oneOf: [
          { $ref: '#/components/schemas/Dog' },
          { $ref: '#/components/schemas/Cat' },
        ],
      },
      Dog: {
        allOf: [
          { $ref: '#/components/schemas/Animal' },
          {
            type: 'object',
            properties: { bark: { type: 'string' } },
          },
        ],
      },
      Cat: {
        allOf: [
          { $ref: '#/components/schemas/Animal' },
          {
            type: 'object',
            properties: { meow: { type: 'string' } },
          },
        ],
      },
    };
    const result = resolveDiscriminators(structuredClone(schemas), context);
    const dog = result.Dog as NonNullable<OpenApiSchemasObject[string]>;
    const cat = result.Cat as NonNullable<OpenApiSchemasObject[string]>;

    const dogAllOf = dog.allOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    expect(dogAllOf).toHaveLength(1);
    expect(dogAllOf?.[0]).not.toHaveProperty('$ref');

    const catAllOf = cat.allOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    expect(catAllOf).toHaveLength(1);
    expect(catAllOf?.[0]).not.toHaveProperty('$ref');
  });

  it('rewrites variant allOf $ref to parent when parent has anyOf but no discriminator mapping', () => {
    const schemas: OpenApiSchemasObject = {
      Animal: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string' },
        },
        discriminator: { propertyName: 'type' },
        anyOf: [
          { $ref: '#/components/schemas/Dog' },
          { $ref: '#/components/schemas/Cat' },
        ],
      },
      Dog: {
        allOf: [
          { $ref: '#/components/schemas/Animal' },
          {
            type: 'object',
            properties: { bark: { type: 'string' } },
          },
        ],
      },
      Cat: {
        allOf: [
          { $ref: '#/components/schemas/Animal' },
          {
            type: 'object',
            properties: { meow: { type: 'string' } },
          },
        ],
      },
    };
    const result = resolveDiscriminators(structuredClone(schemas), context);
    const dog = result.Dog as NonNullable<OpenApiSchemasObject[string]>;
    const cat = result.Cat as NonNullable<OpenApiSchemasObject[string]>;

    const dogAllOf = dog.allOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    expect(dogAllOf).toHaveLength(1);
    expect(dogAllOf?.[0]).not.toHaveProperty('$ref');

    const catAllOf = cat.allOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    expect(catAllOf).toHaveLength(1);
    expect(catAllOf?.[0]).not.toHaveProperty('$ref');
  });

  it('hoists oneOf from discriminator when nested incorrectly', () => {
    const schemas: OpenApiSchemasObject = {
      Animal: {
        type: 'object',
        discriminator: {
          propertyName: 'type',
          mapping: {
            CAT: '#/components/schemas/Cat',
            DOG: '#/components/schemas/Dog',
          },
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
        } as unknown as NonNullable<
          OpenApiSchemasObject[string]
        >['discriminator'],
      },
      Cat: {
        type: 'object',
      },
      Dog: {
        type: 'object',
      },
    };

    const result = resolveDiscriminators(structuredClone(schemas), context);
    const animalSchema = result.Animal as NonNullable<
      OpenApiSchemasObject[string]
    >;

    expect(animalSchema.oneOf).toHaveLength(2);
  });

  it('skips mapping entries whose target schema is absent', () => {
    // A discriminator mapping may reference a schema that is absent from the
    // set (e.g. a subtype removed by tag filtering). The missing target must
    // be skipped rather than dereferenced.
    const schemas: OpenApiSchemasObject = {
      Pet: {
        type: 'object',
        discriminator: {
          propertyName: 'petType',
          mapping: {
            cat: '#/components/schemas/Cat',
            dog: '#/components/schemas/Dog', // Dog is absent below
          },
        },
      },
      Cat: {
        type: 'object',
        properties: { huntingSkill: { type: 'string' } },
      },
    };

    // Dereferencing the absent `Dog` target would throw, so reaching the
    // assertions below already proves it was skipped. The surviving subtype is
    // still augmented with its discriminant.
    const result = resolveDiscriminators(structuredClone(schemas), context);
    const catProps = (result.Cat as OpenApiSchemaObject).properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    expect(catProps?.petType).toMatchObject({
      type: 'string',
      enum: ['cat'],
    });
  });
});
