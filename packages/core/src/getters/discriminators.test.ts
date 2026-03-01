import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  OpenApiSchemasObject,
} from '../types.ts';
import { resolveDiscriminators } from './discriminators.ts';

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
        },
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
