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

  it('keeps plain Required<Pick> for required keys nested in composed members', () => {
    const contextWithWrapper = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            Base: {
              type: 'object',
              properties: {
                baseProp: { type: 'string' },
              },
            },
            MidWrapper: {
              allOf: [{ $ref: '#/components/schemas/Base' }],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['baseProp'],
      allOf: [{ $ref: '#/components/schemas/MidWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'WrappedItem',
      separator: 'allOf',
      context: contextWithWrapper,
      nullable: '',
    });

    expect(result.value).toContain("Required<Pick<MidWrapper, 'baseProp'>>");
    expect(result.value).not.toContain('Extract<');
  });

  // #3750: a constraint-only allOf member can require properties declared on
  // the parent schema itself. Those properties are part of the emitted
  // intersection and must therefore use a plain Required<Pick>. With an index
  // signature, Extract<keyof T, K> collapses to never and loses requiredness.
  it('keeps plain Required<Pick> for required keys declared on parent properties (#3750)', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      additionalProperties: true,
      allOf: [
        {
          type: 'object',
          required: ['id', 'name'],
          additionalProperties: true,
        },
      ],
    };

    const result = combineSchemas({
      schema,
      name: 'ItemDetail',
      separator: 'allOf',
      context,
      nullable: '',
    });

    expect(result.value).toContain('Required<Pick<');
    expect(result.value).toContain(", 'id' | 'name'>>");
    expect(result.value).not.toContain('Extract<');
  });

  it('keeps plain Required<Pick> when an allOf object removes the nullable parent branch (#3750)', () => {
    const schema: OpenApiSchemaObject = {
      type: ['object', 'null'],
      properties: {
        id: { type: 'string' },
      },
      additionalProperties: true,
      allOf: [
        {
          type: 'object',
          required: ['id'],
          additionalProperties: true,
        },
      ],
    };

    const result = combineSchemas({
      schema,
      name: 'NullableItemDetail',
      separator: 'allOf',
      context,
      nullable: '',
    });

    expect(result.value).toContain(", 'id'>>");
    expect(result.value).not.toContain('Extract<');
  });

  it('keeps Extract guard when parent properties are not emitted by its type', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      properties: {
        id: { type: 'string' },
      },
      allOf: [
        {
          type: 'object',
          required: ['id'],
          additionalProperties: true,
        },
      ],
    };

    const result = combineSchemas({
      schema,
      name: 'InvalidParent',
      separator: 'allOf',
      context,
      nullable: '',
    });

    expect(result.value).toContain('Extract<keyof (');
    expect(result.value).not.toMatch(/Required<Pick<.+, 'id'>>$/s);
  });

  // #3748: required keys whose properties live two $ref hops away (the
  // referenced schema is itself an allOf composition) must resolve to a plain
  // Required<Pick>. The Extract guard is not equivalent here: with
  // `additionalProperties: true` the index signature collapses
  // `Extract<keyof T, K>` to `never`, silently dropping the required override.
  it('resolves required keys defined in a nested allOf $ref composition (#3748)', () => {
    const contextWithNestedComposition = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            Contents: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
              additionalProperties: true,
            },
            ItemBase: {
              allOf: [
                { $ref: '#/components/schemas/Contents' },
                {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                  },
                  required: ['status'],
                  additionalProperties: true,
                },
              ],
              additionalProperties: true,
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/ItemBase' },
        {
          type: 'object',
          properties: {
            extra: { type: 'number' },
          },
          required: ['id', 'name'],
          additionalProperties: true,
        },
      ],
      additionalProperties: true,
    };

    const result = combineSchemas({
      schema,
      name: 'ItemDetail',
      separator: 'allOf',
      context: contextWithNestedComposition,
      nullable: '',
    });

    expect(result.value).toContain("'id' | 'name'>>");
    expect(result.value).toContain('Required<Pick<');
    expect(result.value).not.toContain('Extract<');
  });

  // Keys reached through a nullable node must stay Extract-guarded: the
  // emitted type unions `| null`, so `keyof` is `never` and a plain
  // Required<Pick> would fail with TS2344.
  it('keeps Extract guard when the nested composition member is nullable', () => {
    const contextWithNullableBase = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            NullableBase: {
              type: ['object', 'null'],
              properties: {
                id: { type: 'string' },
              },
            },
            NullableWrapper: {
              allOf: [{ $ref: '#/components/schemas/NullableBase' }],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/NullableWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'NullableItem',
      separator: 'allOf',
      context: contextWithNullableBase,
      nullable: '',
    });

    expect(result.value).toContain("Extract<keyof (NullableWrapper), 'id'>");
    expect(result.value).not.toContain("Pick<NullableWrapper, 'id'>>");
  });

  // Same reasoning for enum-bearing nodes: the emission is a literal union,
  // so property keys collected from the node are not in `keyof`.
  it('keeps Extract guard when the nested composition member carries an enum', () => {
    const contextWithEnumBase = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            EnumBase: {
              type: 'object',
              enum: [{ id: 'a' }, { id: 'b' }],
              properties: {
                id: { type: 'string' },
              },
            },
            EnumWrapper: {
              allOf: [{ $ref: '#/components/schemas/EnumBase' }],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/EnumWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'EnumItem',
      separator: 'allOf',
      context: contextWithEnumBase,
      nullable: '',
    });

    expect(result.value).toContain("Extract<keyof (EnumWrapper), 'id'>");
    expect(result.value).not.toContain("Pick<EnumWrapper, 'id'>>");
  });

  // A `$ref` member can carry union-producing siblings (`nullable: true`,
  // `type: ['object', 'null']`) that the resolver merges into the emission
  // (`Wrapper = Base | null`), so the ref-site object must pass the same
  // union guard as inline nodes before dereferencing.
  it('keeps Extract guard when a nested $ref member carries a nullable sibling', () => {
    const contextWithNullableRefSite = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            RefSiteBase: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
            RefSiteWrapper: {
              allOf: [
                { $ref: '#/components/schemas/RefSiteBase', nullable: true },
              ],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/RefSiteWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'RefSiteItem',
      separator: 'allOf',
      context: contextWithNullableRefSite,
      nullable: '',
    });

    expect(result.value).toContain("Extract<keyof (RefSiteWrapper), 'id'>");
    expect(result.value).not.toContain("Pick<RefSiteWrapper, 'id'>>");
  });

  // A multi-entry type array unions its branches even without `null`
  // (`type: ['object', 'string']` emits `{...} | string`), so keys from such
  // nodes are not guaranteed in `keyof` either.
  it('keeps Extract guard when the nested composition member has a non-null type array union', () => {
    const contextWithMixedType = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            MixedBase: {
              type: ['object', 'string'],
              properties: {
                id: { type: 'string' },
              },
            },
            MixedWrapper: {
              allOf: [{ $ref: '#/components/schemas/MixedBase' }],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/MixedWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'MixedItem',
      separator: 'allOf',
      context: contextWithMixedType,
      nullable: '',
    });

    expect(result.value).toContain("Extract<keyof (MixedWrapper), 'id'>");
    expect(result.value).not.toContain("Pick<MixedWrapper, 'id'>>");
  });

  it.each([
    { label: "type: 'string'", type: 'string' },
    { label: "type: ['string']", type: ['string'] },
  ])(
    'keeps Extract guard for properties on a deep non-object node ($label)',
    ({ type }) => {
      const contextWithScalarBase = {
        ...context,
        spec: {
          components: {
            schemas: {
              ...context.spec.components!.schemas,
              ScalarBase: {
                type,
                properties: {
                  id: { type: 'string' },
                },
              },
              ScalarWrapper: {
                allOf: [{ $ref: '#/components/schemas/ScalarBase' }],
              },
            },
          },
        },
      } as unknown as ContextSpec;

      const schema: OpenApiSchemaObject = {
        type: 'object',
        required: ['id'],
        allOf: [{ $ref: '#/components/schemas/ScalarWrapper' }],
      };

      const result = combineSchemas({
        schema,
        name: 'ScalarItem',
        separator: 'allOf',
        context: contextWithScalarBase,
        nullable: '',
      });

      expect(result.value).toContain("Extract<keyof (ScalarWrapper), 'id'>");
      expect(result.value).not.toContain("Pick<ScalarWrapper, 'id'>>");
    },
  );

  // Top-level properties on an anyOf/oneOf schema are intersected into every
  // emitted branch. They therefore remain in `keyof` of the union and must be
  // collected even though properties declared inside union members are not.
  it.each(['anyOf', 'oneOf'] as const)(
    'collects top-level properties shared by emitted %s branches',
    (unionKeyword) => {
      const contextWithUnion = {
        ...context,
        spec: {
          components: {
            schemas: {
              ...context.spec.components!.schemas,
              UnionBase: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                additionalProperties: true,
                [unionKeyword]: [
                  {
                    type: 'object',
                    properties: { left: { type: 'string' } },
                  },
                  {
                    type: 'object',
                    properties: { right: { type: 'string' } },
                  },
                ],
              },
              UnionWrapper: {
                allOf: [{ $ref: '#/components/schemas/UnionBase' }],
              },
            },
          },
        },
      } as unknown as ContextSpec;

      const schema: OpenApiSchemaObject = {
        type: 'object',
        required: ['id'],
        allOf: [{ $ref: '#/components/schemas/UnionWrapper' }],
      };

      const result = combineSchemas({
        schema,
        name: 'UnionItem',
        separator: 'allOf',
        context: contextWithUnion,
        nullable: '',
      });

      expect(result.value).toContain("Pick<UnionWrapper, 'id'>>");
      expect(result.value).not.toContain('Extract<');
    },
  );

  it.each([
    ['anyOf', true],
    ['oneOf', false],
  ] as const)(
    'guards only propagated nullability from a direct %s member',
    (unionKeyword, propagatesNullability) => {
      const contextWithNestedUnion = {
        ...context,
        spec: {
          components: {
            schemas: {
              ...context.spec.components!.schemas,
              NestedUnionBase: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                additionalProperties: true,
                [unionKeyword]: [
                  {
                    type: ['object', 'null'],
                    properties: { left: { type: 'string' } },
                  },
                  {
                    type: 'object',
                    properties: { right: { type: 'string' } },
                  },
                ],
              },
              NestedUnionWrapper: {
                allOf: [{ $ref: '#/components/schemas/NestedUnionBase' }],
              },
            },
          },
        },
      } as unknown as ContextSpec;

      const schema: OpenApiSchemaObject = {
        type: 'object',
        required: ['id'],
        allOf: [{ $ref: '#/components/schemas/NestedUnionWrapper' }],
      };

      const result = combineSchemas({
        schema,
        name: 'NestedUnionItem',
        separator: 'allOf',
        context: contextWithNestedUnion,
        nullable: '',
      });

      if (propagatesNullability) {
        expect(result.value).toContain(
          "Extract<keyof (NestedUnionWrapper), 'id'>",
        );
        expect(result.value).not.toContain("Pick<NestedUnionWrapper, 'id'>>");
      } else {
        expect(result.value).toContain("Pick<NestedUnionWrapper, 'id'>>");
        expect(result.value).not.toContain('Extract<');
      }

      const unionBase = combineSchemas({
        schema: contextWithNestedUnion.spec.components!.schemas!
          .NestedUnionBase as OpenApiSchemaObject,
        name: 'NestedUnionBase',
        separator: unionKeyword,
        context: contextWithNestedUnion,
        nullable: '',
      });

      expect(unionBase.value).toContain(' | null) & {');
      expect(unionBase.value).not.toContain(' | null & {');
    },
  );

  it.each(['anyOf', 'oneOf'] as const)(
    'collects top-level properties when a %s member contains a nested nullable union',
    (unionKeyword) => {
      const contextWithNestedComposedUnion = {
        ...context,
        spec: {
          components: {
            schemas: {
              ...context.spec.components!.schemas,
              NestedComposedUnionBase: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                additionalProperties: true,
                [unionKeyword]: [
                  {
                    anyOf: [
                      {
                        type: 'object',
                        properties: { left: { type: 'string' } },
                      },
                      { type: 'null' },
                    ],
                  },
                  {
                    type: 'object',
                    properties: { right: { type: 'string' } },
                  },
                ],
              },
              NestedComposedUnionWrapper: {
                allOf: [
                  { $ref: '#/components/schemas/NestedComposedUnionBase' },
                ],
              },
            },
          },
        },
      } as unknown as ContextSpec;

      const schema: OpenApiSchemaObject = {
        type: 'object',
        required: ['id'],
        allOf: [{ $ref: '#/components/schemas/NestedComposedUnionWrapper' }],
      };

      const result = combineSchemas({
        schema,
        name: 'NestedComposedUnionItem',
        separator: 'allOf',
        context: contextWithNestedComposedUnion,
        nullable: '',
      });

      expect(result.value).toContain("Pick<NestedComposedUnionWrapper, 'id'>>");
      expect(result.value).not.toContain('Extract<');

      const unionBase = combineSchemas({
        schema: contextWithNestedComposedUnion.spec.components!.schemas!
          .NestedComposedUnionBase as OpenApiSchemaObject,
        name: 'NestedComposedUnionBase',
        separator: unionKeyword,
        context: contextWithNestedComposedUnion,
        nullable: '',
      });

      expect(unionBase.value).toContain(' | null) & {');
      expect(unionBase.value).not.toContain(' | null & {');
    },
  );

  it.each(['anyOf', 'oneOf'] as const)(
    'collects top-level properties when a %s member is a non-null scalar',
    (unionKeyword) => {
      const contextWithDirectScalarUnion = {
        ...context,
        spec: {
          components: {
            schemas: {
              ...context.spec.components!.schemas,
              DirectScalarUnionBase: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                additionalProperties: true,
                [unionKeyword]: [
                  { type: 'string' },
                  {
                    type: 'object',
                    properties: { right: { type: 'string' } },
                  },
                ],
              },
              DirectScalarUnionWrapper: {
                allOf: [{ $ref: '#/components/schemas/DirectScalarUnionBase' }],
              },
            },
          },
        },
      } as unknown as ContextSpec;

      const schema: OpenApiSchemaObject = {
        type: 'object',
        required: ['id'],
        allOf: [{ $ref: '#/components/schemas/DirectScalarUnionWrapper' }],
      };

      const result = combineSchemas({
        schema,
        name: 'DirectScalarUnionItem',
        separator: 'allOf',
        context: contextWithDirectScalarUnion,
        nullable: '',
      });

      expect(result.value).toContain("Pick<DirectScalarUnionWrapper, 'id'>>");
      expect(result.value).not.toContain('Extract<');

      const unionBase = combineSchemas({
        schema: contextWithDirectScalarUnion.spec.components!.schemas!
          .DirectScalarUnionBase as OpenApiSchemaObject,
        name: 'DirectScalarUnionBase',
        separator: unionKeyword,
        context: contextWithDirectScalarUnion,
        nullable: '',
      });

      expect(unionBase.value).toContain('(string & {');
    },
  );

  it('collects top-level properties when a nullable anyOf member is a $ref', () => {
    const contextWithNullableRefUnion = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            RefNullableBase: {
              type: 'object',
              properties: { left: { type: 'string' } },
            },
            RefMemberUnionBase: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              additionalProperties: true,
              anyOf: [
                {
                  $ref: '#/components/schemas/RefNullableBase',
                  type: ['object', 'null'],
                },
                {
                  type: 'object',
                  properties: { right: { type: 'string' } },
                },
              ],
            },
            RefMemberUnionWrapper: {
              allOf: [{ $ref: '#/components/schemas/RefMemberUnionBase' }],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/RefMemberUnionWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'RefMemberUnionItem',
      separator: 'allOf',
      context: contextWithNullableRefUnion,
      nullable: '',
    });

    expect(result.value).toContain("Pick<RefMemberUnionWrapper, 'id'>>");
    expect(result.value).not.toContain('Extract<');

    const unionBase = combineSchemas({
      schema: contextWithNullableRefUnion.spec.components!.schemas!
        .RefMemberUnionBase as OpenApiSchemaObject,
      name: 'RefMemberUnionBase',
      separator: 'anyOf',
      context: contextWithNullableRefUnion,
      nullable: '',
    });

    expect(unionBase.value).toContain('(RefNullableBase | null) & {');
  });

  it('keeps Extract guard when all union members are enums', () => {
    const contextWithEnumUnion = {
      ...context,
      output: {
        ...context.output,
        override: {
          ...context.output.override,
          enumGenerationType: 'union',
        },
      },
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            EnumUnionBase: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              additionalProperties: true,
              anyOf: [
                { type: 'string', enum: ['a'] },
                { type: 'string', enum: ['b'] },
              ],
            },
            EnumUnionWrapper: {
              allOf: [{ $ref: '#/components/schemas/EnumUnionBase' }],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/EnumUnionWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'EnumUnionItem',
      separator: 'allOf',
      context: contextWithEnumUnion,
      nullable: '',
    });

    expect(result.value).toContain("Extract<keyof (EnumUnionWrapper), 'id'>");
    expect(result.value).not.toContain("Pick<EnumUnionWrapper, 'id'>>");

    const unionBase = combineSchemas({
      schema: contextWithEnumUnion.spec.components!.schemas!
        .EnumUnionBase as OpenApiSchemaObject,
      name: 'EnumUnionBase',
      separator: 'anyOf',
      context: contextWithEnumUnion,
      nullable: '',
    });

    expect(unionBase.value).toContain("'a' | 'b' | {");
  });

  it.each(['anyOf', 'oneOf'] as const)(
    'keeps Extract guard when an all-enum %s is a sibling composition',
    (unionKeyword) => {
      const contextWithSiblingEnumUnion = {
        ...context,
        output: {
          ...context.output,
          override: {
            ...context.output.override,
            enumGenerationType: 'union',
          },
        },
        spec: {
          components: {
            schemas: {
              ...context.spec.components!.schemas,
              SiblingEnumBase: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                },
                additionalProperties: true,
                allOf: [
                  {
                    type: 'object',
                    properties: { base: { type: 'string' } },
                  },
                ],
                [unionKeyword]: [
                  { type: 'string', enum: ['a'] },
                  { type: 'string', enum: ['b'] },
                ],
              },
              SiblingEnumWrapper: {
                allOf: [{ $ref: '#/components/schemas/SiblingEnumBase' }],
              },
            },
          },
        },
      } as unknown as ContextSpec;

      const schema: OpenApiSchemaObject = {
        type: 'object',
        required: ['id'],
        allOf: [{ $ref: '#/components/schemas/SiblingEnumWrapper' }],
      };

      const result = combineSchemas({
        schema,
        name: 'SiblingEnumItem',
        separator: 'allOf',
        context: contextWithSiblingEnumUnion,
        nullable: '',
      });

      expect(result.value).toContain(
        "Extract<keyof (SiblingEnumWrapper), 'id'>",
      );
      expect(result.value).not.toContain("Pick<SiblingEnumWrapper, 'id'>>");

      const unionBase = combineSchemas({
        schema: contextWithSiblingEnumUnion.spec.components!.schemas!
          .SiblingEnumBase as OpenApiSchemaObject,
        name: 'SiblingEnumBase',
        separator: 'allOf',
        context: contextWithSiblingEnumUnion,
        nullable: '',
      });

      expect(unionBase.value).toContain("'a' | 'b' | {");
    },
  );

  it('keeps Extract guard for a canonical nullable oneOf object', () => {
    const contextWithNullableOneOf = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            CanonicalNullableOneOfBase: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              additionalProperties: true,
              oneOf: [
                {
                  type: 'object',
                  properties: { left: { type: 'string' } },
                },
                { type: 'null' },
              ],
            },
            CanonicalNullableOneOfWrapper: {
              allOf: [
                { $ref: '#/components/schemas/CanonicalNullableOneOfBase' },
              ],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/CanonicalNullableOneOfWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'CanonicalNullableOneOfItem',
      separator: 'allOf',
      context: contextWithNullableOneOf,
      nullable: '',
    });

    expect(result.value).toContain(
      "Extract<keyof (CanonicalNullableOneOfWrapper), 'id'>",
    );
    expect(result.value).not.toContain(
      "Pick<CanonicalNullableOneOfWrapper, 'id'>>",
    );
  });

  it('collects allOf properties beside a canonical nullable oneOf object', () => {
    const contextWithNullableOneOfSibling = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            NullableOneOfObjectBase: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              additionalProperties: true,
            },
            NullableOneOfSiblingBase: {
              allOf: [{ $ref: '#/components/schemas/NullableOneOfObjectBase' }],
              oneOf: [
                {
                  type: 'object',
                  properties: { left: { type: 'string' } },
                },
                { type: 'null' },
              ],
            },
            NullableOneOfSiblingWrapper: {
              allOf: [
                { $ref: '#/components/schemas/NullableOneOfSiblingBase' },
              ],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/NullableOneOfSiblingWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'NullableOneOfSiblingItem',
      separator: 'allOf',
      context: contextWithNullableOneOfSibling,
      nullable: '',
    });

    expect(result.value).toContain("Pick<NullableOneOfSiblingWrapper, 'id'>>");
    expect(result.value).not.toContain('Extract<');
  });

  it('collects allOf properties beside an inline nullable anyOf member', () => {
    const contextWithInlineNullableAnyOf = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            InlineNullableAnyOfObjectBase: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              additionalProperties: true,
            },
            InlineNullableAnyOfWrapper: {
              allOf: [
                {
                  allOf: [
                    {
                      $ref: '#/components/schemas/InlineNullableAnyOfObjectBase',
                    },
                  ],
                  anyOf: [
                    {
                      type: 'object',
                      properties: { left: { type: 'string' } },
                    },
                    { type: 'null' },
                  ],
                },
              ],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/InlineNullableAnyOfWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'InlineNullableAnyOfItem',
      separator: 'allOf',
      context: contextWithInlineNullableAnyOf,
      nullable: '',
    });

    expect(result.value).toContain("Pick<InlineNullableAnyOfWrapper, 'id'>>");
    expect(result.value).not.toContain('Extract<');

    const wrapper = combineSchemas({
      schema: contextWithInlineNullableAnyOf.spec.components!.schemas!
        .InlineNullableAnyOfWrapper as OpenApiSchemaObject,
      name: 'InlineNullableAnyOfWrapper',
      separator: 'allOf',
      context: contextWithInlineNullableAnyOf,
      nullable: '',
    });

    expect(wrapper.value).toContain('InlineNullableAnyOfObjectBase & (');
  });

  it('collects nullable member properties when an object allOf sibling removes null', () => {
    const contextWithNullableAllOfMember = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            NullableAllOfMemberBase: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              additionalProperties: true,
            },
            NullableAllOfMemberWrapper: {
              allOf: [
                {
                  $ref: '#/components/schemas/NullableAllOfMemberBase',
                  nullable: true,
                },
                {
                  type: 'object',
                  properties: { marker: { type: 'string' } },
                },
              ],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/NullableAllOfMemberWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'NullableAllOfMemberItem',
      separator: 'allOf',
      context: contextWithNullableAllOfMember,
      nullable: '',
    });

    expect(result.value).toContain("Pick<NullableAllOfMemberWrapper, 'id'>>");
    expect(result.value).not.toContain('Extract<');

    const wrapper = combineSchemas({
      schema: contextWithNullableAllOfMember.spec.components!.schemas!
        .NullableAllOfMemberWrapper as OpenApiSchemaObject,
      name: 'NullableAllOfMemberWrapper',
      separator: 'allOf',
      context: contextWithNullableAllOfMember,
      nullable: '',
    });

    expect(wrapper.value).toContain('(NullableAllOfMemberBase | null) & {');
  });

  it('collects nullable member properties when the parent object removes null', () => {
    const contextWithObjectParent = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            NullableParentBase: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              additionalProperties: true,
            },
            NullableParentWrapper: {
              type: 'object',
              properties: { marker: { type: 'string' } },
              allOf: [
                {
                  $ref: '#/components/schemas/NullableParentBase',
                  nullable: true,
                },
              ],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/NullableParentWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'NullableParentItem',
      separator: 'allOf',
      context: contextWithObjectParent,
      nullable: '',
    });

    expect(result.value).toContain("Pick<NullableParentWrapper, 'id'>>");
    expect(result.value).not.toContain('Extract<');

    const wrapper = combineSchemas({
      schema: contextWithObjectParent.spec.components!.schemas!
        .NullableParentWrapper as OpenApiSchemaObject,
      name: 'NullableParentWrapper',
      separator: 'allOf',
      context: contextWithObjectParent,
      nullable: '',
    });

    expect(wrapper.value).toContain('(NullableParentBase | null) & {');
  });

  it('collects allOf properties beside an all-enum composition', () => {
    const contextWithAllEnumSibling = {
      ...context,
      output: {
        ...context.output,
        override: {
          ...context.output.override,
          enumGenerationType: 'union',
        },
      },
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            AllEnumObjectBase: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              additionalProperties: true,
            },
            AllEnumSiblingBase: {
              allOf: [{ $ref: '#/components/schemas/AllEnumObjectBase' }],
              anyOf: [
                { type: 'string', enum: ['a'] },
                { type: 'string', enum: ['b'] },
              ],
            },
            AllEnumSiblingWrapper: {
              allOf: [{ $ref: '#/components/schemas/AllEnumSiblingBase' }],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/AllEnumSiblingWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'AllEnumSiblingItem',
      separator: 'allOf',
      context: contextWithAllEnumSibling,
      nullable: '',
    });

    expect(result.value).toContain("Pick<AllEnumSiblingWrapper, 'id'>>");
    expect(result.value).not.toContain('Extract<');
  });

  it('does not collect properties declared only inside oneOf members', () => {
    const contextWithOneOf = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            OneOfBase: {
              oneOf: [
                {
                  type: 'object',
                  properties: { id: { type: 'string' } },
                },
                { type: 'string' },
              ],
            },
            OneOfWrapper: {
              allOf: [{ $ref: '#/components/schemas/OneOfBase' }],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['id'],
      allOf: [{ $ref: '#/components/schemas/OneOfWrapper' }],
    };

    const result = combineSchemas({
      schema,
      name: 'OneOfItem',
      separator: 'allOf',
      context: contextWithOneOf,
      nullable: '',
    });

    expect(result.value).toContain("Extract<keyof (OneOfWrapper), 'id'>");
    expect(result.value).not.toContain("Pick<OneOfWrapper, 'id'>>");
  });

  it('terminates on cyclic allOf $ref compositions', () => {
    const contextWithCycle = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            CycleA: {
              properties: {
                aProp: { type: 'string' },
              },
              allOf: [{ $ref: '#/components/schemas/CycleB' }],
            },
            CycleB: {
              properties: {
                bProp: { type: 'string' },
              },
              allOf: [{ $ref: '#/components/schemas/CycleA' }],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['bProp'],
      allOf: [{ $ref: '#/components/schemas/CycleA' }],
    };

    const result = combineSchemas({
      schema,
      name: 'CycleItem',
      separator: 'allOf',
      context: contextWithCycle,
      nullable: '',
    });

    expect(result.value).toContain("'bProp'>>");
    expect(result.value).not.toContain('Extract<');
  });

  it('uses Extract guard for required ghost keys missing from all subschema properties', () => {
    const schema: OpenApiSchemaObject = {
      nullable: true,
      allOf: [{ $ref: '#/components/schemas/TagMetadataItem' }],
    };

    const contextWithTagMetadata = {
      ...context,
      spec: {
        components: {
          schemas: {
            ...context.spec.components!.schemas,
            TagMetadataItem: {
              type: 'object',
              required: ['tagId', 'label', 'color'],
              properties: {
                id: { type: 'integer' },
                label: { type: 'string' },
                color: { type: 'string' },
              },
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const result = combineSchemas({
      schema,
      name: 'TagMetadata',
      separator: 'allOf',
      context: contextWithTagMetadata,
      nullable: ' | null',
    });

    expect(result.value).toContain("Extract<keyof (TagMetadataItem), 'tagId'>");
    expect(result.value).not.toMatch(
      /Required<Pick<TagMetadataItem, 'tagId'>>/,
    );
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
