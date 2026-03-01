import { describe, expect, it } from 'vitest';

import type { ContextSpec, OpenApiSchemaObject } from '../types.ts';
import { combineSchemas } from './combine.ts';

const petSchema: OpenApiSchemaObject = {
  type: 'object',
  required: ['id', 'name', 'petType'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    petType: { type: 'string' },
  },
};

const context: ContextSpec = {
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
        Pet: petSchema,
        Base: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      },
    },
  },
} as ContextSpec;

describe('combineSchemas (allOf required handling)', () => {
  it('does not add Required<Pick> when required properties are defined on parent', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['name', 'sound'],
      properties: {
        name: { type: 'string' },
        sound: { type: 'string' },
      },
      allOf: [{ $ref: '#/components/schemas/Pet' }],
    };

    const result = combineSchemas({
      schema,
      name: 'Dog',
      separator: 'allOf',
      context,
      nullable: '',
    });

    expect(result.value).toContain('Pet &');
    expect(result.value).not.toContain('Required<Pick');
  });

  it('keeps Required<Pick> when parent requires properties defined only in subschemas', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['name'],
      allOf: [{ $ref: '#/components/schemas/Base' }],
    };

    const result = combineSchemas({
      schema,
      name: 'PetWrapper',
      separator: 'allOf',
      context,
      nullable: '',
    });

    expect(result.value).toContain('Required<Pick');
  });

  it('normalizes inline object in allOf to match parent object form', () => {
    const variantA: OpenApiSchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/Pet' },
        {
          type: 'object',
          required: ['name', 'sound'],
          properties: {
            name: { type: 'string' },
            sound: { type: 'string' },
          },
        },
      ],
    };

    const variantB: OpenApiSchemaObject = {
      type: 'object',
      required: ['name', 'sound'],
      properties: {
        name: { type: 'string' },
        sound: { type: 'string' },
      },
      allOf: [{ $ref: '#/components/schemas/Pet' }],
    };

    const resultA = combineSchemas({
      schema: variantA,
      name: 'DogA',
      separator: 'allOf',
      context,
      nullable: '',
    });

    const resultB = combineSchemas({
      schema: variantB,
      name: 'DogB',
      separator: 'allOf',
      context,
      nullable: '',
    });

    expect(resultA.value).toBe(resultB.value);
  });
});
