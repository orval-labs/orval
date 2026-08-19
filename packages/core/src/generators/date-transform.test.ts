import { describe, expect, it } from 'vite-plus/test';

import type {
  ContextSpec,
  GetterResponse,
  OpenApiSchemaObject,
} from '../types';
import {
  buildDateTransformStatements,
  generateResponseDateDeserializer,
} from './date-transform';

const makeContext = (
  schemas: Record<string, OpenApiSchemaObject> = {},
): ContextSpec =>
  ({
    target: 'core-test',
    workspace: '/tmp',
    spec: {
      openapi: '3.0.0',
      info: { title: 'test', version: '1.0.0' },
      paths: {},
      components: { schemas },
    },
    output: { override: { useDates: true, useDatesTransform: true } },
  }) as unknown as ContextSpec;

describe('buildDateTransformStatements', () => {
  it('emits a guarded assignment for an optional date property', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['startTime'],
      properties: {
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time', nullable: true },
      },
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context: makeContext(),
    });

    expect(statements.join('\n')).toBe(
      [
        'data.startTime = new Date(data.startTime);',
        'if (data.endTime != null) {',
        '  data.endTime = new Date(data.endTime);',
        '}',
      ].join('\n'),
    );
  });

  it('emits an index loop for arrays so date-string elements can be reassigned', () => {
    const schema: OpenApiSchemaObject = {
      type: 'array',
      items: { type: 'string', format: 'date' },
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context: makeContext(),
    });

    expect(statements.join('\n')).toBe(
      [
        'for (let i0 = 0; i0 < data.length; i0++) {',
        '  data[i0] = new Date(data[i0]);',
        '}',
      ].join('\n'),
    );
  });

  it('hoists array items into a const so optional-date narrowing survives', () => {
    const schema: OpenApiSchemaObject = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          resolvedAt: { type: 'string', format: 'date-time' },
        },
      },
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context: makeContext(),
    });

    expect(statements.join('\n')).toBe(
      [
        'for (let i0 = 0; i0 < data.length; i0++) {',
        '  const item0 = data[i0];',
        '  if (item0.resolvedAt != null) {',
        '    item0.resolvedAt = new Date(item0.resolvedAt);',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('recurses through $ref, allOf and nested arrays, pruning date-free branches', () => {
    const context = makeContext({
      LogEvent: {
        type: 'object',
        required: ['createdAt'],
        properties: {
          createdAt: { type: 'string', format: 'date-time' },
          message: { type: 'string' },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [
        {
          type: 'object',
          properties: {
            log: {
              type: 'array',
              items: { $ref: '#/components/schemas/LogEvent' },
            },
          },
        },
        { type: 'object', properties: { name: { type: 'string' } } },
      ],
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if (data.log != null) {',
        '  for (let i0 = 0; i0 < data.log.length; i0++) {',
        '    const item0 = data.log[i0];',
        '    item0.createdAt = new Date(item0.createdAt);',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('guards nullable date-string array elements', () => {
    const schema: OpenApiSchemaObject = {
      type: 'array',
      items: { type: 'string', format: 'date-time', nullable: true },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'for (let i0 = 0; i0 < data.length; i0++) {',
      '  if (data[i0] != null) {',
      '    data[i0] = new Date(data[i0]);',
      '  }',
      '}',
    ]);
  });

  it('guards nullable object array elements around the hoisted item', () => {
    const context = makeContext({
      LogEvent: {
        type: 'object',
        required: ['createdAt'],
        properties: { createdAt: { type: 'string', format: 'date-time' } },
      },
    });
    const schema = {
      type: 'array',
      items: {
        allOf: [{ $ref: '#/components/schemas/LogEvent' }],
        nullable: true,
      },
    } as OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'for (let i0 = 0; i0 < data.length; i0++) {',
      '  const item0 = data[i0];',
      '  if (item0 != null) {',
      '    item0.createdAt = new Date(item0.createdAt);',
      '  }',
      '}',
    ]);
  });

  it('uses bracket access for non-identifier property names', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['created-at'],
      properties: { 'created-at': { type: 'string', format: 'date-time' } },
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context: makeContext(),
    });

    expect(statements).toEqual([
      'data["created-at"] = new Date(data["created-at"]);',
    ]);
  });

  it('transforms repeated sibling $refs independently', () => {
    const context = makeContext({
      Actor: {
        type: 'object',
        required: ['at'],
        properties: { at: { type: 'string', format: 'date-time' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['createdBy', 'updatedBy'],
      properties: {
        createdBy: { $ref: '#/components/schemas/Actor' },
        updatedBy: { $ref: '#/components/schemas/Actor' },
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'data.createdBy.at = new Date(data.createdBy.at);',
      'data.updatedBy.at = new Date(data.updatedBy.at);',
    ]);
  });

  it('applies allOf branches and sibling properties together', () => {
    const context = makeContext({
      Audit: {
        type: 'object',
        required: ['updatedAt'],
        properties: { updatedAt: { type: 'string', format: 'date-time' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [{ $ref: '#/components/schemas/Audit' }],
      required: ['createdAt'],
      properties: { createdAt: { type: 'string', format: 'date-time' } },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'data.updatedAt = new Date(data.updatedAt);',
      'data.createdAt = new Date(data.createdAt);',
    ]);
  });

  it('returns [] for date-free, oneOf, and circular schemas', () => {
    const context = makeContext({
      Node: {
        type: 'object',
        properties: { child: { $ref: '#/components/schemas/Node' } },
      },
    });

    expect(
      buildDateTransformStatements({
        schema: { type: 'object', properties: { name: { type: 'string' } } },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
    expect(
      buildDateTransformStatements({
        schema: {
          oneOf: [
            {
              type: 'object',
              properties: { at: { type: 'string', format: 'date-time' } },
            },
          ],
        },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
    expect(
      buildDateTransformStatements({
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });
});

describe('buildDateTransformStatements — discriminated unions', () => {
  const makeUnionContext = () =>
    makeContext({
      Cat: {
        type: 'object',
        required: ['vaccinatedAt'],
        properties: {
          vaccinatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Dog: {
        type: 'object',
        properties: {
          adoptedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    });

  it('emits a switch with one case per mapping key, in mapping order', () => {
    const context = makeUnionContext();
    const schema: OpenApiSchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/Cat' },
        { $ref: '#/components/schemas/Dog' },
      ],
      discriminator: {
        propertyName: 'petType',
        mapping: {
          cat: '#/components/schemas/Cat',
          dog: '#/components/schemas/Dog',
        },
      },
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'switch (data.petType) {',
        '  case "cat": {',
        '    data.vaccinatedAt = new Date(data.vaccinatedAt);',
        '    break;',
        '  }',
        '  case "dog": {',
        '    if (data.adoptedAt != null) {',
        '      data.adoptedAt = new Date(data.adoptedAt);',
        '    }',
        '    break;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('emits identical case bodies when two mapping keys point at the same ref', () => {
    const context = makeUnionContext();
    const schema: OpenApiSchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Dog' }],
      discriminator: {
        propertyName: 'petType',
        mapping: {
          dog: '#/components/schemas/Dog',
          puppy: '#/components/schemas/Dog',
        },
      },
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'switch (data.petType) {',
        '  case "dog": {',
        '    if (data.adoptedAt != null) {',
        '      data.adoptedAt = new Date(data.adoptedAt);',
        '    }',
        '    break;',
        '  }',
        '  case "puppy": {',
        '    if (data.adoptedAt != null) {',
        '      data.adoptedAt = new Date(data.adoptedAt);',
        '    }',
        '    break;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('omits a case for a mapping key whose variant has no dates', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        required: ['vaccinatedAt'],
        properties: {
          vaccinatedAt: { type: 'string', format: 'date-time' },
        },
      },
      DateFree: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/Cat' },
        { $ref: '#/components/schemas/DateFree' },
      ],
      discriminator: {
        propertyName: 'petType',
        mapping: {
          cat: '#/components/schemas/Cat',
          date_free: '#/components/schemas/DateFree',
        },
      },
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'switch (data.petType) {',
        '  case "cat": {',
        '    data.vaccinatedAt = new Date(data.vaccinatedAt);',
        '    break;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('returns [] when every mapped variant is date-free', () => {
    const context = makeContext({
      DateFreeA: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
      DateFreeB: {
        type: 'object',
        properties: { label: { type: 'string' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/DateFreeA' },
        { $ref: '#/components/schemas/DateFreeB' },
      ],
      discriminator: {
        propertyName: 'kind',
        mapping: {
          a: '#/components/schemas/DateFreeA',
          b: '#/components/schemas/DateFreeB',
        },
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([]);
  });

  it('returns [] for oneOf with a discriminator but no mapping', () => {
    const context = makeUnionContext();
    const schema: OpenApiSchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Cat' }],
      discriminator: {
        propertyName: 'petType',
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([]);
  });

  it('wraps a discriminated union nested under an optional property in the property guard', () => {
    const context = makeUnionContext();
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        details: {
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
          discriminator: {
            propertyName: 'petType',
            mapping: {
              cat: '#/components/schemas/Cat',
              dog: '#/components/schemas/Dog',
            },
          },
        },
      },
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if (data.details != null) {',
        '  switch (data.details.petType) {',
        '    case "cat": {',
        '      data.details.vaccinatedAt = new Date(data.details.vaccinatedAt);',
        '      break;',
        '    }',
        '    case "dog": {',
        '      if (data.details.adoptedAt != null) {',
        '        data.details.adoptedAt = new Date(data.details.adoptedAt);',
        '      }',
        '      break;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('emits a hoisted item and a switch for a discriminated union inside array items', () => {
    const context = makeUnionContext();
    const schema: OpenApiSchemaObject = {
      type: 'array',
      items: {
        oneOf: [
          { $ref: '#/components/schemas/Cat' },
          { $ref: '#/components/schemas/Dog' },
        ],
        discriminator: {
          propertyName: 'petType',
          mapping: {
            cat: '#/components/schemas/Cat',
            dog: '#/components/schemas/Dog',
          },
        },
      } as OpenApiSchemaObject,
    };

    const statements = buildDateTransformStatements({
      schema,
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'for (let i0 = 0; i0 < data.length; i0++) {',
        '  const item0 = data[i0];',
        '  switch (item0.petType) {',
        '    case "cat": {',
        '      item0.vaccinatedAt = new Date(item0.vaccinatedAt);',
        '      break;',
        '    }',
        '    case "dog": {',
        '      if (item0.adoptedAt != null) {',
        '        item0.adoptedAt = new Date(item0.adoptedAt);',
        '      }',
        '      break;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
  });
});

const makeResponse = (
  overrides: Partial<GetterResponse> & {
    successTypes?: Array<Partial<GetterResponse['types']['success'][number]>>;
  },
): GetterResponse => {
  const { successTypes, ...rest } = overrides;
  return {
    imports: [],
    definition: { success: 'Pet', errors: 'unknown' },
    isBlob: false,
    types: {
      success: (successTypes ?? []).map((type) => ({
        value: 'Pet',
        isEnum: false,
        type: 'object',
        imports: [],
        schemas: [],
        isRef: true,
        key: '200',
        contentType: 'application/json',
        ...type,
      })),
      errors: [],
    },
    contentTypes: ['application/json'],
    schemas: [],
    ...rest,
  } as GetterResponse;
};

describe('buildDateTransformStatements — schema shapes from real-world specs', () => {
  it('writes readOnly date properties through a mutable cast', () => {
    // `readOnly` properties are generated with a `readonly` modifier, so a
    // plain assignment would not type-check.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['createdAt'],
      properties: {
        createdAt: { type: 'string', format: 'date-time', readOnly: true },
      },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      '(data as { -readonly [K in keyof typeof data]: (typeof data)[K] }).createdAt = new Date(data.createdAt);',
    ]);
  });

  it('writes readOnly date properties of a hoisted array item through a mutable cast', () => {
    const schema: OpenApiSchemaObject = {
      type: 'array',
      items: {
        type: 'object',
        required: ['createdAt'],
        properties: {
          createdAt: { type: 'string', format: 'date-time', readOnly: true },
        },
      },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'for (let i0 = 0; i0 < data.length; i0++) {',
      '  const item0 = data[i0];',
      '  (item0 as { -readonly [K in keyof typeof item0]: (typeof item0)[K] }).createdAt = new Date(item0.createdAt);',
      '}',
    ]);
  });

  it('writes allOf-wrapped date elements back through the array slot', () => {
    // Hoisting the element into a const would make the assignment reassign
    // a const, which does not compile.
    const schema: OpenApiSchemaObject = {
      type: 'array',
      items: { allOf: [{ type: 'string', format: 'date-time' }] },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'for (let i0 = 0; i0 < data.length; i0++) {',
      '  data[i0] = new Date(data[i0]);',
      '}',
    ]);
  });

  it('resolves discriminator mappings given as bare component schema names', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        required: ['vaccinatedAt'],
        properties: {
          petType: { type: 'string' },
          vaccinatedAt: { type: 'string', format: 'date-time' },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Cat' }],
      discriminator: { propertyName: 'petType', mapping: { cat: 'Cat' } },
    } as OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'switch (data.petType) {',
      '  case "cat": {',
      '    data.vaccinatedAt = new Date(data.vaccinatedAt);',
      '    break;',
      '  }',
      '}',
    ]);
  });

  it('skips an unresolvable discriminator mapping target instead of throwing', () => {
    const schema: OpenApiSchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Missing' }],
      discriminator: { propertyName: 'petType', mapping: { cat: 'Missing' } },
    } as OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('keeps converting sibling variants when one mapping variant has a broken nested $ref', () => {
    const context = makeContext({
      Shared: {
        type: 'object',
        required: ['updatedAt'],
        properties: { updatedAt: { type: 'string', format: 'date-time' } },
      },
      TypeA: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: { type: 'string' },
          shared: { $ref: '#/components/schemas/Shared' },
          broken: { $ref: '#/components/schemas/DoesNotExist' },
        },
      },
      TypeB: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: { type: 'string' },
          shared: { $ref: '#/components/schemas/Shared' },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/TypeA' },
        { $ref: '#/components/schemas/TypeB' },
      ],
      discriminator: {
        propertyName: 'kind',
        mapping: { a: 'TypeA', b: 'TypeB' },
      },
    } as OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'switch (data.kind) {',
      '  case "b": {',
      '    if (data.shared != null) {',
      '      data.shared.updatedAt = new Date(data.shared.updatedAt);',
      '    }',
      '    break;',
      '  }',
      '}',
    ]);
  });

  it('restores visitedRefs when a mapping target throws mid-walk', () => {
    // A leaked entry would make a later, non-cyclic branch look cyclic and
    // silently drop its conversions.
    const context = makeContext({
      TypeA: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: { type: 'string' },
          broken: { $ref: '#/components/schemas/DoesNotExist' },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/TypeA' }],
      discriminator: { propertyName: 'kind', mapping: { a: 'TypeA' } },
    } as OpenApiSchemaObject;
    const visitedRefs = new Set<string>();

    buildDateTransformStatements({
      schema,
      accessor: 'data',
      context,
      visitedRefs,
    });

    expect([...visitedRefs]).toEqual([]);
  });

  it('emits nothing for a recursive schema rather than converting only its first level', () => {
    const context = makeContext({
      Node: {
        type: 'object',
        required: ['createdAt', 'children'],
        properties: {
          createdAt: { type: 'string', format: 'date-time' },
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/Node' },
          },
        },
      },
    });

    expect(
      buildDateTransformStatements({
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });

  it('keeps converting non-recursive siblings of a recursive property', () => {
    const context = makeContext({
      Node: {
        type: 'object',
        required: ['createdAt', 'children'],
        properties: {
          createdAt: { type: 'string', format: 'date-time' },
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/Node' },
          },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['generatedAt', 'tree'],
      properties: {
        generatedAt: { type: 'string', format: 'date-time' },
        tree: { $ref: '#/components/schemas/Node' },
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual(['data.generatedAt = new Date(data.generatedAt);']);
  });

  it('emits nothing for mutually recursive schemas', () => {
    const context = makeContext({
      Parent: {
        type: 'object',
        required: ['createdAt', 'child'],
        properties: {
          createdAt: { type: 'string', format: 'date-time' },
          child: { $ref: '#/components/schemas/Child' },
        },
      },
      Child: {
        type: 'object',
        required: ['parent'],
        properties: { parent: { $ref: '#/components/schemas/Parent' } },
      },
    });

    expect(
      buildDateTransformStatements({
        schema: { $ref: '#/components/schemas/Parent' },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });

  it('converts an OAS 3.1 nullable date spelled as anyOf with a null branch', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['deletedAt'],
      properties: {
        deletedAt: {
          anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
        },
      },
    } as OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'if (data.deletedAt != null) {',
      '  data.deletedAt = new Date(data.deletedAt);',
      '}',
    ]);
  });

  it('converts an OAS 3.1 nullable $ref spelled as anyOf with a null branch', () => {
    const context = makeContext({
      Audit: {
        type: 'object',
        required: ['updatedAt'],
        properties: { updatedAt: { type: 'string', format: 'date-time' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['audit'],
      properties: {
        audit: {
          anyOf: [{ $ref: '#/components/schemas/Audit' }, { type: 'null' }],
        },
      },
    } as OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'if (data.audit != null) {',
      '  data.audit.updatedAt = new Date(data.audit.updatedAt);',
      '}',
    ]);
  });

  it('still skips a genuine multi-branch union without a discriminator', () => {
    const schema: OpenApiSchemaObject = {
      anyOf: [
        {
          type: 'object',
          properties: { at: { type: 'string', format: 'date-time' } },
        },
        {
          type: 'object',
          properties: { on: { type: 'string', format: 'date' } },
        },
        { type: 'null' },
      ],
    } as OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([]);
  });
});

describe('generateResponseDateDeserializer', () => {
  const datedSchema: OpenApiSchemaObject = {
    type: 'object',
    required: ['createdAt'],
    properties: { createdAt: { type: 'string', format: 'date-time' } },
  };

  it('generates a named deserializer for a dated JSON response', () => {
    const result = generateResponseDateDeserializer({
      operationName: 'getPet',
      response: makeResponse({
        successTypes: [{ originalSchema: datedSchema }],
      }),
      context: makeContext(),
    });

    expect(result?.name).toBe('deserializeGetPetResponse');
    expect(result?.implementation).toBe(
      `const deserializeGetPetResponse = (data: Pet): Pet => {
  if (data == null) return data;
  data.createdAt = new Date(data.createdAt);
  return data;
};
`,
    );
  });

  it('generates a deserializer with a discriminator switch for a discriminated-union response', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        required: ['vaccinatedAt'],
        properties: {
          vaccinatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Dog: {
        type: 'object',
        properties: {
          adoptedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    });
    const unionSchema: OpenApiSchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/Cat' },
        { $ref: '#/components/schemas/Dog' },
      ],
      discriminator: {
        propertyName: 'petType',
        mapping: {
          cat: '#/components/schemas/Cat',
          dog: '#/components/schemas/Dog',
        },
      },
    };

    const result = generateResponseDateDeserializer({
      operationName: 'getPetProfile',
      response: makeResponse({
        successTypes: [{ originalSchema: unionSchema }],
      }),
      context,
    });

    expect(result?.name).toBe('deserializeGetPetProfileResponse');
    expect(result?.implementation).toContain('switch (data.petType) {');
  });

  it('generates a deserializer for an uppercase JSON content type', () => {
    const result = generateResponseDateDeserializer({
      operationName: 'getPet',
      response: makeResponse({
        successTypes: [
          { originalSchema: datedSchema, contentType: 'application/JSON' },
        ],
      }),
      context: makeContext(),
    });

    expect(result?.name).toBe('deserializeGetPetResponse');
  });

  it('returns undefined when the response has no date fields', () => {
    const result = generateResponseDateDeserializer({
      operationName: 'getPet',
      response: makeResponse({
        successTypes: [
          {
            originalSchema: {
              type: 'object',
              properties: { name: { type: 'string' } },
            },
          },
        ],
      }),
      context: makeContext(),
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined for blob, non-JSON, missing-schema and multi-success responses', () => {
    const context = makeContext();
    const blob = makeResponse({
      successTypes: [{ originalSchema: datedSchema }],
    });
    blob.isBlob = true;
    expect(
      generateResponseDateDeserializer({
        operationName: 'a',
        response: blob,
        context,
      }),
    ).toBeUndefined();
    expect(
      generateResponseDateDeserializer({
        operationName: 'b',
        response: makeResponse({
          successTypes: [
            { originalSchema: datedSchema, contentType: 'text/plain' },
          ],
        }),
        context,
      }),
    ).toBeUndefined();
    expect(
      generateResponseDateDeserializer({
        operationName: 'c',
        response: makeResponse({ successTypes: [{}] }),
        context,
      }),
    ).toBeUndefined();
    expect(
      generateResponseDateDeserializer({
        operationName: 'd',
        response: makeResponse({
          successTypes: [
            { originalSchema: datedSchema },
            { key: '201', originalSchema: datedSchema },
          ],
        }),
        context,
      }),
    ).toBeUndefined();
  });
});
