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
            'true': '#/components/schemas/SuccessResult',
            'false': '#/components/schemas/ErrorResult',
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
});
