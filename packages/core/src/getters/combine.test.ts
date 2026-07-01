import { describe, expect, it } from 'vitest';

import type { ContextSpec, OpenApiSchemaObject } from '../types';
import { combineSchemas } from './combine';

const petSchema: OpenApiSchemaObject = {
  type: 'object',
  required: ['id', 'name', 'petType'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    petType: { type: 'string' },
  },
};

const context = {
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
            baseProp: { type: 'string' },
          },
        },
        Status: {
          type: 'string',
          enum: ['new', 'in_progress'],
        },
        // A constraint-only overlay: carries `required` but no properties of its
        // own. Used to exercise the sparse-fieldset pattern from #3663 where the
        // required lives in a sibling that references another member's props.
        RequiredOverlay: {
          required: ['baseProp'],
        },
      },
    },
  },
} as unknown as ContextSpec;

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
      required: ['baseProp'],
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

  // OAS 3.1's `{type: 'null'}` variant inside an anyOf/oneOf is the
  // nullable-enum spelling used by code generators like FastAPI. The result
  // should be flagged as an enum so the caller can extract a named type,
  // matching the equivalent `{type: ['string','null'], enum: [...]}` form.
  // See issue #2710.
  describe('nullable enum composition (#2710)', () => {
    it('flags anyOf [enum, null] as a nullable enum', () => {
      const schema: OpenApiSchemaObject = {
        anyOf: [{ enum: ['new', 'in_progress'] }, { type: 'null' }],
      };

      const result = combineSchemas({
        schema,
        name: 'Status',
        separator: 'anyOf',
        context,
        nullable: '',
      });

      expect(result.isEnum).toBe(true);
      expect(result.value).toContain(`'new' | 'in_progress'`);
      expect(result.value).toContain('null');
    });

    it('flags oneOf [enum, null] as a nullable enum', () => {
      const schema: OpenApiSchemaObject = {
        oneOf: [{ enum: ['new', 'in_progress'] }, { type: 'null' }],
      };

      const result = combineSchemas({
        schema,
        name: 'Status',
        separator: 'oneOf',
        context,
        nullable: '',
      });

      expect(result.isEnum).toBe(true);
      expect(result.value).toContain(`'new' | 'in_progress'`);
      expect(result.value).toContain('null');
    });

    // Detection must not depend on the order of subschemas — `{type: 'null'}`
    // can appear before or after the enum.
    it('flags anyOf [null, enum] (null first) as a nullable enum', () => {
      const schema: OpenApiSchemaObject = {
        anyOf: [{ type: 'null' }, { enum: ['new', 'in_progress'] }],
      };

      const result = combineSchemas({
        schema,
        name: 'Status',
        separator: 'anyOf',
        context,
        nullable: '',
      });

      expect(result.isEnum).toBe(true);
    });

    // The pattern is type-agnostic: numeric enums combined with null should
    // also be recognized.
    it('flags anyOf [numeric enum, null] as a nullable enum', () => {
      const schema: OpenApiSchemaObject = {
        anyOf: [{ type: 'integer', enum: [1, 2, 3] }, { type: 'null' }],
      };

      const result = combineSchemas({
        schema,
        name: 'Code',
        separator: 'anyOf',
        context,
        nullable: '',
      });

      expect(result.isEnum).toBe(true);
      expect(result.value).toContain('1 | 2 | 3');
      expect(result.value).toContain('null');
    });

    // Pin behavior for the multi-enum + null variant. Each enum branch
    // contributes its values; the result is still a nullable enum union.
    it('flags multiple inline enums + null as a nullable enum', () => {
      const schema: OpenApiSchemaObject = {
        anyOf: [{ enum: ['a', 'b'] }, { enum: ['c', 'd'] }, { type: 'null' }],
      };

      const result = combineSchemas({
        schema,
        name: 'Status',
        separator: 'anyOf',
        context,
        nullable: '',
      });

      expect(result.isEnum).toBe(true);
      expect(result.value).toContain(`'a' | 'b'`);
      expect(result.value).toContain(`'c' | 'd'`);
      expect(result.value).toContain('null');
    });

    // Negative: a plain nullable string (no enum) must stay a generic union
    // and not be flagged as an enum. This is the case the existing
    // query-params.test.ts:169 test already pins at the integration level.
    it('does not flag anyOf [non-enum scalar, null] as a nullable enum', () => {
      const schema: OpenApiSchemaObject = {
        anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
      };

      const result = combineSchemas({
        schema,
        name: 'AffiliationId',
        separator: 'anyOf',
        context,
        nullable: '',
      });

      expect(result.isEnum).toBe(false);
    });

    // Negative: a `$ref` branch already resolves to an existing named enum
    // schema. Treating this composition as an inline-enum would route the
    // caller through `getEnum`, which emits a parallel const that nests the
    // original ref (e.g. `{Status: Status}`) instead of reusing it.
    it('does not flag anyOf [$ref enum, null] as a nullable enum', () => {
      const schema: OpenApiSchemaObject = {
        anyOf: [{ $ref: '#/components/schemas/Status' }, { type: 'null' }],
      };

      const result = combineSchemas({
        schema,
        name: 'Status',
        separator: 'anyOf',
        context,
        nullable: '',
      });

      expect(result.isEnum).toBe(false);
    });

    // Negative: `allOf` is an intersection, not a union. `allOf: [{enum}, {null}]`
    // is semantically empty (no value can satisfy both); regardless, it must
    // not be misclassified as a nullable enum union.
    it('does not flag allOf [enum, null] as a nullable enum', () => {
      const schema: OpenApiSchemaObject = {
        allOf: [{ enum: ['new', 'in_progress'] }, { type: 'null' }],
      };

      const result = combineSchemas({
        schema,
        name: 'Status',
        separator: 'allOf',
        context,
        nullable: '',
      });

      expect(result.isEnum).toBe(false);
    });

    // Negative: an enum combined with a non-null scalar is a genuine union,
    // not a nullable enum. Extracting it as a named enum would change the
    // semantics (the other branch's values would be lost).
    it('does not flag anyOf [enum, non-null scalar] as a nullable enum', () => {
      const schema: OpenApiSchemaObject = {
        anyOf: [{ enum: ['new', 'in_progress'] }, { type: 'string' }],
      };

      const result = combineSchemas({
        schema,
        name: 'Status',
        separator: 'anyOf',
        context,
        nullable: '',
      });

      expect(result.isEnum).toBe(false);
    });
  });

  it('promotes required field to Required<Pick> when field is defined on $ref parent but required in inline allOf sibling', () => {
    const schema: OpenApiSchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/Base' },
        {
          type: 'object',
          required: ['baseProp'],
          properties: {
            url: { type: 'string' },
          },
        },
      ],
    };

    const result = combineSchemas({
      schema,
      name: 'Child',
      separator: 'allOf',
      context,
      nullable: '',
    });

    // Assert the exact Pick argument so a duplicate-union regression
    // (e.g. `Required<Pick<..., 'baseProp' | 'baseProp'>>`) is caught.
    expect(result.value).toMatch(/Required<Pick<[^,]+, 'baseProp'>>/);
  });

  // #3663: the sparse-fieldset pattern splits a model into a base (all props
  // optional) and a constraint-only overlay that only lists `required`. When the
  // overlay is a `$ref`, its `required` lives inside the referenced schema and
  // must still be promoted onto the base's properties.
  it('promotes required from a $ref constraint-only overlay (#3663)', () => {
    const schema: OpenApiSchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/Base' },
        { $ref: '#/components/schemas/RequiredOverlay' },
      ],
    };

    const result = combineSchemas({
      schema,
      name: 'Foo',
      separator: 'allOf',
      context,
      nullable: '',
    });

    // Assert the exact Pick argument so a duplicate-union regression
    // (e.g. `Required<Pick<..., 'baseProp' | 'baseProp'>>`) is caught.
    expect(result.value).toMatch(/Required<Pick<[^,]+, 'baseProp'>>/);
  });

  // #3663: the same overlay written inline without `type: object` fails the
  // `isSchema` gate (no type/properties/composition), so its `required` was
  // dropped. It must be promoted just like the `$ref` and `type: object` forms.
  it('promotes required from an inline constraint-only overlay without type (#3663)', () => {
    const schema: OpenApiSchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/Base' },
        { required: ['baseProp'] },
      ],
    };

    const result = combineSchemas({
      schema,
      name: 'Foo',
      separator: 'allOf',
      context,
      nullable: '',
    });

    // Assert the exact Pick argument so a duplicate-union regression
    // (e.g. `Required<Pick<..., 'baseProp' | 'baseProp'>>`) is caught.
    expect(result.value).toMatch(/Required<Pick<[^,]+, 'baseProp'>>/);
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
