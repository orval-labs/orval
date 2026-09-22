import vm from 'node:vm';

import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils';
import type {
  ContextSpec,
  GetterBody,
  GetterResponse,
  OpenApiNonBooleanSchemaObject,
  OpenApiSchemaObject,
} from '../types';
import {
  buildDateTransformStatements,
  buildRequestDateSerializeStatements,
  generateRequestDateSerializer,
  generateResponseDateDeserializer,
} from './date-transform';

const makeContext = (
  schemas: Record<string, OpenApiSchemaObject> = {},
): ContextSpec =>
  createTestContextSpec({
    target: 'core-test',
    workspace: '/tmp',
    spec: {
      components: { schemas },
    },
    override: { useDates: true, useDatesTransform: true },
  });

describe('buildDateTransformStatements', () => {
  it('emits a guarded assignment for an optional date property', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['startTime'],
      properties: {
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: ['string', 'null'], format: 'date-time' },
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
      items: { type: ['string', 'null'], format: 'date-time' },
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
        anyOf: [{ $ref: '#/components/schemas/LogEvent' }, { type: 'null' }],
      },
    } satisfies OpenApiSchemaObject;

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
      'if (data.createdBy != null) {',
      '  data.createdBy.at = new Date(data.createdBy.at);',
      '}',
      'if (data.updatedBy != null) {',
      '  data.updatedBy.at = new Date(data.updatedBy.at);',
      '}',
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

  it('returns [] for date-free and circular schemas', () => {
    const context = makeContext({
      Node: {
        type: 'object',
        properties: {
          child: { $ref: '#/components/schemas/Node' },
        },
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
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });

  // Pinned against pre-fix behaviour: a bare `oneOf` with a single
  // object-shaped variant and no discriminator at all used to return [] —
  // the old rule skipped every undiscriminated union outright. The
  // structural walk now converts it like any other single-variant union.
  it('walks a bare oneOf with a single object variant structurally', () => {
    const context = makeContext();

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
    ).toEqual([
      'if ("at" in data && data.at != null) {',
      '  data.at = new Date(data.at);',
      '}',
    ]);
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
          adoptedAt: { type: ['string', 'null'], format: 'date-time' },
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

  it('walks a discriminator without a mapping structurally', () => {
    const context = makeUnionContext();
    const schema: OpenApiSchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Cat' }],
      discriminator: {
        propertyName: 'petType',
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }).join(
        '\n',
      ),
    ).toBe(
      [
        'if ("vaccinatedAt" in data && data.vaccinatedAt != null) {',
        '  data.vaccinatedAt = new Date(data.vaccinatedAt);',
        '}',
      ].join('\n'),
    );
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
      } satisfies OpenApiSchemaObject,
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

  it('does not emit a blind Object.keys loop for a discriminated-union variant that is a bare map', () => {
    // A variant that is only `additionalProperties` (no `properties` of its
    // own) sits at the very accessor the discriminator switch has just
    // guarded on — that level is guaranteed to carry the discriminator key at
    // runtime, so a blind key loop there would revisit (and corrupt) it, the
    // same hazard `mapSuppressed` already guards against for an `allOf`
    // branch. With nothing else to convert, the "extras" case contributes no
    // statements and is dropped from the switch entirely, in both
    // directions — see the mirror of this test in the
    // `buildRequestDateSerializeStatements` describe block below.
    const context = makeContext({
      Cat: {
        type: 'object',
        required: ['vaccinatedAt'],
        properties: { vaccinatedAt: { type: 'string', format: 'date-time' } },
      },
      Extras: {
        type: 'object',
        additionalProperties: { type: 'string', format: 'date-time' },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/Cat' },
        { $ref: '#/components/schemas/Extras' },
      ],
      discriminator: {
        propertyName: 'kind',
        mapping: {
          cat: '#/components/schemas/Cat',
          extras: '#/components/schemas/Extras',
        },
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'switch (data.kind) {',
      '  case "cat": {',
      '    data.vaccinatedAt = new Date(data.vaccinatedAt);',
      '    break;',
      '  }',
      '}',
    ]);
  });
});

describe('buildDateTransformStatements — undiscriminated unions', () => {
  const makeRecordContext = () =>
    makeContext({
      VisitRecord: {
        type: 'object',
        required: ['recordType', 'visitedOn'],
        properties: {
          recordType: { type: 'string', enum: ['visit'] },
          visitedOn: { type: 'string', format: 'date' },
          seenBy: { type: 'string' },
        },
      },
      VisitSeriesRecord: {
        type: 'object',
        required: ['recordType', 'entries'],
        properties: {
          recordType: { type: 'string', enum: ['visit'] },
          entries: {
            type: 'array',
            items: { $ref: '#/components/schemas/VisitRecord' },
          },
        },
      },
      WeightRecord: {
        type: 'object',
        required: ['recordType', 'kilograms'],
        properties: {
          recordType: { type: 'string', enum: ['weight'] },
          kilograms: { type: 'number' },
        },
      },
      TreatmentRecord: {
        type: 'object',
        required: ['recordType', 'administeredAt'],
        properties: {
          recordType: { type: 'string', enum: ['treatment'] },
          administeredAt: { type: 'string', format: 'date-time' },
          visitedOn: { type: 'string', format: 'date' },
        },
      },
      LegacyVisitRecord: {
        type: 'object',
        properties: {
          visitedOn: { type: 'string', format: 'date-time' },
          closedAt: { type: 'string', format: 'date-time' },
        },
      },
      ConflictVisitRecord: {
        type: 'object',
        properties: {
          visitedOn: { type: 'string' },
          closedAt: { type: 'string', format: 'date-time' },
        },
      },
      ArrayVisitRecord: {
        type: 'object',
        properties: {
          visitedOn: {
            type: 'array',
            items: { type: 'string', format: 'date-time' },
          },
        },
      },
    });

  it('guards each variant property on its presence', () => {
    const context = makeRecordContext();
    const statements = buildDateTransformStatements({
      schema: {
        anyOf: [
          { $ref: '#/components/schemas/VisitRecord' },
          { $ref: '#/components/schemas/WeightRecord' },
        ],
      },
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if ("visitedOn" in data && data.visitedOn != null) {',
        '  data.visitedOn = new Date(data.visitedOn);',
        '}',
      ].join('\n'),
    );
  });

  it('emits one block for a property two variants treat identically', () => {
    const context = makeRecordContext();
    const statements = buildDateTransformStatements({
      schema: {
        anyOf: [
          { $ref: '#/components/schemas/VisitRecord' },
          { $ref: '#/components/schemas/TreatmentRecord' },
        ],
      },
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if ("visitedOn" in data && data.visitedOn != null) {',
        '  data.visitedOn = new Date(data.visitedOn);',
        '}',
        'if ("administeredAt" in data && data.administeredAt != null) {',
        '  data.administeredAt = new Date(data.administeredAt);',
        '}',
      ].join('\n'),
    );
  });

  it('skips only the property whose variants disagree', () => {
    const context = makeRecordContext();
    const statements = buildDateTransformStatements({
      schema: {
        anyOf: [
          { $ref: '#/components/schemas/LegacyVisitRecord' },
          { $ref: '#/components/schemas/ConflictVisitRecord' },
        ],
      },
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if ("closedAt" in data && data.closedAt != null) {',
        '  data.closedAt = new Date(data.closedAt);',
        '}',
      ].join('\n'),
    );
  });

  // The comparator must catch disagreement even when BOTH variants produce
  // non-empty statements for the property — not only the "one converts, one
  // doesn't" case above. Here `visitedOn` is a scalar `date-time` in one
  // variant and an array of `date-time` in the other: both convert, but to
  // textually different code, so the property is still dropped.
  it('drops a property when both variants convert it, but differently', () => {
    const context = makeRecordContext();
    const statements = buildDateTransformStatements({
      schema: {
        anyOf: [
          { $ref: '#/components/schemas/LegacyVisitRecord' },
          { $ref: '#/components/schemas/ArrayVisitRecord' },
        ],
      },
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if ("closedAt" in data && data.closedAt != null) {',
        '  data.closedAt = new Date(data.closedAt);',
        '}',
      ].join('\n'),
    );
  });

  it('reaches dates nested in an array inside a variant', () => {
    const context = makeRecordContext();
    const statements = buildDateTransformStatements({
      schema: {
        anyOf: [
          { $ref: '#/components/schemas/VisitSeriesRecord' },
          { $ref: '#/components/schemas/WeightRecord' },
        ],
      },
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if ("entries" in data && data.entries != null) {',
        '  for (let i0 = 0; i0 < data.entries.length; i0++) {',
        '    const item0 = data.entries[i0];',
        '    item0.visitedOn = new Date(item0.visitedOn);',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('emits nothing when a variant is not object-shaped', () => {
    const context = makeRecordContext();
    expect(
      buildDateTransformStatements({
        schema: {
          anyOf: [
            { $ref: '#/components/schemas/VisitRecord' },
            { type: 'array', items: { type: 'string' } },
          ],
        },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });

  it('emits nothing when no variant carries a date', () => {
    const context = makeRecordContext();
    expect(
      buildDateTransformStatements({
        schema: { anyOf: [{ $ref: '#/components/schemas/WeightRecord' }] },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });

  it('walks a union used as a map value', () => {
    const context = makeRecordContext();
    const statements = buildDateTransformStatements({
      schema: {
        type: 'object',
        additionalProperties: {
          anyOf: [
            { $ref: '#/components/schemas/VisitRecord' },
            { $ref: '#/components/schemas/WeightRecord' },
          ],
        },
      },
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'for (const key0 of Object.keys(data)) {',
        '  const item0 = data[key0];',
        '  if ("visitedOn" in item0 && item0.visitedOn != null) {',
        '    item0.visitedOn = new Date(item0.visitedOn);',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  // CRITICAL fix-round-1 regression, expectation corrected in fix-round-2: a
  // variant resolved through a fresh, call-local `normalizeSchema` (rather
  // than through the same `visitedRefs` bookkeeping `buildStatements` uses
  // everywhere else) never registered its own `$ref`, so a variant that
  // refers back to an ancestor already being walked resolved successfully
  // every time and recursed forever — this schema overflowed the stack.
  //
  // The fix-round-1 patch stopped the overflow but returned a plain
  // `emptyResult()` on the cycle, which only dropped the union itself
  // (`child`) while leaving `at` converted — but the generated model types
  // `child.at` as `Date` too, so a caller reading it would call
  // `.toISOString()` on a string and throw at runtime. Every OTHER recursive
  // shape in this file emits nothing for the WHOLE subtree once a cycle
  // closes (see `'emits nothing for a recursive schema rather than
  // converting only its first level'` below), and the discriminated-union
  // spelling of this same schema (`buildMappedUnionStatements`, which
  // propagates `inner.cyclicRefs`) already followed that rule — the
  // structural path now does too: the cycle is signalled via `cyclicRefs`,
  // so Node's own `buildStatements` call sees its own ref come back and
  // drops `at` as well.
  it('emits nothing for the whole schema when a union variant recursively refers back to an ancestor', () => {
    const context = makeContext({
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: {
            anyOf: [
              { $ref: '#/components/schemas/Node' },
              { $ref: '#/components/schemas/Leaf' },
            ],
          },
        },
      },
      Leaf: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
    });

    expect(() =>
      buildDateTransformStatements({
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'data',
        context,
      }),
    ).not.toThrow();

    expect(
      buildDateTransformStatements({
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);

    // The discriminated-union spelling of the identical schema (mapping
    // `child`'s two variants instead of leaving them undiscriminated) must
    // agree: both are "a union variant recursively refers back to an
    // ancestor," and both must drop the whole schema, not just the union.
    const mappedContext = makeContext({
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: {
            oneOf: [
              { $ref: '#/components/schemas/Node' },
              { $ref: '#/components/schemas/Leaf' },
            ],
            discriminator: {
              propertyName: 'kind',
              mapping: {
                node: '#/components/schemas/Node',
                leaf: '#/components/schemas/Leaf',
              },
            },
          },
        },
      },
      Leaf: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
    });

    expect(
      buildDateTransformStatements({
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'data',
        context: mappedContext,
      }),
    ).toEqual([]);
  });

  // ALSO FIX, fix-round-2: registering every variant's ref for the whole
  // union body (rather than one at a time) made a reference from one
  // variant to an unrelated SIBLING variant look identical to a genuine
  // cycle — `Dog`'s ref was still active from resolving it as `anyOf`'s
  // second member while `Cat.pal: { $ref: Dog }` was being walked, so
  // `pal`'s conversion was silently dropped even though nothing here is
  // recursive. This walked fine before the fix-round-1 amend; pinning it so
  // it can't regress again.
  it('walks a property that references a sibling variant of the same union', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        properties: {
          vaccinatedOn: { type: 'string', format: 'date-time' },
          pal: { $ref: '#/components/schemas/Dog' },
        },
      },
      Dog: {
        type: 'object',
        properties: {
          adoptedOn: { type: 'string', format: 'date-time' },
        },
      },
    });

    const statements = buildDateTransformStatements({
      schema: {
        anyOf: [
          { $ref: '#/components/schemas/Cat' },
          { $ref: '#/components/schemas/Dog' },
        ],
      },
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if ("vaccinatedOn" in data && data.vaccinatedOn != null) {',
        '  data.vaccinatedOn = new Date(data.vaccinatedOn);',
        '}',
        'if ("pal" in data && data.pal != null) {',
        '  if (data.pal.adoptedOn != null) {',
        '    data.pal.adoptedOn = new Date(data.pal.adoptedOn);',
        '  }',
        '}',
        'if ("adoptedOn" in data && data.adoptedOn != null) {',
        '  data.adoptedOn = new Date(data.adoptedOn);',
        '}',
      ].join('\n'),
    );
  });

  // IMPORTANT fix-round-3 regression: fix-round-2 restored the recursion
  // rule for a variant referring DIRECTLY back to an ancestor, but two
  // separate leaks still swallowed the `cyclicRefs` signal for every other
  // shape of cycle, so the structural and mapped spellings of an otherwise
  // identical schema could disagree — which is exactly the defect this
  // whole area exists to prevent. All three regressions below assert
  // equivalence between the two spellings directly, rather than only
  // pinning a literal string, since that equivalence is the property that
  // broke.
  //
  // Leak A: a cycle detected *below* a variant's own ref (not at the ref
  // itself — here, one property removed, through a `Wrapper`) surfaced as
  // an empty-statements result that still carried `cyclicRefs`, and the
  // cross-variant comparator's early returns (`first.statements.length ===
  // 0`, and the "variants disagree" branch) both discarded it by returning
  // a fresh `emptyResult()` instead of propagating it.
  it('emits nothing for the whole schema when a union variant refers back to an ancestor through an intermediate schema', () => {
    const buildContext = () =>
      makeContext({
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            child: {
              anyOf: [
                { $ref: '#/components/schemas/Wrapper' },
                { $ref: '#/components/schemas/Leaf' },
              ],
            },
          },
        },
        Wrapper: {
          type: 'object',
          properties: { back: { $ref: '#/components/schemas/Node' } },
        },
        Leaf: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      });

    expect(
      buildDateTransformStatements({
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'data',
        context: buildContext(),
      }),
    ).toEqual([]);

    // The mapped spelling of the identical shape (`child` as `oneOf` +
    // `discriminator.mapping` instead of a bare `anyOf`) must agree.
    const mappedContext = makeContext({
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: {
            oneOf: [
              { $ref: '#/components/schemas/Wrapper' },
              { $ref: '#/components/schemas/Leaf' },
            ],
            discriminator: {
              propertyName: 'kind',
              mapping: {
                wrapper: '#/components/schemas/Wrapper',
                leaf: '#/components/schemas/Leaf',
              },
            },
          },
        },
      },
      Wrapper: {
        type: 'object',
        properties: { back: { $ref: '#/components/schemas/Node' } },
      },
      Leaf: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
    });

    expect(
      buildDateTransformStatements({
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'data',
        context: mappedContext,
      }),
    ).toEqual([]);
  });

  // Leak B: when the union itself is what registered the cyclic ref (a
  // root-level union, or any union whose variant ref isn't already on an
  // ancestor's stack), nobody above the union ever checks
  // `cyclicRefs.has(ref)` for it — the ordinary `buildResolvedStatements`
  // pairing of "register a ref, then check for it in the merged result" was
  // only half-applied: the union registered the ref but never performed the
  // matching check-and-drop for its own variants.
  it('emits nothing for a root-level union whose own variant refers back to itself', () => {
    const buildContext = () =>
      makeContext({
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            self: { $ref: '#/components/schemas/Node' },
          },
        },
        Leaf: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      });

    expect(
      buildDateTransformStatements({
        schema: {
          anyOf: [
            { $ref: '#/components/schemas/Node' },
            { $ref: '#/components/schemas/Leaf' },
          ],
        },
        accessor: 'data',
        context: buildContext(),
      }),
    ).toEqual([]);

    // The mapped spelling of the identical root union must agree.
    expect(
      buildDateTransformStatements({
        schema: {
          oneOf: [
            { $ref: '#/components/schemas/Node' },
            { $ref: '#/components/schemas/Leaf' },
          ],
          discriminator: {
            propertyName: 'kind',
            mapping: {
              node: '#/components/schemas/Node',
              leaf: '#/components/schemas/Leaf',
            },
          },
        },
        accessor: 'data',
        context: buildContext(),
      }),
    ).toEqual([]);
  });

  // Both leaks together: A and B are mutually recursive through each other
  // (not self-referential individually), so neither the ancestor-registers
  // path nor the union-registers-its-own-ref path alone would have caught
  // this — both fixes are needed, or this over-converts (before the fix,
  // this schema converted `data.x.at` AND `data.at`, neither of which is
  // safe once the model's declared type is considered).
  it('emits nothing for a root-level union of mutually recursive variants', () => {
    const buildContext = () =>
      makeContext({
        A: {
          type: 'object',
          properties: { x: { $ref: '#/components/schemas/B' } },
        },
        B: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            a: { $ref: '#/components/schemas/A' },
          },
        },
      });

    expect(
      buildDateTransformStatements({
        schema: {
          anyOf: [
            { $ref: '#/components/schemas/A' },
            { $ref: '#/components/schemas/B' },
          ],
        },
        accessor: 'data',
        context: buildContext(),
      }),
    ).toEqual([]);

    // The mapped spelling of the identical root union must agree.
    expect(
      buildDateTransformStatements({
        schema: {
          oneOf: [
            { $ref: '#/components/schemas/A' },
            { $ref: '#/components/schemas/B' },
          ],
          discriminator: {
            propertyName: 'kind',
            mapping: {
              a: '#/components/schemas/A',
              b: '#/components/schemas/B',
            },
          },
        },
        accessor: 'data',
        context: buildContext(),
      }),
    ).toEqual([]);
  });

  // IMPORTANT fix-round-1 regression: `isObjectVariant` resolved a variant's
  // `$ref` unguarded, so a variant pointing at a schema that doesn't exist
  // threw out of `buildDateTransformStatements` (and every caller, none of
  // which catch). An unresolvable variant must mean the union — like a
  // discriminated union's own unresolvable mapping target — contributes
  // nothing, not that generation dies.
  it('emits nothing rather than throwing when a variant ref is unresolvable', () => {
    const context = makeRecordContext();

    expect(() =>
      buildDateTransformStatements({
        schema: {
          anyOf: [
            { $ref: '#/components/schemas/VisitRecord' },
            { $ref: '#/components/schemas/DoesNotExist' },
          ],
        },
        accessor: 'data',
        context,
      }),
    ).not.toThrow();

    expect(
      buildDateTransformStatements({
        schema: {
          anyOf: [
            { $ref: '#/components/schemas/VisitRecord' },
            { $ref: '#/components/schemas/DoesNotExist' },
          ],
        },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });

  // IMPORTANT fix-round-1 ruling: an `allOf` variant's inherited properties
  // are never merged into `.properties` by the key-collection step, so
  // admitting it here would silently under-convert instead of correctly
  // disqualifying the union. `isObjectVariant` now requires own `properties`,
  // so any `allOf` variant disqualifies the whole union — exactly the
  // pre-structural-walk behaviour for these unions, hence no regression.
  it('disqualifies the union when a variant is allOf-shaped rather than a plain object', () => {
    const context = makeContext({
      Base: {
        type: 'object',
        required: ['visitedOn'],
        properties: { visitedOn: { type: 'string', format: 'date-time' } },
      },
    });

    expect(
      buildDateTransformStatements({
        schema: {
          anyOf: [
            { allOf: [{ $ref: '#/components/schemas/Base' }] },
            {
              type: 'object',
              properties: { on: { type: 'string', format: 'date' } },
            },
          ],
        },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });

  // ALSO FIX fix-round-2, regression guard added fix-round-3: the previous
  // test for "not object-shaped" uses a pure array variant (`type: 'array'`,
  // no `properties`), which `hasOwnProperties` alone already rejects — that
  // test would still pass even with the `items`/`type: 'array'`
  // short-circuit deleted from `isObjectVariant`. This variant declares BOTH
  // `items` and `properties`, so only the short-circuit itself (checked
  // before `hasOwnProperties`) disqualifies it.
  it('disqualifies the union when a variant declares both items and properties', () => {
    const context = makeContext({
      WeightRecord: {
        type: 'object',
        required: ['recordType', 'kilograms'],
        properties: {
          recordType: { type: 'string', enum: ['weight'] },
          kilograms: { type: 'number' },
        },
      },
    });

    expect(
      buildDateTransformStatements({
        schema: {
          anyOf: [
            { $ref: '#/components/schemas/WeightRecord' },
            {
              type: 'array',
              items: { type: 'string' },
              properties: { at: { type: 'string', format: 'date-time' } },
            } as OpenApiSchemaObject,
          ],
        },
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });

  // ---------------------------------------------------------------------
  // Fix round 4: every exit of the union walk must carry what it already
  // learned.
  //
  // Three early returns in the variant loop used to abandon the union
  // mid-walk and return a result built from nothing but the variant that
  // tripped them — an unresolvable sibling, a non-object sibling, or a
  // sibling whose ref an ancestor was already expanding — discarding every
  // `cyclicRefs` entry the variants walked before it had collected. And
  // when the tripping variant came FIRST, the cycle reachable only through
  // a later variant was never discovered at all, so the same shape
  // converted or didn't depending on the order the spec happened to list
  // its variants in. Both orderings are asserted in each test below for
  // that reason.
  //
  // In all four shapes an ancestor (`Node`, or `Outer`) is recursive
  // through one variant, so the standing rule covers the whole schema:
  // emit nothing rather than convert the levels above the cycle and leave
  // the deeper dates as strings while the generated model types them
  // `Date`. The discriminated-with-mapping spelling is the reference
  // implementation of that rule, so each test asserts that spelling of the
  // same cycle beside the structural one — and, so that `[]` can never be
  // mistaken for "nothing here could ever convert", asserts that the same
  // mapped union with the cycle broken does emit a real switch.
  // ---------------------------------------------------------------------

  const nodeStatements = (context: ContextSpec) =>
    buildDateTransformStatements({
      schema: { $ref: '#/components/schemas/Node' },
      accessor: 'data',
      context,
    });

  // `child`'s cycle-carrying variant spelled with a discriminator mapping
  // instead of walked structurally. Its sibling is a named object schema
  // because a mapping key can only target one — the sibling's shape is what
  // the structural walk trips over, not what makes the schema unsafe, and
  // the cycle both spellings have to find, `Wrapper.back` -> `Node`, is
  // identical.
  const makeMappedCyclicNodeContext = () =>
    makeContext({
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: {
            oneOf: [
              { $ref: '#/components/schemas/Wrapper' },
              { $ref: '#/components/schemas/Plain' },
            ],
            discriminator: {
              propertyName: 'kind',
              mapping: {
                wrapper: '#/components/schemas/Wrapper',
                plain: '#/components/schemas/Plain',
              },
            },
          },
        },
      },
      Wrapper: {
        type: 'object',
        properties: { back: { $ref: '#/components/schemas/Node' } },
      },
      Plain: {
        type: 'object',
        properties: { seenAt: { type: 'string', format: 'date-time' } },
      },
    });

  // The same mapped union with the cycle broken — `Wrapper.back` points at
  // the date-carrying `Plain` instead of back at `Node` — and nothing else
  // changed. Every `[]` below is the cycle's doing, not an inert schema.
  const makeMappedAcyclicNodeContext = () =>
    makeContext({
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: {
            oneOf: [
              { $ref: '#/components/schemas/Wrapper' },
              { $ref: '#/components/schemas/Plain' },
            ],
            discriminator: {
              propertyName: 'kind',
              mapping: {
                wrapper: '#/components/schemas/Wrapper',
                plain: '#/components/schemas/Plain',
              },
            },
          },
        },
      },
      Wrapper: {
        type: 'object',
        properties: { back: { $ref: '#/components/schemas/Plain' } },
      },
      Plain: {
        type: 'object',
        properties: { seenAt: { type: 'string', format: 'date-time' } },
      },
    });

  const mappedAcyclicNodeOutput = [
    'if (data.at != null) {',
    '  data.at = new Date(data.at);',
    '}',
    'if (data.child != null) {',
    '  switch (data.child.kind) {',
    '    case "wrapper": {',
    '      if (data.child.back != null) {',
    '        if (data.child.back.seenAt != null) {',
    '          data.child.back.seenAt = new Date(data.child.back.seenAt);',
    '        }',
    '      }',
    '      break;',
    '    }',
    '    case "plain": {',
    '      if (data.child.seenAt != null) {',
    '        data.child.seenAt = new Date(data.child.seenAt);',
    '      }',
    '      break;',
    '    }',
    '  }',
    '}',
  ].join('\n');

  it('emits nothing when a cycle sits behind one variant and a scalar variant disqualifies the union', () => {
    const makeScalarSiblingContext = (
      variants: NonNullable<OpenApiNonBooleanSchemaObject['anyOf']>,
    ) =>
      makeContext({
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            child: { anyOf: variants },
          },
        },
        Wrapper: {
          type: 'object',
          properties: { back: { $ref: '#/components/schemas/Node' } },
        },
      });

    // Walking `Wrapper` collects the `Node` cycle; the scalar sibling then
    // disqualifies the union. The cycle has to survive that either way
    // round, so `data.at` — typed `Date` at every depth of the recursion —
    // is never converted on its own.
    expect(
      nodeStatements(
        makeScalarSiblingContext([
          { $ref: '#/components/schemas/Wrapper' },
          { type: 'string' },
        ]),
      ),
    ).toEqual([]);

    expect(
      nodeStatements(
        makeScalarSiblingContext([
          { type: 'string' },
          { $ref: '#/components/schemas/Wrapper' },
        ]),
      ),
    ).toEqual([]);

    expect(nodeStatements(makeMappedCyclicNodeContext())).toEqual([]);

    expect(nodeStatements(makeMappedAcyclicNodeContext()).join('\n')).toBe(
      mappedAcyclicNodeOutput,
    );
  });

  it('emits nothing when a cycle sits behind one variant and an array variant disqualifies the union', () => {
    const makeArraySiblingContext = (
      variants: NonNullable<OpenApiNonBooleanSchemaObject['anyOf']>,
    ) =>
      makeContext({
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            child: { anyOf: variants },
          },
        },
        Wrapper: {
          type: 'object',
          properties: { back: { $ref: '#/components/schemas/Node' } },
        },
      });

    expect(
      nodeStatements(
        makeArraySiblingContext([
          { $ref: '#/components/schemas/Wrapper' },
          { type: 'array', items: { type: 'string' } },
        ]),
      ),
    ).toEqual([]);

    expect(
      nodeStatements(
        makeArraySiblingContext([
          { type: 'array', items: { type: 'string' } },
          { $ref: '#/components/schemas/Wrapper' },
        ]),
      ),
    ).toEqual([]);

    expect(nodeStatements(makeMappedCyclicNodeContext())).toEqual([]);

    expect(nodeStatements(makeMappedAcyclicNodeContext()).join('\n')).toBe(
      mappedAcyclicNodeOutput,
    );
  });

  it('emits nothing when a cycle sits behind one variant and an unresolvable variant disqualifies the union', () => {
    const makeBrokenSiblingContext = (
      variants: NonNullable<OpenApiNonBooleanSchemaObject['anyOf']>,
    ) =>
      makeContext({
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            child: { anyOf: variants },
          },
        },
        Wrapper: {
          type: 'object',
          properties: { back: { $ref: '#/components/schemas/Node' } },
        },
      });

    expect(
      nodeStatements(
        makeBrokenSiblingContext([
          { $ref: '#/components/schemas/Wrapper' },
          { $ref: '#/components/schemas/DoesNotExist' },
        ]),
      ),
    ).toEqual([]);

    expect(
      nodeStatements(
        makeBrokenSiblingContext([
          { $ref: '#/components/schemas/DoesNotExist' },
          { $ref: '#/components/schemas/Wrapper' },
        ]),
      ),
    ).toEqual([]);

    // Here the mapped spelling is the identical schema, mapping the very
    // same two variants: the broken target is skipped, the good one finds
    // the cycle, and the whole schema drops.
    const mappedContext = makeContext({
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: {
            oneOf: [
              { $ref: '#/components/schemas/Wrapper' },
              { $ref: '#/components/schemas/DoesNotExist' },
            ],
            discriminator: {
              propertyName: 'kind',
              mapping: {
                wrapper: '#/components/schemas/Wrapper',
                gone: '#/components/schemas/DoesNotExist',
              },
            },
          },
        },
      },
      Wrapper: {
        type: 'object',
        properties: { back: { $ref: '#/components/schemas/Node' } },
      },
    });

    expect(nodeStatements(mappedContext)).toEqual([]);

    // Same mapped schema, cycle broken (`Wrapper.back` -> `Plain`), broken
    // mapping target left in place: a real switch, with the one resolvable
    // case in it.
    const acyclicMappedContext = makeContext({
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: {
            oneOf: [
              { $ref: '#/components/schemas/Wrapper' },
              { $ref: '#/components/schemas/DoesNotExist' },
            ],
            discriminator: {
              propertyName: 'kind',
              mapping: {
                wrapper: '#/components/schemas/Wrapper',
                gone: '#/components/schemas/DoesNotExist',
              },
            },
          },
        },
      },
      Wrapper: {
        type: 'object',
        properties: { back: { $ref: '#/components/schemas/Plain' } },
      },
      Plain: {
        type: 'object',
        properties: { seenAt: { type: 'string', format: 'date-time' } },
      },
    });

    expect(nodeStatements(acyclicMappedContext).join('\n')).toBe(
      [
        'if (data.at != null) {',
        '  data.at = new Date(data.at);',
        '}',
        'if (data.child != null) {',
        '  switch (data.child.kind) {',
        '    case "wrapper": {',
        '      if (data.child.back != null) {',
        '        if (data.child.back.seenAt != null) {',
        '          data.child.back.seenAt = new Date(data.child.back.seenAt);',
        '        }',
        '      }',
        '      break;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('reports a cycle closing on a further-out ancestor when another variant is the nearer ancestor ref', () => {
    // `Node` is a variant of its own union, so walking that variant hands
    // back `Node` — which `Node` itself then consumes. The cycle that
    // matters is the other one: `Wrapper.back` -> `Outer`, two levels out.
    // Returning only `{ Node }` from the variant loop left `Outer`
    // converting `oat` while everything under `node` stayed a string.
    const makeOuterContext = (
      variants: NonNullable<OpenApiNonBooleanSchemaObject['anyOf']>,
    ) =>
      makeContext({
        Outer: {
          type: 'object',
          properties: {
            oat: { type: 'string', format: 'date-time' },
            node: { $ref: '#/components/schemas/Node' },
          },
        },
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            child: { anyOf: variants },
          },
        },
        Wrapper: {
          type: 'object',
          properties: { back: { $ref: '#/components/schemas/Outer' } },
        },
      });

    const outerStatements = (context: ContextSpec) =>
      buildDateTransformStatements({
        schema: { $ref: '#/components/schemas/Outer' },
        accessor: 'data',
        context,
      });

    expect(
      outerStatements(
        makeOuterContext([
          { $ref: '#/components/schemas/Wrapper' },
          { $ref: '#/components/schemas/Node' },
        ]),
      ),
    ).toEqual([]);

    expect(
      outerStatements(
        makeOuterContext([
          { $ref: '#/components/schemas/Node' },
          { $ref: '#/components/schemas/Wrapper' },
        ]),
      ),
    ).toEqual([]);

    // The identical schema with `child` spelled as a mapped union.
    const mappedContext = makeContext({
      Outer: {
        type: 'object',
        properties: {
          oat: { type: 'string', format: 'date-time' },
          node: { $ref: '#/components/schemas/Node' },
        },
      },
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: {
            oneOf: [
              { $ref: '#/components/schemas/Wrapper' },
              { $ref: '#/components/schemas/Node' },
            ],
            discriminator: {
              propertyName: 'kind',
              mapping: {
                wrapper: '#/components/schemas/Wrapper',
                node: '#/components/schemas/Node',
              },
            },
          },
        },
      },
      Wrapper: {
        type: 'object',
        properties: { back: { $ref: '#/components/schemas/Outer' } },
      },
    });

    expect(outerStatements(mappedContext)).toEqual([]);

    // Both cycles broken — `Wrapper.back` -> `Plain` and the self-mapped
    // `Node` case replaced by `Plain` — and the same mapped union emits a
    // real switch three levels deep.
    const acyclicMappedContext = makeContext({
      Outer: {
        type: 'object',
        properties: {
          oat: { type: 'string', format: 'date-time' },
          node: { $ref: '#/components/schemas/Node' },
        },
      },
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: {
            oneOf: [
              { $ref: '#/components/schemas/Wrapper' },
              { $ref: '#/components/schemas/Plain' },
            ],
            discriminator: {
              propertyName: 'kind',
              mapping: {
                wrapper: '#/components/schemas/Wrapper',
                plain: '#/components/schemas/Plain',
              },
            },
          },
        },
      },
      Wrapper: {
        type: 'object',
        properties: { back: { $ref: '#/components/schemas/Plain' } },
      },
      Plain: {
        type: 'object',
        properties: { seenAt: { type: 'string', format: 'date-time' } },
      },
    });

    expect(outerStatements(acyclicMappedContext).join('\n')).toBe(
      [
        'if (data.oat != null) {',
        '  data.oat = new Date(data.oat);',
        '}',
        'if (data.node != null) {',
        '  if (data.node.at != null) {',
        '    data.node.at = new Date(data.node.at);',
        '  }',
        '  if (data.node.child != null) {',
        '    switch (data.node.child.kind) {',
        '      case "wrapper": {',
        '        if (data.node.child.back != null) {',
        '          if (data.node.child.back.seenAt != null) {',
        '            data.node.child.back.seenAt = new Date(data.node.child.back.seenAt);',
        '          }',
        '        }',
        '        break;',
        '      }',
        '      case "plain": {',
        '        if (data.node.child.seenAt != null) {',
        '          data.node.child.seenAt = new Date(data.node.child.seenAt);',
        '        }',
        '        break;',
        '      }',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('walks a disqualifying variant anyway, so a cycle only it can reach still drops the schema', () => {
    // The one variant is both array- and object-shaped, which disqualifies
    // the union outright — but its `properties` are where the cycle back to
    // `Node` lives. Judging the variant and walking it have to be separate
    // steps for this to be found at all: a walk that skipped every variant
    // it had already disqualified would convert `data.at` and leave
    // `data.child.back.at`, typed `Date` by the model, a string.
    const makeHybridContext = (back: string) =>
      makeContext({
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            child: { anyOf: [{ $ref: '#/components/schemas/Hybrid' }] },
          },
        },
        Hybrid: {
          type: 'array',
          items: { type: 'string' },
          properties: { back: { $ref: back } },
        } as OpenApiSchemaObject,
        Plain: {
          type: 'object',
          properties: { seenAt: { type: 'string', format: 'date-time' } },
        },
      });

    expect(
      nodeStatements(makeHybridContext('#/components/schemas/Node')),
    ).toEqual([]);

    // The mapped spelling of the identical schema agrees: it walks the
    // mapping target whatever shape it is, finds the same cycle, and drops
    // the whole schema.
    const makeMappedHybridContext = (back: string) =>
      makeContext({
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            child: {
              oneOf: [{ $ref: '#/components/schemas/Hybrid' }],
              discriminator: {
                propertyName: 'kind',
                mapping: { hybrid: '#/components/schemas/Hybrid' },
              },
            },
          },
        },
        Hybrid: {
          type: 'array',
          items: { type: 'string' },
          properties: { back: { $ref: back } },
        } as OpenApiSchemaObject,
        Plain: {
          type: 'object',
          properties: { seenAt: { type: 'string', format: 'date-time' } },
        },
      });

    expect(
      nodeStatements(makeMappedHybridContext('#/components/schemas/Node')),
    ).toEqual([]);

    // Cycle broken, everything else identical: a real switch.
    expect(
      nodeStatements(
        makeMappedHybridContext('#/components/schemas/Plain'),
      ).join('\n'),
    ).toBe(
      [
        'if (data.at != null) {',
        '  data.at = new Date(data.at);',
        '}',
        'if (data.child != null) {',
        '  switch (data.child.kind) {',
        '    case "hybrid": {',
        '      if (data.child.back != null) {',
        '        if (data.child.back.seenAt != null) {',
        '          data.child.back.seenAt = new Date(data.child.back.seenAt);',
        '        }',
        '      }',
        '      break;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it("emits nothing when the only path to a cycle runs through a disqualifying variant's items", () => {
    // The array variant disqualifies the union, and the cycle back to `Node`
    // is inside that variant's `items` — a place the per-property walk never
    // reads. A disqualified union emits nothing either way, so it walks its
    // variants the way the mapped spelling does (statements discarded, refs
    // kept); without that, `data.at` converted while every `back.at` under
    // `data.child`, typed `Date` by the model, stayed a string.
    const makeItemsCycleContext = (
      back: string,
      variants: NonNullable<OpenApiNonBooleanSchemaObject['anyOf']>,
    ) =>
      makeContext({
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            child: { anyOf: variants },
          },
        },
        Obj: {
          type: 'object',
          properties: { seenAt: { type: 'string', format: 'date-time' } },
        },
        Wrapper: {
          type: 'object',
          properties: { back: { $ref: back } },
        },
        Plain: {
          type: 'object',
          properties: { pickedAt: { type: 'string', format: 'date-time' } },
        },
      });

    const objVariant = { $ref: '#/components/schemas/Obj' };
    const arrayVariant = {
      type: 'array',
      items: { $ref: '#/components/schemas/Wrapper' },
    } as OpenApiSchemaObject;

    expect(
      nodeStatements(
        makeItemsCycleContext('#/components/schemas/Node', [
          objVariant,
          arrayVariant,
        ]),
      ),
    ).toEqual([]);

    expect(
      nodeStatements(
        makeItemsCycleContext('#/components/schemas/Node', [
          arrayVariant,
          objVariant,
        ]),
      ),
    ).toEqual([]);

    // Same schema, cycle broken (`Wrapper.back` -> `Plain`): the union is
    // still disqualified and still contributes nothing, but `data.at`
    // converts again — so the `[]` above is the cycle's doing, not the
    // disqualification's.
    expect(
      nodeStatements(
        makeItemsCycleContext('#/components/schemas/Plain', [
          objVariant,
          arrayVariant,
        ]),
      ).join('\n'),
    ).toBe(
      ['if (data.at != null) {', '  data.at = new Date(data.at);', '}'].join(
        '\n',
      ),
    );

    // The identical schema with `child` spelled as a mapped union: the array
    // variant becomes a named schema, which is the only difference.
    const makeMappedItemsCycleContext = (back: string) =>
      makeContext({
        Node: {
          type: 'object',
          properties: {
            at: { type: 'string', format: 'date-time' },
            child: {
              oneOf: [
                { $ref: '#/components/schemas/Obj' },
                { $ref: '#/components/schemas/Arr' },
              ],
              discriminator: {
                propertyName: 'kind',
                mapping: {
                  obj: '#/components/schemas/Obj',
                  arr: '#/components/schemas/Arr',
                },
              },
            },
          },
        },
        Obj: {
          type: 'object',
          properties: { seenAt: { type: 'string', format: 'date-time' } },
        },
        Arr: {
          type: 'array',
          items: { $ref: '#/components/schemas/Wrapper' },
        } as OpenApiSchemaObject,
        Wrapper: {
          type: 'object',
          properties: { back: { $ref: back } },
        },
        Plain: {
          type: 'object',
          properties: { pickedAt: { type: 'string', format: 'date-time' } },
        },
      });

    expect(
      nodeStatements(makeMappedItemsCycleContext('#/components/schemas/Node')),
    ).toEqual([]);

    expect(
      nodeStatements(
        makeMappedItemsCycleContext('#/components/schemas/Plain'),
      ).join('\n'),
    ).toBe(
      [
        'if (data.at != null) {',
        '  data.at = new Date(data.at);',
        '}',
        'if (data.child != null) {',
        '  switch (data.child.kind) {',
        '    case "obj": {',
        '      if (data.child.seenAt != null) {',
        '        data.child.seenAt = new Date(data.child.seenAt);',
        '      }',
        '      break;',
        '    }',
        '    case "arr": {',
        '      for (let i0 = 0; i0 < data.child.length; i0++) {',
        '        const item0 = data.child[i0];',
        '        if (item0.back != null) {',
        '          if (item0.back.pickedAt != null) {',
        '            item0.back.pickedAt = new Date(item0.back.pickedAt);',
        '          }',
        '        }',
        '      }',
        '      break;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  // ---------------------------------------------------------------------
  // Fix round 5: detect the cycle without converting.
  //
  // A variant that declares its own `properties` is *admitted* — the union
  // is not disqualified and does convert — but the per-property walk reads
  // `variantSchema.properties` and nothing else, so an `allOf` branch or a
  // nested union sitting beside those properties is never looked at. A
  // cycle hiding there was invisible to this spelling while the mapped
  // spelling of the same schema walked the branch, found it and dropped the
  // whole subtree. Those branches are now walked for their refs alone,
  // their statements discarded: the union stops converting when a cycle is
  // reachable through a branch it may not convert, and keeps converting its
  // own properties when there is none — `Base.inherited` below is never
  // converted by this spelling either way, which is the standing ruling
  // that an `allOf` variant's properties are not merged.
  // ---------------------------------------------------------------------

  const unwalkedBranchUnions = {
    structural: {
      anyOf: [
        { $ref: '#/components/schemas/V1' },
        { $ref: '#/components/schemas/V2' },
      ],
    } as OpenApiSchemaObject,
    mapped: {
      oneOf: [
        { $ref: '#/components/schemas/V1' },
        { $ref: '#/components/schemas/V2' },
      ],
      discriminator: {
        propertyName: 'kind',
        mapping: {
          v1: '#/components/schemas/V1',
          v2: '#/components/schemas/V2',
        },
      },
    } as OpenApiSchemaObject,
  };

  // `V1` is the admitted variant carrying the unwalked branch; the branch
  // points at `Cyc` (which closes a cycle back to `Node`) or at `Base`
  // (which does not).
  const makeUnwalkedBranchContext = (
    union: OpenApiSchemaObject,
    v1: OpenApiSchemaObject,
  ) =>
    makeContext({
      Node: {
        type: 'object',
        properties: {
          at: { type: 'string', format: 'date-time' },
          child: union,
        },
      },
      V1: v1,
      V2: {
        type: 'object',
        properties: { p: { type: 'string', format: 'date-time' } },
      },
      Cyc: {
        type: 'object',
        properties: { back: { $ref: '#/components/schemas/Node' } },
      },
      Base: {
        type: 'object',
        properties: { inherited: { type: 'string', format: 'date-time' } },
      },
    });

  const convertsNodeAndVariantProperty = [
    'if (data.at != null) {',
    '  data.at = new Date(data.at);',
    '}',
    'if (data.child != null) {',
    '  if ("p" in data.child && data.child.p != null) {',
    '    data.child.p = new Date(data.child.p);',
    '  }',
    '}',
  ].join('\n');

  it("emits nothing when a cycle is reachable only through an admitted variant's allOf branch", () => {
    const v1 = (branch: string): OpenApiSchemaObject => ({
      type: 'object',
      properties: { p: { type: 'string', format: 'date-time' } },
      allOf: [{ $ref: branch }],
    });

    expect(
      nodeStatements(
        makeUnwalkedBranchContext(
          unwalkedBranchUnions.structural,
          v1('#/components/schemas/Cyc'),
        ),
      ),
    ).toEqual([]);

    expect(
      nodeStatements(
        makeUnwalkedBranchContext(
          unwalkedBranchUnions.mapped,
          v1('#/components/schemas/Cyc'),
        ),
      ),
    ).toEqual([]);

    // Cycle removed, nothing else changed: the mapped spelling emits a real
    // switch (and converts the `allOf`-inherited property, which is its
    // business, not this spelling's)…
    expect(
      nodeStatements(
        makeUnwalkedBranchContext(
          unwalkedBranchUnions.mapped,
          v1('#/components/schemas/Base'),
        ),
      ).join('\n'),
    ).toBe(
      [
        'if (data.at != null) {',
        '  data.at = new Date(data.at);',
        '}',
        'if (data.child != null) {',
        '  switch (data.child.kind) {',
        '    case "v1": {',
        '      if (data.child.inherited != null) {',
        '        data.child.inherited = new Date(data.child.inherited);',
        '      }',
        '      if (data.child.p != null) {',
        '        data.child.p = new Date(data.child.p);',
        '      }',
        '      break;',
        '    }',
        '    case "v2": {',
        '      if (data.child.p != null) {',
        '        data.child.p = new Date(data.child.p);',
        '      }',
        '      break;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );

    // …and the structural spelling goes back to converting the union's own
    // declared properties, while still never converting `inherited`: the
    // branch is read for cycles, never for statements.
    expect(
      nodeStatements(
        makeUnwalkedBranchContext(
          unwalkedBranchUnions.structural,
          v1('#/components/schemas/Base'),
        ),
      ).join('\n'),
    ).toBe(convertsNodeAndVariantProperty);
  });

  it("emits nothing when a cycle is reachable only through a nested union beside a variant's own properties", () => {
    const v1 = (branch: string): OpenApiSchemaObject => ({
      type: 'object',
      properties: { p: { type: 'string', format: 'date-time' } },
      anyOf: [{ $ref: branch }],
    });

    expect(
      nodeStatements(
        makeUnwalkedBranchContext(
          unwalkedBranchUnions.structural,
          v1('#/components/schemas/Cyc'),
        ),
      ),
    ).toEqual([]);

    expect(
      nodeStatements(
        makeUnwalkedBranchContext(
          unwalkedBranchUnions.mapped,
          v1('#/components/schemas/Cyc'),
        ),
      ),
    ).toEqual([]);

    expect(
      nodeStatements(
        makeUnwalkedBranchContext(
          unwalkedBranchUnions.mapped,
          v1('#/components/schemas/Base'),
        ),
      ).join('\n'),
    ).toBe(
      [
        'if (data.at != null) {',
        '  data.at = new Date(data.at);',
        '}',
        'if (data.child != null) {',
        '  switch (data.child.kind) {',
        '    case "v1": {',
        '      if ("inherited" in data.child && data.child.inherited != null) {',
        '        data.child.inherited = new Date(data.child.inherited);',
        '      }',
        '      if (data.child.p != null) {',
        '        data.child.p = new Date(data.child.p);',
        '      }',
        '      break;',
        '    }',
        '    case "v2": {',
        '      if (data.child.p != null) {',
        '        data.child.p = new Date(data.child.p);',
        '      }',
        '      break;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );

    expect(
      nodeStatements(
        makeUnwalkedBranchContext(
          unwalkedBranchUnions.structural,
          v1('#/components/schemas/Base'),
        ),
      ).join('\n'),
    ).toBe(convertsNodeAndVariantProperty);
  });

  it('keeps converting an admitted variant whose additionalProperties hide a cycle, exactly as the mapped spelling does', () => {
    // Rule 1 suppresses a map that sits beside declared properties for every
    // path in this file, the mapped spelling included, so neither spelling
    // ever walks these values and neither sees the cycle under them. They
    // agree, which is the property this walk is responsible for; pinning it
    // so a later "detect everywhere" change cannot make this spelling alone
    // start dropping the schema without the disagreement being noticed.
    const v1: OpenApiSchemaObject = {
      type: 'object',
      properties: { p: { type: 'string', format: 'date-time' } },
      additionalProperties: { $ref: '#/components/schemas/Cyc' },
    };

    expect(
      nodeStatements(
        makeUnwalkedBranchContext(unwalkedBranchUnions.structural, v1),
      ).join('\n'),
    ).toBe(convertsNodeAndVariantProperty);

    expect(
      nodeStatements(
        makeUnwalkedBranchContext(unwalkedBranchUnions.mapped, v1),
      ).join('\n'),
    ).toBe(
      [
        'if (data.at != null) {',
        '  data.at = new Date(data.at);',
        '}',
        'if (data.child != null) {',
        '  switch (data.child.kind) {',
        '    case "v1": {',
        '      if (data.child.p != null) {',
        '        data.child.p = new Date(data.child.p);',
        '      }',
        '      break;',
        '    }',
        '    case "v2": {',
        '      if (data.child.p != null) {',
        '        data.child.p = new Date(data.child.p);',
        '      }',
        '      break;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  // A property named after an `Object.prototype` member is a realistic field
  // name (`constructor` most of all), and it used to take the whole
  // generation down: the keys were collected with `Object.keys` (own keys
  // only) but the declaring-variant filter asked
  // `variantSchema.properties?.[key] !== undefined`, which walks the
  // prototype chain. The variant that never declared `constructor` answered
  // `Object.prototype.constructor`, passed the filter, and the per-key map —
  // which really does only hold own keys — handed back `undefined`, throwing
  // `Cannot read properties of undefined (reading 'cyclicRefs')` for the
  // whole spec. The results are now read from the per-key map itself, so
  // there is only one source of truth about which variants declared a key.
  const makePrototypeNameContext = (
    declared: OpenApiSchemaObject,
  ): ContextSpec =>
    makeContext({
      Vehicle: {
        type: 'object',
        properties: {
          constructor: declared,
          registeredOn: { type: 'string', format: 'date' },
        },
      },
      Trailer: {
        type: 'object',
        properties: { registeredOn: { type: 'string', format: 'date' } },
      },
    });

  const prototypeNameUnion: OpenApiSchemaObject = {
    anyOf: [
      { $ref: '#/components/schemas/Vehicle' },
      { $ref: '#/components/schemas/Trailer' },
    ],
  };

  const convertsRegisteredOn = [
    'if ("registeredOn" in data && data.registeredOn != null) {',
    '  data.registeredOn = new Date(data.registeredOn);',
    '}',
  ].join('\n');

  it('does not crash when only one variant declares a property named after an Object.prototype member', () => {
    const context = makePrototypeNameContext({ type: 'string' });

    expect(
      buildDateTransformStatements({
        schema: prototypeNameUnion,
        accessor: 'data',
        context,
      }).join('\n'),
    ).toBe(convertsRegisteredOn);

    // Variant order must not matter either: the undeclaring variant passed
    // the old prototype-chain filter whichever side of the union it sat on.
    expect(
      buildDateTransformStatements({
        schema: {
          anyOf: [
            { $ref: '#/components/schemas/Trailer' },
            { $ref: '#/components/schemas/Vehicle' },
          ],
        },
        accessor: 'data',
        context,
      }).join('\n'),
    ).toBe(convertsRegisteredOn);

    expect(
      buildRequestDateSerializeStatements({
        schema: prototypeNameUnion,
        accessor: 'data',
        context,
      }).join('\n'),
    ).toBe(
      [
        'if ("registeredOn" in data && data.registeredOn != null) {',
        '  data.registeredOn = data.registeredOn instanceof Date ? (data.registeredOn.toISOString().slice(0, 10) as unknown as Date) : data.registeredOn;',
        '}',
      ].join('\n'),
    );
  });

  // With the crash gone, such a key must still emit nothing, because the
  // guard the structural walk is obliged to use is `'key' in accessor` —
  // the only form TypeScript narrows the union by — and `in` walks the
  // prototype chain, so `'constructor' in payload` is true for a `Trailer`
  // that never carried the field. The conversion would then run on the
  // inherited `Object` function and write `Invalid Date` over it. The rest
  // of the union has to keep converting.
  it('emits nothing for a date property named after an Object.prototype member, and still converts its siblings', () => {
    const context = makePrototypeNameContext({
      type: 'string',
      format: 'date',
    });

    const statements = buildDateTransformStatements({
      schema: prototypeNameUnion,
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(convertsRegisteredOn);
    expect(statements.join('\n')).not.toContain('constructor');

    // Not a "only one variant declares it" special case either: every
    // variant declaring the property changes nothing, since `in` is no more
    // truthful about it.
    const bothDeclare = makeContext({
      Vehicle: {
        type: 'object',
        properties: {
          toString: { type: 'string' as const, format: 'date' },
          registeredOn: { type: 'string', format: 'date' },
        },
      },
      Trailer: {
        type: 'object',
        properties: {
          toString: { type: 'string' as const, format: 'date' },
          registeredOn: { type: 'string', format: 'date' },
        },
      },
    });

    const shared = buildDateTransformStatements({
      schema: prototypeNameUnion,
      accessor: 'data',
      context: bothDeclare,
    });

    expect(shared.join('\n')).toBe(convertsRegisteredOn);
    expect(shared.join('\n')).not.toContain('toString');
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
    } satisfies OpenApiSchemaObject;

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
    } satisfies OpenApiSchemaObject;

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
    } satisfies OpenApiSchemaObject;

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
    } satisfies OpenApiSchemaObject;
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
        properties: {
          parent: { $ref: '#/components/schemas/Parent' },
        },
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
    } satisfies OpenApiSchemaObject;

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
    } satisfies OpenApiSchemaObject;

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
    } satisfies OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([]);
  });
});

describe('buildDateTransformStatements — additionalProperties maps', () => {
  it('writes date-only map values back through the key', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['days'],
      properties: {
        days: {
          type: 'object',
          additionalProperties: { type: 'string', format: 'date' },
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
      'if (data.days != null) {',
      '  for (const key0 of Object.keys(data.days)) {',
      '    data.days[key0] = new Date(data.days[key0]);',
      '  }',
      '}',
    ]);
  });

  it('hoists map values holding an object into a const', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['fills'],
      properties: {
        fills: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['recordedOn'],
            properties: {
              recordedOn: { type: 'string', format: 'date-time' },
            },
          },
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
      'if (data.fills != null) {',
      '  for (const key0 of Object.keys(data.fills)) {',
      '    const item0 = data.fills[key0];',
      '    item0.recordedOn = new Date(item0.recordedOn);',
      '  }',
      '}',
    ]);
  });

  it('runs the discriminated-union switch inside the map loop', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        required: ['vaccinatedAt'],
        properties: { vaccinatedAt: { type: 'string', format: 'date-time' } },
      },
      Dog: {
        type: 'object',
        properties: {
          adoptedAt: { type: ['string', 'null'], format: 'date-time' },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['pets'],
      properties: {
        pets: {
          type: 'object',
          additionalProperties: {
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
          } satisfies OpenApiSchemaObject,
        },
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'if (data.pets != null) {',
      '  for (const key0 of Object.keys(data.pets)) {',
      '    const item0 = data.pets[key0];',
      '    switch (item0.petType) {',
      '      case "cat": {',
      '        item0.vaccinatedAt = new Date(item0.vaccinatedAt);',
      '        break;',
      '      }',
      '      case "dog": {',
      '        if (item0.adoptedAt != null) {',
      '          item0.adoptedAt = new Date(item0.adoptedAt);',
      '        }',
      '        break;',
      '      }',
      '    }',
      '  }',
      '}',
    ]);
  });

  // Pinned against pre-fix behaviour: an undiscriminated union used to
  // contribute nothing at all. Each variant here declares a different,
  // non-overlapping property, so both convert — each guarded by its own
  // presence check, exactly as a property only one variant declares does
  // wherever it appears in the structural walk.
  it('walks a map whose values are an undiscriminated union structurally', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        pets: {
          type: 'object',
          additionalProperties: {
            anyOf: [
              {
                type: 'object',
                properties: { at: { type: 'string', format: 'date-time' } },
              },
              {
                type: 'object',
                properties: { on: { type: 'string', format: 'date' } },
              },
            ],
          } satisfies OpenApiSchemaObject,
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
      'if (data.pets != null) {',
      '  for (const key0 of Object.keys(data.pets)) {',
      '    const item0 = data.pets[key0];',
      '    if ("at" in item0 && item0.at != null) {',
      '      item0.at = new Date(item0.at);',
      '    }',
      '    if ("on" in item0 && item0.on != null) {',
      '      item0.on = new Date(item0.on);',
      '    }',
      '  }',
      '}',
    ]);
  });

  it('suppresses the map when a oneOf/discriminator union sits beside additionalProperties, leaving the switch unaffected', () => {
    // The idiomatic discriminated-union spelling: `oneOf` + `discriminator`
    // directly beside `additionalProperties`, no `allOf`, no direct
    // `properties`. Each variant declares its own properties at this same
    // level (merged as a union by the getter's type), so a blind
    // Object.keys loop is exactly as unsafe here as with `properties` or an
    // `allOf` branch — it would revisit (and corrupt) the discriminator key
    // and whatever the switch just converted.
    const context = makeContext({
      A: {
        type: 'object',
        required: ['at'],
        properties: { at: { type: 'string', format: 'date-time' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      oneOf: [{ $ref: '#/components/schemas/A' }],
      discriminator: {
        propertyName: 'type',
        mapping: { a: '#/components/schemas/A' },
      },
      additionalProperties: { type: 'string', format: 'date-time' },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'switch (data.type) {',
      '  case "a": {',
      '    data.at = new Date(data.at);',
      '    break;',
      '  }',
      '}',
    ]);
  });

  it('suppresses the map when an anyOf/discriminator union sits beside additionalProperties', () => {
    const context = makeContext({
      A: {
        type: 'object',
        required: ['at'],
        properties: { at: { type: 'string', format: 'date-time' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      anyOf: [{ $ref: '#/components/schemas/A' }],
      discriminator: {
        propertyName: 'type',
        mapping: { a: '#/components/schemas/A' },
      },
      additionalProperties: { type: 'string', format: 'date-time' },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'switch (data.type) {',
      '  case "a": {',
      '    data.at = new Date(data.at);',
      '    break;',
      '  }',
      '}',
    ]);
  });

  it('still walks a map that is a property of a union variant, one level inside the switch case (must not regress)', () => {
    // The variant's own accessor (guarded by the discriminator) suppresses a
    // map loop directly on itself, but a property nested one level inside
    // that variant starts a fresh object level — exactly like an `allOf`
    // branch's own nested properties — and must still be walked as a map.
    const context = makeContext({
      Cat: {
        type: 'object',
        required: ['fills'],
        properties: {
          fills: {
            type: 'object',
            additionalProperties: { type: 'string', format: 'date-time' },
          },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Cat' }],
      discriminator: {
        propertyName: 'kind',
        mapping: { cat: '#/components/schemas/Cat' },
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'switch (data.kind) {',
      '  case "cat": {',
      '    if (data.fills != null) {',
      '      for (const key0 of Object.keys(data.fills)) {',
      '        data.fills[key0] = new Date(data.fills[key0]);',
      '      }',
      '    }',
      '    break;',
      '  }',
      '}',
    ]);
  });

  it('still guards a nullable map spelled as an OAS 3.1 anyOf null branch (must not regress)', () => {
    // `mapValueSchema`/`declaresProperties` must not mistake the wrapper's
    // own `anyOf` (unwrapped by `normalizeSchema` before this decision is
    // made) for a union sitting beside `additionalProperties`.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        labels: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: { type: 'string', format: 'date-time' },
            },
            { type: 'null' },
          ],
        } satisfies OpenApiSchemaObject,
      },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'if (data.labels != null) {',
      '  for (const key0 of Object.keys(data.labels)) {',
      '    data.labels[key0] = new Date(data.labels[key0]);',
      '  }',
      '}',
    ]);
  });

  it('walks only the declared properties when a schema has both properties and additionalProperties (Rule 1)', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['createdAt'],
      properties: { createdAt: { type: 'string', format: 'date-time' } },
      additionalProperties: { type: 'string', format: 'date-time' },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual(['data.createdAt = new Date(data.createdAt);']);
  });

  it('emits nothing for additionalProperties: true or additionalProperties: false (Rule 2)', () => {
    expect(
      buildDateTransformStatements({
        schema: { type: 'object', additionalProperties: true },
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([]);
    expect(
      buildDateTransformStatements({
        schema: { type: 'object', additionalProperties: false },
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('guards a nullable map and nullable map values', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        labels: {
          type: ['object', 'null'],
          additionalProperties: {
            type: ['string', 'null'],
            format: 'date-time',
          },
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
      'if (data.labels != null) {',
      '  for (const key0 of Object.keys(data.labels)) {',
      '    if (data.labels[key0] != null) {',
      '      data.labels[key0] = new Date(data.labels[key0]);',
      '    }',
      '  }',
      '}',
    ]);
  });

  it('emits nothing for a recursive map, like every other cyclic shape', () => {
    const context = makeContext({
      Node: {
        type: 'object',
        additionalProperties: {
          $ref: '#/components/schemas/Node',
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

  it('names key/item locals by depth so a map inside an array inside a map does not shadow', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['outer'],
      properties: {
        outer: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: { type: 'string', format: 'date-time' },
            },
          },
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
      'if (data.outer != null) {',
      '  for (const key0 of Object.keys(data.outer)) {',
      '    const item0 = data.outer[key0];',
      '    for (let i1 = 0; i1 < item0.length; i1++) {',
      '      const item1 = item0[i1];',
      '      for (const key2 of Object.keys(item1)) {',
      '        item1[key2] = new Date(item1[key2]);',
      '      }',
      '    }',
      '  }',
      '}',
    ]);
  });

  it('suppresses the map when additionalProperties sits inside an allOf branch beside a properties-declaring one', () => {
    // The idiomatic "extend a base, allow extra typed keys" spelling:
    // `allOf: [Base, { additionalProperties }]`. Base's properties are
    // merged into the same object by the intersection type, so a blind
    // Object.keys loop from the additionalProperties branch would also
    // revisit and corrupt them.
    const context = makeContext({
      AuditFields: {
        type: 'object',
        required: ['createdAt'],
        properties: {
          createdAt: { type: 'string', format: 'date-time' },
          label: { type: 'string' },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/AuditFields' },
        {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['recordedOn'],
            properties: {
              recordedOn: { type: 'string', format: 'date-time' },
            },
          },
        },
      ],
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual(['data.createdAt = new Date(data.createdAt);']);
  });

  it('suppresses the map when additionalProperties sits beside an allOf whose branch declares properties', () => {
    // The sibling spelling: `{ allOf: [Base], additionalProperties }` on the
    // very same schema object.
    const context = makeContext({
      AuditFields: {
        type: 'object',
        required: ['createdAt'],
        properties: { createdAt: { type: 'string', format: 'date-time' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [{ $ref: '#/components/schemas/AuditFields' }],
      additionalProperties: {
        type: 'object',
        required: ['recordedOn'],
        properties: { recordedOn: { type: 'string', format: 'date-time' } },
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual(['data.createdAt = new Date(data.createdAt);']);
  });

  it('still walks the map when allOf branches declare no properties of their own', () => {
    // The case a careless "any allOf means suppress" fix would over-suppress:
    // no branch anywhere in the composition declares properties, so the map
    // is exactly as safe to walk as if allOf weren't there at all.
    const context = makeContext({
      Taggable: { type: 'object', description: 'marker, no properties' },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [{ $ref: '#/components/schemas/Taggable' }],
      additionalProperties: { type: 'string', format: 'date-time' },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'for (const key0 of Object.keys(data)) {',
      '  data[key0] = new Date(data[key0]);',
      '}',
    ]);
  });

  it('emits nothing when propertyNames narrows the keys alongside additionalProperties', () => {
    // getters/object.ts types this as Partial<Record<K, V>>, not an index
    // signature — Object.keys() (typed string) can't index it without a
    // TS7053, and even a correctly-typed key would read V | undefined.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: { enum: ['a', 'b'] },
      additionalProperties: { type: 'string', format: 'date-time' },
    } satisfies OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('emits nothing when propertyNames narrows the keys via a const', () => {
    // Same rationale as the enum case above: getters/object.ts also types a
    // single-literal `const` as `Partial<Record<K, V>>`.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: { const: 'a' },
      additionalProperties: { type: 'string', format: 'date-time' },
    } satisfies OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('emits nothing when propertyNames is a $ref to a string enum component', () => {
    // The case a hand-rolled "does propertyNames narrow?" check would most
    // likely miss: the narrowing isn't inline, it's resolved through a
    // $ref. getters/object.ts (getPropertyNamesKeyType) still types this as
    // Partial<Record<SomeStringEnum, V>>, so the map must stay suppressed —
    // proving the date transform reuses that same resolution rather than
    // re-deriving its own, narrower predicate.
    const context = makeContext({
      SomeStringEnum: { type: 'string', enum: ['a', 'b'] },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        $ref: '#/components/schemas/SomeStringEnum',
      },
      additionalProperties: { type: 'string', format: 'date-time' },
    } satisfies OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([]);
  });

  it('walks the map when propertyNames only constrains format, not enumerable keys', () => {
    // getters/object.ts types `propertyNames: { format: 'uuid' }` as a plain
    // index signature ([key: string]: V), not Partial<Record<...>> — the
    // narrowing predicate only fires for enum/const/$ref-to-string-enum.
    // Object.keys() indexes a plain index signature fine, so this map must
    // still be walked.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['ids'],
      properties: {
        ids: {
          type: 'object',
          propertyNames: { format: 'uuid' },
          additionalProperties: { type: 'string', format: 'date' },
        } satisfies OpenApiSchemaObject,
      },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'if (data.ids != null) {',
      '  for (const key0 of Object.keys(data.ids)) {',
      '    data.ids[key0] = new Date(data.ids[key0]);',
      '  }',
      '}',
    ]);
  });

  it('walks the map when propertyNames only constrains a pattern, not enumerable keys', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['headers'],
      properties: {
        headers: {
          type: 'object',
          propertyNames: { pattern: '^x-' },
          additionalProperties: { type: 'string', format: 'date-time' },
        } satisfies OpenApiSchemaObject,
      },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'if (data.headers != null) {',
      '  for (const key0 of Object.keys(data.headers)) {',
      '    data.headers[key0] = new Date(data.headers[key0]);',
      '  }',
      '}',
    ]);
  });

  it('walks a uuid-keyed map: additionalProperties + propertyNames: { format: uuid }, values a discriminated oneOf, wrapped in a nullable anyOf', () => {
    // A nullable map keyed by uuid whose values are a discriminated union:
    //   pets:
    //     anyOf:
    //       - type: object
    //         additionalProperties: { oneOf: [IntakeCat, IntakeDog], discriminator: {...} }
    //         propertyNames: { format: uuid }
    //       - type: null
    // orval types the non-null branch as a plain index signature (uuid keys
    // don't narrow), so this must be walked end to end: unwrap the anyOf
    // null spelling, guard the nullable property, loop the map, and run the
    // discriminator switch inside it.
    const context = makeContext({
      IntakeCat: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
      IntakeDog: {
        type: 'object',
        required: ['vaccinatedAt'],
        properties: { vaccinatedAt: { type: 'string', format: 'date-time' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['pets'],
      properties: {
        pets: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: {
                oneOf: [
                  { $ref: '#/components/schemas/IntakeCat' },
                  { $ref: '#/components/schemas/IntakeDog' },
                ],
                discriminator: {
                  propertyName: 'petType',
                  mapping: {
                    cat: '#/components/schemas/IntakeCat',
                    dog: '#/components/schemas/IntakeDog',
                  },
                },
              } satisfies OpenApiSchemaObject,
              propertyNames: { format: 'uuid' },
            },
            { type: 'null' },
          ],
        } satisfies OpenApiSchemaObject,
      },
    };

    expect(
      buildDateTransformStatements({ schema, accessor: 'data', context }),
    ).toEqual([
      'if (data.pets != null) {',
      '  for (const key0 of Object.keys(data.pets)) {',
      '    const item0 = data.pets[key0];',
      '    switch (item0.petType) {',
      '      case "dog": {',
      '        item0.vaccinatedAt = new Date(item0.vaccinatedAt);',
      '        break;',
      '      }',
      '    }',
      '  }',
      '}',
    ]);
  });

  it('still converts the array when additionalProperties is the empty-object "extra keys allowed" idiom (must not regress)', () => {
    // `additionalProperties: {}` is the common "any extra keys are fine"
    // idiom, not a value schema for a real map — it has no keys of its own
    // to contribute a conversion for. It must not be mistaken for a
    // map-shaped sibling of `items` and trigger the array/map conflict drop
    // below.
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const, format: 'date' },
      additionalProperties: {},
    } satisfies OpenApiSchemaObject;

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

  it('still converts the array when additionalProperties is an empty array (must not regress)', () => {
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const, format: 'date' },
    } satisfies OpenApiSchemaObject;
    if (typeof schema === 'object') {
      Object.assign(schema, { additionalProperties: [] });
    }

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

  it('emits nothing for a schema that is both array-shaped and map-shaped', () => {
    // Nonsensical JSON Schema, but orval still types it, so without a guard
    // both an index loop and a key loop would be emitted over `data`. Unlike
    // the empty-object/empty-array idioms above, this `additionalProperties`
    // is a genuine value schema (it has its own `properties`), so the
    // conflict guard must still fire.
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const, format: 'date-time' },
      additionalProperties: {
        type: 'object' as const,
        required: ['recordedOn'],
        properties: {
          recordedOn: { type: 'string' as const, format: 'date-time' },
        },
      },
    } satisfies OpenApiSchemaObject;

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('emits nothing when a schema is array-shaped through allOf and also carries a map-valued additionalProperties', () => {
    // c190412d6 taught isArrayShaped to look through allOf for `items`, not
    // just a sibling `items` key. The array/object conflict guard reuses
    // that same isArrayShaped call for the map case, so a schema that is
    // array-shaped only via an allOf branch must still be caught — in both
    // directions, since the map branch of the conflict guard (unlike the
    // dropArrayObjectConflict branch) is not gated by mode.
    const context = makeContext({
      ArrayBase: { type: 'array', items: { type: 'string', format: 'date' } },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [{ $ref: '#/components/schemas/ArrayBase' }],
      additionalProperties: { type: 'string', format: 'date' },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context,
      }),
    ).toEqual([]);
  });

  it('guards a required map property in the response direction too', () => {
    // The response direction now null-guards required containers the same
    // way the request direction always has (the guardRequiredContainers mode
    // seam was removed) — a required map property's in-place key loop must
    // be wrapped in an `if (<accessor> != null)` guard.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['pets'],
      properties: {
        pets: {
          type: 'object',
          additionalProperties: { type: 'string', format: 'date' },
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
      'if (data.pets != null) {',
      '  for (const key0 of Object.keys(data.pets)) {',
      '    data.pets[key0] = new Date(data.pets[key0]);',
      '  }',
      '}',
    ]);
  });

  it('executes the guarded deserializer at runtime for an omitted required map property', () => {
    // Executed counterpart to the statement-level test above, mirroring the
    // request direction's own "omitted required map property" runtime test:
    // build a real deserializer for a body with a required
    // `additionalProperties` map, strip the TS-only annotations, run it on a
    // payload that omits the map, and confirm it neither throws nor
    // fabricates the key.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['pets'],
      properties: {
        pets: {
          type: 'object',
          additionalProperties: { type: 'string', format: 'date' },
        },
      },
    };

    const result = generateResponseDateDeserializer({
      operationName: 'updateShelterIntake',
      response: makeResponse({ successTypes: [{ originalSchema: schema }] }),
      context: makeContext(),
    });

    expect(result).toBeDefined();

    const runnable = result!.implementation.replace(
      /\(data: [^)]*\): [^=]*=>/,
      '(data) =>',
    );

    const fn = vm.runInThisContext(
      `(() => {\n${runnable}\nreturn ${result!.name};\n})()`,
    ) as (data: Record<string, unknown>) => Record<string, unknown>;

    const input = {};

    expect(() => fn(input)).not.toThrow();
    const output = fn(input);
    expect(output).toEqual({});
    expect('pets' in output).toBe(false);
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
          adoptedAt: { type: ['string', 'null'], format: 'date-time' },
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

describe('buildRequestDateSerializeStatements', () => {
  it('formats a required date-only property as a UTC calendar day', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['day'],
      properties: { day: { type: 'string', format: 'date' } },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      'copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;',
    );
  });

  it('emits nothing for date-time, which toJSON already serializes correctly', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['at'],
      properties: { at: { type: 'string', format: 'date-time' } },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('guards an optional date-only property', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: { day: { type: 'string', format: 'date' } },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.day != null) {',
        '  copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;',
        '}',
      ].join('\n'),
    );
  });

  it('copies a nested object before writing into it', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['nested'],
      properties: {
        nested: {
          type: 'object',
          required: ['day'],
          properties: { day: { type: 'string', format: 'date' } },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.nested != null) {',
        '  copy.nested = { ...copy.nested };',
        '  copy.nested.day = copy.nested.day instanceof Date ? (copy.nested.day.toISOString().slice(0, 10) as unknown as Date) : copy.nested.day;',
        '}',
      ].join('\n'),
    );
  });

  it('maps an array of date-only items without copying each element', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['days'],
      properties: {
        days: { type: 'array', items: { type: 'string', format: 'date' } },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.days != null) {',
        '  copy.days = copy.days.map((item0) => {',
        '    let value0 = item0;',
        '    value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
        '    return value0;',
        '  });',
        '}',
      ].join('\n'),
    );
  });

  it('maps a nested array of arrays, reassigning each level through its own let binding', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['grid'],
      properties: {
        grid: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'string', format: 'date' },
          },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.grid != null) {',
        '  copy.grid = copy.grid.map((item0) => {',
        '    let value0 = item0;',
        '    value0 = value0.map((item1) => {',
        '      let value1 = item1;',
        '      value1 = value1 instanceof Date ? (value1.toISOString().slice(0, 10) as unknown as Date) : value1;',
        '      return value1;',
        '    });',
        '    return value0;',
        '  });',
        '}',
      ].join('\n'),
    );
  });

  it('copies each element of an array of objects', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['periods'],
      properties: {
        periods: {
          type: 'array',
          items: {
            type: 'object',
            required: ['start'],
            properties: { start: { type: 'string', format: 'date' } },
          },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.periods != null) {',
        '  copy.periods = copy.periods.map((item0) => {',
        '    let value0 = item0;',
        '    value0 = { ...value0 };',
        '    value0.start = value0.start instanceof Date ? (value0.start.toISOString().slice(0, 10) as unknown as Date) : value0.start;',
        '    return value0;',
        '  });',
        '}',
      ].join('\n'),
    );
  });

  it('guards nullable array elements inside the map callback', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['periods'],
      properties: {
        periods: {
          type: 'array',
          items: {
            type: ['object', 'null'],
            required: ['start'],
            properties: { start: { type: 'string', format: 'date' } },
          },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.periods != null) {',
        '  copy.periods = copy.periods.map((item0) => {',
        '    if (item0 == null) return item0;',
        '    let value0 = item0;',
        '    value0 = { ...value0 };',
        '    value0.start = value0.start instanceof Date ? (value0.start.toISOString().slice(0, 10) as unknown as Date) : value0.start;',
        '    return value0;',
        '  });',
        '}',
      ].join('\n'),
    );
  });

  it('emits nothing for a recursive schema rather than a partial conversion', () => {
    const context = makeContext({
      Node: {
        type: 'object',
        required: ['day', 'child'],
        properties: {
          day: { type: 'string', format: 'date' },
          child: { $ref: '#/components/schemas/Node' },
        },
      },
    });

    expect(
      buildRequestDateSerializeStatements({
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'copy',
        context,
      }),
    ).toEqual([]);
  });

  it('resolves an OAS 3.1 nullable date-only property', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['day'],
      properties: {
        day: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.day != null) {',
        '  copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;',
        '}',
      ].join('\n'),
    );
  });

  it('leaves the response direction untouched', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['day'],
      properties: { day: { type: 'string', format: 'date' } },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }).join('\n'),
    ).toBe('data.day = new Date(data.day);');
  });

  it('skips a readOnly date-only property, converting only the writable sibling', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['day', 'recordedAt'],
      properties: {
        day: { type: 'string', format: 'date' },
        recordedAt: { type: 'string', format: 'date', readOnly: true },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      'copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;',
    );
  });

  it('emits nothing when the only date-only property is readOnly', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['recordedAt'],
      properties: {
        recordedAt: { type: 'string', format: 'date', readOnly: true },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('resolves readOnly through a $ref before deciding to skip', () => {
    const context = makeContext({
      RecordedAt: { type: 'string', format: 'date', readOnly: true },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['day', 'recordedAt'],
      properties: {
        day: { type: 'string', format: 'date' },
        recordedAt: { $ref: '#/components/schemas/RecordedAt' },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }).join('\n'),
    ).toBe(
      'copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;',
    );
  });

  it('converts an allOf-inherited property re-declared by a sibling branch idempotently, twice', () => {
    // A very common spec idiom: re-declaring an inherited property just to
    // add a description. `visitedRefs` is cleared on the way out of the
    // `Base` branch (so a later, unrelated cycle isn't mistaken for one),
    // and `mergeResults` doesn't dedup, so `createdOn` is converted once by
    // each allOf branch. Without the `instanceof Date` guard the second
    // statement would call `.toISOString()` on the string the first one
    // just produced and throw at runtime.
    const context = makeContext({
      Base: {
        type: 'object',
        required: ['createdOn'],
        properties: { createdOn: { type: 'string', format: 'date' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/Base' },
        {
          type: 'object',
          required: ['createdOn'],
          properties: {
            createdOn: {
              type: 'string',
              format: 'date',
              description: 'when it was made',
            },
          },
        },
      ],
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }),
    ).toEqual([
      'copy.createdOn = copy.createdOn instanceof Date ? (copy.createdOn.toISOString().slice(0, 10) as unknown as Date) : copy.createdOn;',
      'copy.createdOn = copy.createdOn instanceof Date ? (copy.createdOn.toISOString().slice(0, 10) as unknown as Date) : copy.createdOn;',
    ]);
  });

  it('converts a property re-declared by both a discriminated-union variant and the parent schema idempotently, twice', () => {
    // The switch case (from the variant) and the sibling property statement
    // (from the parent schema's own `properties`) both convert the same
    // accessor — the same double-conversion hazard as the allOf case above,
    // but the two statements are textually different (one is wrapped in a
    // `case` block), so a plain dedup of the merged statement list would not
    // catch this shape. The fix must live at the leaf.
    const context = makeContext({
      Variant: {
        type: 'object',
        required: ['madeOn'],
        properties: { madeOn: { type: 'string', format: 'date' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Variant' }],
      discriminator: {
        propertyName: 'kind',
        mapping: { v: '#/components/schemas/Variant' },
      },
      required: ['madeOn'],
      properties: {
        madeOn: {
          type: 'string',
          format: 'date',
          description: 'redeclared on the parent',
        },
      },
    } satisfies OpenApiSchemaObject;

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }).join('\n'),
    ).toBe(
      [
        'switch (copy.kind) {',
        '  case "v": {',
        '    copy.madeOn = copy.madeOn instanceof Date ? (copy.madeOn.toISOString().slice(0, 10) as unknown as Date) : copy.madeOn;',
        '    break;',
        '  }',
        '}',
        'copy.madeOn = copy.madeOn instanceof Date ? (copy.madeOn.toISOString().slice(0, 10) as unknown as Date) : copy.madeOn;',
      ].join('\n'),
    );
  });

  it('does not emit a blind Object.keys loop for a discriminated-union variant that is a bare map', () => {
    // Mirrors the response-direction test of the same name above: a variant
    // that is only `additionalProperties` (no `properties` of its own) must
    // not get a blind key loop over the discriminator-carrying accessor.
    const context = makeContext({
      Variant: {
        type: 'object',
        required: ['madeOn'],
        properties: { madeOn: { type: 'string', format: 'date' } },
      },
      Extras: {
        type: 'object',
        additionalProperties: { type: 'string', format: 'date' },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [
        { $ref: '#/components/schemas/Variant' },
        { $ref: '#/components/schemas/Extras' },
      ],
      discriminator: {
        propertyName: 'kind',
        mapping: {
          v: '#/components/schemas/Variant',
          extras: '#/components/schemas/Extras',
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }),
    ).toEqual([
      'switch (copy.kind) {',
      '  case "v": {',
      '    copy.madeOn = copy.madeOn instanceof Date ? (copy.madeOn.toISOString().slice(0, 10) as unknown as Date) : copy.madeOn;',
      '    break;',
      '  }',
      '}',
    ]);
  });

  it('emits nothing for a root schema that is both array- and object-shaped', () => {
    // OAS 3.1 `type: ['array', 'object']`, or a hand-maintained spec with a
    // stray sibling `properties`. `.map` already builds the new array; a
    // `const copy` reassigned to that `.map` result does not compile, so the
    // whole subtree emits nothing rather than broken code.
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const, format: 'date' },
      properties: { count: { type: 'string' as const, format: 'date' } },
    } satisfies OpenApiSchemaObject;

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('contributes no statements for a property that is both array- and object-shaped, leaving siblings converted', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['day', 'hybrid'],
      properties: {
        day: { type: 'string', format: 'date' },
        hybrid: {
          type: 'array',
          items: { type: 'string', format: 'date' },
          properties: { count: { type: 'string', format: 'date' } },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([
      'copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;',
    ]);
  });

  it('leaves the response direction combining items and properties on the same schema unchanged', () => {
    // Proves the array/object-conflict guard is request-only: the response
    // direction may freely combine an in-place array loop with property
    // writes on the same schema.
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const, format: 'date-time' },
      properties: { count: { type: 'string' as const, format: 'date-time' } },
    } satisfies OpenApiSchemaObject;

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
      'if (data.count != null) {',
      '  data.count = new Date(data.count);',
      '}',
    ]);
  });
});

describe('buildRequestDateSerializeStatements — additionalProperties maps', () => {
  it('serializes date-only map values in place after copying the map', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['days'],
      properties: {
        days: {
          type: 'object',
          additionalProperties: { type: 'string', format: 'date' },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.days != null) {',
        '  copy.days = { ...copy.days };',
        '  for (const key0 of Object.keys(copy.days)) {',
        '    let value0 = copy.days[key0];',
        '    value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
        '    copy.days[key0] = value0;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('copies each map value holding an object before writing into it', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['fills'],
      properties: {
        fills: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['recordedOn'],
            properties: { recordedOn: { type: 'string', format: 'date' } },
          },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.fills != null) {',
        '  copy.fills = { ...copy.fills };',
        '  for (const key0 of Object.keys(copy.fills)) {',
        '    let value0 = copy.fills[key0];',
        '    value0 = { ...value0 };',
        '    value0.recordedOn = value0.recordedOn instanceof Date ? (value0.recordedOn.toISOString().slice(0, 10) as unknown as Date) : value0.recordedOn;',
        '    copy.fills[key0] = value0;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('runs the discriminated-union switch inside the map loop', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        required: ['vaccinatedOn'],
        properties: { vaccinatedOn: { type: 'string', format: 'date' } },
      },
      Dog: {
        type: 'object',
        properties: {
          adoptedOn: { type: ['string', 'null'], format: 'date' },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['pets'],
      properties: {
        pets: {
          type: 'object',
          additionalProperties: {
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
          } satisfies OpenApiSchemaObject,
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }).join('\n'),
    ).toBe(
      [
        'if (copy.pets != null) {',
        '  copy.pets = { ...copy.pets };',
        '  for (const key0 of Object.keys(copy.pets)) {',
        '    let value0 = copy.pets[key0];',
        '    value0 = { ...value0 };',
        '    switch (value0.petType) {',
        '      case "cat": {',
        '        value0.vaccinatedOn = value0.vaccinatedOn instanceof Date ? (value0.vaccinatedOn.toISOString().slice(0, 10) as unknown as Date) : value0.vaccinatedOn;',
        '        break;',
        '      }',
        '      case "dog": {',
        '        if (value0.adoptedOn != null) {',
        '          value0.adoptedOn = value0.adoptedOn instanceof Date ? (value0.adoptedOn.toISOString().slice(0, 10) as unknown as Date) : value0.adoptedOn;',
        '        }',
        '        break;',
        '      }',
        '    }',
        '    copy.pets[key0] = value0;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  // Pinned against pre-fix behaviour: see the response-direction rewrite of
  // this test above. Both variants declare a different date-only property,
  // so both now serialize, each guarded by its own presence check.
  it('walks a map whose values are an undiscriminated union structurally', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        pets: {
          type: 'object',
          additionalProperties: {
            anyOf: [
              {
                type: 'object',
                properties: { at: { type: 'string', format: 'date' } },
              },
              {
                type: 'object',
                properties: { on: { type: 'string', format: 'date' } },
              },
            ],
          } satisfies OpenApiSchemaObject,
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([
      'if (copy.pets != null) {',
      '  copy.pets = { ...copy.pets };',
      '  for (const key0 of Object.keys(copy.pets)) {',
      '    let value0 = copy.pets[key0];',
      '    value0 = { ...value0 };',
      '    if ("at" in value0 && value0.at != null) {',
      '      value0.at = value0.at instanceof Date ? (value0.at.toISOString().slice(0, 10) as unknown as Date) : value0.at;',
      '    }',
      '    if ("on" in value0 && value0.on != null) {',
      '      value0.on = value0.on instanceof Date ? (value0.on.toISOString().slice(0, 10) as unknown as Date) : value0.on;',
      '    }',
      '    copy.pets[key0] = value0;',
      '  }',
      '}',
    ]);
  });

  it('suppresses the map when a oneOf/discriminator union sits beside additionalProperties, leaving the switch unaffected', () => {
    const context = makeContext({
      A: {
        type: 'object',
        required: ['madeOn'],
        properties: { madeOn: { type: 'string', format: 'date' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      oneOf: [{ $ref: '#/components/schemas/A' }],
      discriminator: {
        propertyName: 'kind',
        mapping: { a: '#/components/schemas/A' },
      },
      additionalProperties: { type: 'string', format: 'date' },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }),
    ).toEqual([
      'switch (copy.kind) {',
      '  case "a": {',
      '    copy.madeOn = copy.madeOn instanceof Date ? (copy.madeOn.toISOString().slice(0, 10) as unknown as Date) : copy.madeOn;',
      '    break;',
      '  }',
      '}',
    ]);
  });

  it('suppresses the map when an anyOf/discriminator union sits beside additionalProperties', () => {
    const context = makeContext({
      A: {
        type: 'object',
        required: ['madeOn'],
        properties: { madeOn: { type: 'string', format: 'date' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      anyOf: [{ $ref: '#/components/schemas/A' }],
      discriminator: {
        propertyName: 'kind',
        mapping: { a: '#/components/schemas/A' },
      },
      additionalProperties: { type: 'string', format: 'date' },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }),
    ).toEqual([
      'switch (copy.kind) {',
      '  case "a": {',
      '    copy.madeOn = copy.madeOn instanceof Date ? (copy.madeOn.toISOString().slice(0, 10) as unknown as Date) : copy.madeOn;',
      '    break;',
      '  }',
      '}',
    ]);
  });

  it('still walks a map that is a property of a union variant, one level inside the switch case (must not regress)', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        required: ['fills'],
        properties: {
          fills: {
            type: 'object',
            additionalProperties: { type: 'string', format: 'date' },
          },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      oneOf: [{ $ref: '#/components/schemas/Cat' }],
      discriminator: {
        propertyName: 'kind',
        mapping: { cat: '#/components/schemas/Cat' },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }),
    ).toEqual([
      'switch (copy.kind) {',
      '  case "cat": {',
      '    if (copy.fills != null) {',
      '      copy.fills = { ...copy.fills };',
      '      for (const key0 of Object.keys(copy.fills)) {',
      '        let value0 = copy.fills[key0];',
      '        value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
      '        copy.fills[key0] = value0;',
      '      }',
      '    }',
      '    break;',
      '  }',
      '}',
    ]);
  });

  it('still guards a nullable map spelled as an OAS 3.1 anyOf null branch (must not regress)', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        labels: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: { type: 'string', format: 'date' },
            },
            { type: 'null' },
          ],
        } satisfies OpenApiSchemaObject,
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.labels != null) {',
        '  copy.labels = { ...copy.labels };',
        '  for (const key0 of Object.keys(copy.labels)) {',
        '    let value0 = copy.labels[key0];',
        '    value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
        '    copy.labels[key0] = value0;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('walks only the declared properties when a schema has both properties and additionalProperties (Rule 1)', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['startOn'],
      properties: { startOn: { type: 'string', format: 'date' } },
      additionalProperties: { type: 'string', format: 'date' },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([
      'copy.startOn = copy.startOn instanceof Date ? (copy.startOn.toISOString().slice(0, 10) as unknown as Date) : copy.startOn;',
    ]);
  });

  it('emits nothing for additionalProperties: true or additionalProperties: false (Rule 2)', () => {
    expect(
      buildRequestDateSerializeStatements({
        schema: { type: 'object', additionalProperties: true },
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([]);
    expect(
      buildRequestDateSerializeStatements({
        schema: { type: 'object', additionalProperties: false },
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('guards a nullable map and nullable map values, continuing past a null value', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        labels: {
          type: ['object', 'null'],
          additionalProperties: {
            type: ['string', 'null'],
            format: 'date',
          },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.labels != null) {',
        '  copy.labels = { ...copy.labels };',
        '  for (const key0 of Object.keys(copy.labels)) {',
        '    let value0 = copy.labels[key0];',
        '    if (value0 == null) continue;',
        '    value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
        '    copy.labels[key0] = value0;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('emits nothing for a recursive map, like every other cyclic shape', () => {
    const context = makeContext({
      Node: {
        type: 'object',
        additionalProperties: {
          $ref: '#/components/schemas/Node',
        },
      },
    });

    expect(
      buildRequestDateSerializeStatements({
        schema: { $ref: '#/components/schemas/Node' },
        accessor: 'copy',
        context,
      }),
    ).toEqual([]);
  });

  it('names key/value locals by depth so a map inside an array inside a map does not shadow', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['outer'],
      properties: {
        outer: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: { type: 'string', format: 'date' },
            },
          },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.outer != null) {',
        '  copy.outer = { ...copy.outer };',
        '  for (const key0 of Object.keys(copy.outer)) {',
        '    let value0 = copy.outer[key0];',
        '    value0 = value0.map((item1) => {',
        '      let value1 = item1;',
        '      value1 = { ...value1 };',
        '      for (const key2 of Object.keys(value1)) {',
        '        let value2 = value1[key2];',
        '        value2 = value2 instanceof Date ? (value2.toISOString().slice(0, 10) as unknown as Date) : value2;',
        '        value1[key2] = value2;',
        '      }',
        '      return value1;',
        '    });',
        '    copy.outer[key0] = value0;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('suppresses the map when additionalProperties sits inside an allOf branch beside a properties-declaring one', () => {
    const context = makeContext({
      AuditFields: {
        type: 'object',
        required: ['createdOn'],
        properties: {
          createdOn: { type: 'string', format: 'date' },
          label: { type: 'string' },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/AuditFields' },
        {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['recordedOn'],
            properties: { recordedOn: { type: 'string', format: 'date' } },
          },
        },
      ],
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }),
    ).toEqual([
      'copy.createdOn = copy.createdOn instanceof Date ? (copy.createdOn.toISOString().slice(0, 10) as unknown as Date) : copy.createdOn;',
    ]);
  });

  it('suppresses the map when additionalProperties sits beside an allOf whose branch declares properties', () => {
    const context = makeContext({
      AuditFields: {
        type: 'object',
        required: ['createdOn'],
        properties: { createdOn: { type: 'string', format: 'date' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [{ $ref: '#/components/schemas/AuditFields' }],
      additionalProperties: {
        type: 'object',
        required: ['recordedOn'],
        properties: { recordedOn: { type: 'string', format: 'date' } },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }),
    ).toEqual([
      'copy.createdOn = copy.createdOn instanceof Date ? (copy.createdOn.toISOString().slice(0, 10) as unknown as Date) : copy.createdOn;',
    ]);
  });

  it('still walks the map when allOf branches declare no properties of their own', () => {
    const context = makeContext({
      Taggable: { type: 'object', description: 'marker, no properties' },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [{ $ref: '#/components/schemas/Taggable' }],
      additionalProperties: { type: 'string', format: 'date' },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }).join('\n'),
    ).toBe(
      [
        'copy = { ...copy };',
        'for (const key0 of Object.keys(copy)) {',
        '  let value0 = copy[key0];',
        '  value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
        '  copy[key0] = value0;',
        '}',
      ].join('\n'),
    );
  });

  it('emits nothing when propertyNames narrows the keys alongside additionalProperties', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: { enum: ['a', 'b'] },
      additionalProperties: { type: 'string', format: 'date' },
    } satisfies OpenApiSchemaObject;

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('emits nothing when propertyNames narrows the keys via a const', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: { const: 'a' },
      additionalProperties: { type: 'string', format: 'date' },
    } satisfies OpenApiSchemaObject;

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('emits nothing when propertyNames is a $ref to a string enum component', () => {
    // The case a hand-rolled predicate would miss: the narrowing is
    // resolved through a $ref, not spelled out inline. Proves this reuses
    // getters/object.ts's own resolution instead of a re-derived check.
    const context = makeContext({
      SomeStringEnum: { type: 'string', enum: ['a', 'b'] },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      propertyNames: {
        $ref: '#/components/schemas/SomeStringEnum',
      },
      additionalProperties: { type: 'string', format: 'date' },
    } satisfies OpenApiSchemaObject;

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }),
    ).toEqual([]);
  });

  it('maps the map when propertyNames only constrains format, not enumerable keys', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['ids'],
      properties: {
        ids: {
          type: 'object',
          propertyNames: { format: 'uuid' },
          additionalProperties: { type: 'string', format: 'date' },
        } satisfies OpenApiSchemaObject,
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.ids != null) {',
        '  copy.ids = { ...copy.ids };',
        '  for (const key0 of Object.keys(copy.ids)) {',
        '    let value0 = copy.ids[key0];',
        '    value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
        '    copy.ids[key0] = value0;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('maps the map when propertyNames only constrains a pattern, not enumerable keys', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['headers'],
      properties: {
        headers: {
          type: 'object',
          propertyNames: { pattern: '^x-' },
          additionalProperties: { type: 'string', format: 'date' },
        } satisfies OpenApiSchemaObject,
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.headers != null) {',
        '  copy.headers = { ...copy.headers };',
        '  for (const key0 of Object.keys(copy.headers)) {',
        '    let value0 = copy.headers[key0];',
        '    value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
        '    copy.headers[key0] = value0;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('maps a uuid-keyed map: additionalProperties + propertyNames: { format: uuid }, values a discriminated oneOf, wrapped in a nullable anyOf', () => {
    const context = makeContext({
      IntakeCat: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
      IntakeDog: {
        type: 'object',
        required: ['arrivedOn'],
        properties: { arrivedOn: { type: 'string', format: 'date' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['pets'],
      properties: {
        pets: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: {
                oneOf: [
                  { $ref: '#/components/schemas/IntakeCat' },
                  { $ref: '#/components/schemas/IntakeDog' },
                ],
                discriminator: {
                  propertyName: 'petType',
                  mapping: {
                    cat: '#/components/schemas/IntakeCat',
                    dog: '#/components/schemas/IntakeDog',
                  },
                },
              } satisfies OpenApiSchemaObject,
              propertyNames: { format: 'uuid' },
            },
            { type: 'null' },
          ],
        } satisfies OpenApiSchemaObject,
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }).join('\n'),
    ).toBe(
      [
        'if (copy.pets != null) {',
        '  copy.pets = { ...copy.pets };',
        '  for (const key0 of Object.keys(copy.pets)) {',
        '    let value0 = copy.pets[key0];',
        '    value0 = { ...value0 };',
        '    switch (value0.petType) {',
        '      case "dog": {',
        '        value0.arrivedOn = value0.arrivedOn instanceof Date ? (value0.arrivedOn.toISOString().slice(0, 10) as unknown as Date) : value0.arrivedOn;',
        '        break;',
        '      }',
        '    }',
        '    copy.pets[key0] = value0;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('still maps the array when additionalProperties is the empty-object "extra keys allowed" idiom (must not regress)', () => {
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const, format: 'date' },
      additionalProperties: {},
    } satisfies OpenApiSchemaObject;

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([
      'copy = copy.map((item0) => {',
      '  let value0 = item0;',
      '  value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
      '  return value0;',
      '});',
    ]);
  });

  it('still maps the array when additionalProperties is an empty array (must not regress)', () => {
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const, format: 'date' },
    } satisfies OpenApiSchemaObject;
    if (typeof schema === 'object') {
      Object.assign(schema, { additionalProperties: [] });
    }

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([
      'copy = copy.map((item0) => {',
      '  let value0 = item0;',
      '  value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
      '  return value0;',
      '});',
    ]);
  });

  it('emits nothing for a schema that is both array-shaped and map-shaped', () => {
    const schema = {
      type: 'array' as const,
      items: { type: 'string' as const, format: 'date' },
      additionalProperties: {
        type: 'object' as const,
        required: ['recordedOn'],
        properties: { recordedOn: { type: 'string' as const, format: 'date' } },
      },
    } satisfies OpenApiSchemaObject;

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('emits nothing when a schema is array-shaped through allOf and also carries a map-valued additionalProperties', () => {
    // Mirrors the response-direction pin above: the array/object conflict
    // guard's map branch fires on isArrayShaped regardless of mode, so an
    // array shape reached only through an allOf branch (rather than a
    // sibling `items`) must be caught here too.
    const context = makeContext({
      ArrayBase: { type: 'array', items: { type: 'string', format: 'date' } },
    });
    const schema: OpenApiSchemaObject = {
      allOf: [{ $ref: '#/components/schemas/ArrayBase' }],
      additionalProperties: { type: 'string', format: 'date' },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context,
      }),
    ).toEqual([]);
  });
});

// CRITICAL fix-round-1 regression: an undiscriminated union that writes into
// the accessor's own properties must get the same defensive copy a
// discriminated union already gets (`needsObjectCopy` also true for
// `schema.oneOf`/`schema.anyOf`, not just `schema.discriminator`). Without
// it, the generated request serializer wrote straight into the caller's own
// object, silently turning their `Date` into a string in place. The map-value
// case is pinned above (`'walks a map whose values are an undiscriminated
// union structurally'`); these two pin the other two nested positions.
describe('buildRequestDateSerializeStatements — undiscriminated unions need a defensive copy', () => {
  it('copies an object property before an undiscriminated union writes into it', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        properties: { vaccinatedOn: { type: 'string', format: 'date' } },
      },
      Dog: {
        type: 'object',
        properties: { adoptedOn: { type: 'string', format: 'date' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        pet: {
          anyOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
        },
      },
    };

    const statements = buildRequestDateSerializeStatements({
      schema,
      accessor: 'copy',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if (copy.pet != null) {',
        '  copy.pet = { ...copy.pet };',
        '  if ("vaccinatedOn" in copy.pet && copy.pet.vaccinatedOn != null) {',
        '    copy.pet.vaccinatedOn = copy.pet.vaccinatedOn instanceof Date ? (copy.pet.vaccinatedOn.toISOString().slice(0, 10) as unknown as Date) : copy.pet.vaccinatedOn;',
        '  }',
        '  if ("adoptedOn" in copy.pet && copy.pet.adoptedOn != null) {',
        '    copy.pet.adoptedOn = copy.pet.adoptedOn instanceof Date ? (copy.pet.adoptedOn.toISOString().slice(0, 10) as unknown as Date) : copy.pet.adoptedOn;',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('copies each array item before an undiscriminated union writes into it', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        properties: { vaccinatedOn: { type: 'string', format: 'date' } },
      },
      Dog: {
        type: 'object',
        properties: { adoptedOn: { type: 'string', format: 'date' } },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        pets: {
          type: 'array',
          items: {
            anyOf: [
              { $ref: '#/components/schemas/Cat' },
              { $ref: '#/components/schemas/Dog' },
            ],
          },
        },
      },
    };

    const statements = buildRequestDateSerializeStatements({
      schema,
      accessor: 'copy',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if (copy.pets != null) {',
        '  copy.pets = copy.pets.map((item0) => {',
        '    let value0 = item0;',
        '    value0 = { ...value0 };',
        '    if ("vaccinatedOn" in value0 && value0.vaccinatedOn != null) {',
        '      value0.vaccinatedOn = value0.vaccinatedOn instanceof Date ? (value0.vaccinatedOn.toISOString().slice(0, 10) as unknown as Date) : value0.vaccinatedOn;',
        '    }',
        '    if ("adoptedOn" in value0 && value0.adoptedOn != null) {',
        '      value0.adoptedOn = value0.adoptedOn instanceof Date ? (value0.adoptedOn.toISOString().slice(0, 10) as unknown as Date) : value0.adoptedOn;',
        '    }',
        '    return value0;',
        '  });',
        '}',
      ].join('\n'),
    );
  });
});

const makeJsonBody = (
  schema: OpenApiSchemaObject,
  definition = 'Item',
  isOptional = false,
): GetterBody =>
  ({
    originalSchema: { content: { 'application/json': { schema } } },
    definition,
    implementation: 'item',
    contentType: 'application/json',
    imports: [],
    schemas: [],
    isOptional,
    isBlob: false,
  }) satisfies GetterBody;

describe('generateRequestDateSerializer', () => {
  it('generates a copying serializer for a date-only body field', () => {
    const result = generateRequestDateSerializer({
      operationName: 'putItem',
      body: makeJsonBody({
        type: 'object',
        required: ['day'],
        properties: { day: { type: 'string', format: 'date' } },
      }),
      context: makeContext(),
    });

    expect(result?.name).toBe('serializePutItemRequest');
    expect(result?.implementation).toBe(
      `const serializePutItemRequest = (data: Item): Item => {
  if (data == null) return data;
  const copy = { ...data };
  copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;
  return copy;
};
`,
    );
  });

  // CRITICAL fix-round-2 coverage: the root position is the fourth place an
  // undiscriminated union's writes need a defensive copy (map value, array
  // item and object property are pinned elsewhere) — `needsObjectCopy(schema,
  // context)` governs this `declaration` line too, so `data` itself must be
  // shallow-copied into `copy` before the union writes into it, exactly as a
  // root-level discriminated union already gets.
  it('copies the root object before a root-level undiscriminated union writes into it', () => {
    const context = makeContext({
      Cat: {
        type: 'object',
        properties: { vaccinatedOn: { type: 'string', format: 'date' } },
      },
      Dog: {
        type: 'object',
        properties: { adoptedOn: { type: 'string', format: 'date' } },
      },
    });

    const result = generateRequestDateSerializer({
      operationName: 'putPet',
      body: makeJsonBody(
        {
          anyOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
        },
        'Pet',
      ),
      context,
    });

    expect(result?.name).toBe('serializePutPetRequest');
    expect(result?.implementation).toBe(
      `const serializePutPetRequest = (data: Pet): Pet => {
  if (data == null) return data;
  const copy = { ...data };
  if ("vaccinatedOn" in copy && copy.vaccinatedOn != null) {
    copy.vaccinatedOn = copy.vaccinatedOn instanceof Date ? (copy.vaccinatedOn.toISOString().slice(0, 10) as unknown as Date) : copy.vaccinatedOn;
  }
  if ("adoptedOn" in copy && copy.adoptedOn != null) {
    copy.adoptedOn = copy.adoptedOn instanceof Date ? (copy.adoptedOn.toISOString().slice(0, 10) as unknown as Date) : copy.adoptedOn;
  }
  return copy;
};
`,
    );
  });

  it('returns undefined when the body has no date-only field', () => {
    expect(
      generateRequestDateSerializer({
        operationName: 'putItem',
        body: makeJsonBody({
          type: 'object',
          required: ['at'],
          properties: { at: { type: 'string', format: 'date-time' } },
        }),
        context: makeContext(),
      }),
    ).toBeUndefined();
  });

  it('returns undefined for a non-JSON body', () => {
    const body = {
      originalSchema: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['day'],
              properties: { day: { type: 'string', format: 'date' } },
            },
          },
        },
      },
      definition: 'Item',
      implementation: 'item',
      contentType: 'multipart/form-data',
      imports: [],
      schemas: [],
      isOptional: false,
      isBlob: false,
    } satisfies GetterBody;

    expect(
      generateRequestDateSerializer({
        operationName: 'putItem',
        body,
        context: makeContext(),
      }),
    ).toBeUndefined();
  });

  it('returns undefined for a body offering json alongside a different-schema media type', () => {
    // Mirrors what getBody actually produces for a multi-media-type body:
    // contentType is '' (more than one media type survived filtering) and
    // definition is the union of every surviving type's TS value.
    const body = {
      originalSchema: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['day'],
              properties: { day: { type: 'string', format: 'date' } },
            },
          },
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['name'],
              properties: { name: { type: 'string' } },
            },
          },
        },
      },
      definition: 'Item | Other',
      implementation: 'putItemBody',
      contentType: '',
      imports: [],
      schemas: [],
      isOptional: false,
      isBlob: false,
    } satisfies GetterBody;

    expect(
      generateRequestDateSerializer({
        operationName: 'putItem',
        body,
        context: makeContext(),
      }),
    ).toBeUndefined();
  });

  it('reassigns the root when the body is an array of date-only items', () => {
    const result = generateRequestDateSerializer({
      operationName: 'putDays',
      body: makeJsonBody(
        { type: 'array', items: { type: 'string', format: 'date' } },
        'Date[]',
      ),
      context: makeContext(),
    });

    expect(result?.implementation).toBe(
      `const serializePutDaysRequest = (data: Date[]): Date[] => {
  if (data == null) return data;
  let copy = data;
  copy = copy.map((item0) => {
    let value0 = item0;
    value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;
    return value0;
  });
  return copy;
};
`,
    );
  });

  it('casts through the model type when the body is NonReadonly-wrapped', () => {
    const result = generateRequestDateSerializer({
      operationName: 'putItem',
      body: makeJsonBody(
        {
          type: 'object',
          required: ['day'],
          properties: { day: { type: 'string', format: 'date' } },
        },
        'NonReadonly<Item>',
      ),
      context: makeContext(),
    });

    expect(result?.implementation).toBe(
      `const serializePutItemRequest = (data: NonReadonly<Item>): NonReadonly<Item> => {
  if (data == null) return data;
  const copy = { ...data } as unknown as Item;
  copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;
  return copy as unknown as NonReadonly<Item>;
};
`,
    );
  });

  it('emits no cast when the body type is not NonReadonly-wrapped', () => {
    const result = generateRequestDateSerializer({
      operationName: 'putItem',
      body: makeJsonBody({
        type: 'object',
        required: ['day'],
        properties: { day: { type: 'string', format: 'date' } },
      }),
      context: makeContext(),
    });

    expect(result?.implementation).toContain('const copy = { ...data };');
    expect(result?.implementation).toContain('  return copy;');
  });

  it('types the signature as T | undefined for an optional (non-required) body', () => {
    // A `requestBody` without `required: true` — the OpenAPI default — makes
    // `getProps` emit the operation prop as `item?: Item`, so the call site
    // passes `Item | undefined`. The serializer signature must match, or the
    // generated call fails to type-check (TS2345).
    const result = generateRequestDateSerializer({
      operationName: 'putItem',
      body: makeJsonBody(
        {
          type: 'object',
          required: ['day'],
          properties: { day: { type: 'string', format: 'date' } },
        },
        'Item',
        true,
      ),
      context: makeContext(),
    });

    expect(result?.implementation).toBe(
      `const serializePutItemRequest = (data: Item | undefined): Item | undefined => {
  if (data == null) return data;
  const copy = { ...data };
  copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;
  return copy;
};
`,
    );
  });

  it('composes the optional signature with the NonReadonly cast path', () => {
    const result = generateRequestDateSerializer({
      operationName: 'putItem',
      body: makeJsonBody(
        {
          type: 'object',
          required: ['day'],
          properties: { day: { type: 'string', format: 'date' } },
        },
        'NonReadonly<Item>',
        true,
      ),
      context: makeContext(),
    });

    expect(result?.implementation).toBe(
      `const serializePutItemRequest = (data: NonReadonly<Item> | undefined): NonReadonly<Item> | undefined => {
  if (data == null) return data;
  const copy = { ...data } as unknown as Item;
  copy.day = copy.day instanceof Date ? (copy.day.toISOString().slice(0, 10) as unknown as Date) : copy.day;
  return copy as unknown as NonReadonly<Item>;
};
`,
    );
  });

  it('generates no serializer for a body that is both array- and object-shaped', () => {
    expect(
      generateRequestDateSerializer({
        operationName: 'putHybrid',
        body: makeJsonBody({
          type: 'array',
          items: { type: 'string', format: 'date' },
          properties: { count: { type: 'string', format: 'date' } },
        }),
        context: makeContext(),
      }),
    ).toBeUndefined();
  });
});

describe('review comment fixes — allOf array/object conflicts and required container guards', () => {
  // Comment 1: `needsObjectCopy` recurses into `allOf` to find an object
  // shape, but the conflict guard only ever looked at a sibling `items` — so
  // an array reached through `allOf` disagreed with an object reached
  // through a different `allOf` branch, and both branches' statements were
  // emitted, producing runtime-broken code (`copy.x.map is not a function`
  // after `copy.x` was already turned into an object copy).
  const allOfArrayAndObject = {
    allOf: [
      { type: 'array', items: { type: 'string', format: 'date' } },
      {
        type: 'object',
        required: ['d'],
        properties: { d: { type: 'string', format: 'date' } },
      },
    ],
  } satisfies OpenApiSchemaObject;

  it('drops all statements for a property that is array-shaped via allOf and object-shaped via a sibling allOf branch', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['x'],
      properties: { x: allOfArrayAndObject },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }),
    ).toEqual([]);
  });

  it('generates no serializer for a root body that is array-shaped via allOf and object-shaped via a sibling allOf branch', () => {
    expect(
      generateRequestDateSerializer({
        operationName: 'putX',
        body: makeJsonBody(allOfArrayAndObject, 'X'),
        context: makeContext(),
      }),
    ).toBeUndefined();
  });

  it('leaves the response direction array/object-conflict handling unchanged, but now guards the required property', () => {
    // Pinned against today's (pre-fix) behaviour: the response direction
    // never applies the array/object-conflict guard (`dropArrayObjectConflict`
    // is false there), so it freely combines the in-place array loop from
    // one allOf branch with the property write from the other — that part of
    // this must stay byte-for-byte identical after the request-side fix.
    // What does change: `x` is a required container (writes through its own
    // elements/properties, not the accessor itself), so the response
    // direction now null-guards it the same as the request direction always
    // has, closing the crash this whole fix addresses.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['x'],
      properties: { x: allOfArrayAndObject },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (data.x != null) {',
        '  for (let i0 = 0; i0 < data.x.length; i0++) {',
        '    data.x[i0] = new Date(data.x[i0]);',
        '  }',
        '  data.x.d = new Date(data.x.d);',
        '}',
      ].join('\n'),
    );
  });

  it('does not over-suppress an allOf branch that is array-shaped with no object branch', () => {
    // Guards against a conflict-detection fix that is too eager: a schema
    // whose only allOf branch is array-shaped (no object branch anywhere)
    // must still emit its `.map` conversion.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        x: {
          allOf: [{ type: 'array', items: { type: 'string', format: 'date' } }],
        } satisfies OpenApiSchemaObject,
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.x != null) {',
        '  copy.x = copy.x.map((item0) => {',
        '    let value0 = item0;',
        '    value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
        '    return value0;',
        '  });',
        '}',
      ].join('\n'),
    );
  });

  // Comment 2: a required, non-nullable container property (object or array)
  // was written without a null guard, so omitting it from the caller's data
  // either silently produced an extra empty object (`"a":{}`) or threw
  // trying to `.map` over `undefined`. A required *date leaf* must stay
  // unguarded — `x instanceof Date ? … : x` already tolerates `undefined`.
  it('guards a request-side required object property, leaving a required date leaf unguarded', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['a', 'when'],
      properties: {
        a: {
          type: 'object',
          required: ['day'],
          properties: { day: { type: 'string', format: 'date' } },
        },
        when: { type: 'string', format: 'date' },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.a != null) {',
        '  copy.a = { ...copy.a };',
        '  copy.a.day = copy.a.day instanceof Date ? (copy.a.day.toISOString().slice(0, 10) as unknown as Date) : copy.a.day;',
        '}',
        'copy.when = copy.when instanceof Date ? (copy.when.toISOString().slice(0, 10) as unknown as Date) : copy.when;',
      ].join('\n'),
    );
  });

  it('guards a request-side required array property', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['slots'],
      properties: {
        slots: { type: 'array', items: { type: 'string', format: 'date' } },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toBe(
      [
        'if (copy.slots != null) {',
        '  copy.slots = copy.slots.map((item0) => {',
        '    let value0 = item0;',
        '    value0 = value0 instanceof Date ? (value0.toISOString().slice(0, 10) as unknown as Date) : value0;',
        '    return value0;',
        '  });',
        '}',
      ].join('\n'),
    );
  });

  it('now guards required object and array containers in the response direction too', () => {
    // Previously pinned against the pre-fix asymmetry (response left required
    // containers unguarded while request guarded them); that asymmetry was
    // exactly this bug — the response mutates a payload it just parsed, but a
    // server can omit a `required` field despite its own contract, and an
    // unguarded container threw before the caller could handle it. Both
    // directions now guard required containers identically.
    const objectSchema: OpenApiSchemaObject = {
      type: 'object',
      required: ['nested'],
      properties: {
        nested: {
          type: 'object',
          required: ['day'],
          properties: { day: { type: 'string', format: 'date-time' } },
        },
      },
    };

    expect(
      buildDateTransformStatements({
        schema: objectSchema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'if (data.nested != null) {',
      '  data.nested.day = new Date(data.nested.day);',
      '}',
    ]);

    const arraySchema: OpenApiSchemaObject = {
      type: 'object',
      required: ['days'],
      properties: {
        days: { type: 'array', items: { type: 'string', format: 'date-time' } },
      },
    };

    expect(
      buildDateTransformStatements({
        schema: arraySchema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'if (data.days != null) {',
      '  for (let i0 = 0; i0 < data.days.length; i0++) {',
      '    data.days[i0] = new Date(data.days[i0]);',
      '  }',
      '}',
    ]);
  });

  it('executes the guarded serializer at runtime without adding keys for omitted required containers', () => {
    // Comment 2, executed: strip the TS-only syntax (parameter/return type
    // annotations and `as unknown as X` casts) from the emitted function so
    // it can run as plain JS, then call it on a body that omits both a
    // required object and a required array.
    const result = generateRequestDateSerializer({
      operationName: 'updateAppointment',
      body: makeJsonBody({
        type: 'object',
        required: ['day', 'a', 'slots'],
        properties: {
          day: { type: 'string', format: 'date' },
          a: {
            type: 'object',
            required: ['start'],
            properties: { start: { type: 'string', format: 'date' } },
          },
          slots: {
            type: 'array',
            items: {
              type: 'object',
              required: ['start'],
              properties: { start: { type: 'string', format: 'date' } },
            },
          },
        },
      }),
      context: makeContext(),
    });

    expect(result).toBeDefined();

    const runnable = result!.implementation
      .replace(/\(data: [^)]*\): [^=]*=>/, '(data) =>')
      .replace(/ as unknown as [\w<>[\] |]+/g, '');

    // Run in this realm (rather than a fresh vm context) so the `Date`
    // instances the test constructs are `instanceof` the same `Date` the
    // generated `instanceof Date` check compares against.
    const fn = vm.runInThisContext(
      `(() => {\n${runnable}\nreturn ${result!.name};\n})()`,
    ) as (data: Record<string, unknown>) => unknown;

    const input = { day: new Date('2026-07-01') };

    expect(() => fn(input)).not.toThrow();
    expect(fn(input)).toEqual({ day: '2026-07-01' });
  });

  it('executes the guarded serializer at runtime for an omitted required map property', () => {
    // Comment 2, executed, map variant: a required `additionalProperties`
    // map is a container exactly like the object/array cases above — the
    // guard must keep an omitted map out of the payload rather than adding
    // it as `{}`.
    const result = generateRequestDateSerializer({
      operationName: 'updateShelter',
      body: makeJsonBody({
        type: 'object',
        required: ['pets'],
        properties: {
          pets: {
            type: 'object',
            additionalProperties: { type: 'string', format: 'date' },
          },
        },
      }),
      context: makeContext(),
    });

    expect(result).toBeDefined();

    const runnable = result!.implementation
      .replace(/\(data: [^)]*\): [^=]*=>/, '(data) =>')
      .replace(/ as unknown as [\w<>[\] |]+/g, '');

    const fn = vm.runInThisContext(
      `(() => {\n${runnable}\nreturn ${result!.name};\n})()`,
    ) as (data: Record<string, unknown>) => Record<string, unknown>;

    const input = {};

    expect(() => fn(input)).not.toThrow();
    const output = fn(input);
    expect(output).toEqual({});
    expect('pets' in output).toBe(false);
  });
});

describe('additionalProperties maps beside an empty `properties: {}`', () => {
  // The object getter types `properties: {}` + a schema-valued
  // `additionalProperties` as the same index signature as a bare map, so an
  // empty `properties` block declares no keys and must not suppress the map.
  const withEmptyProperties = (): OpenApiSchemaObject => ({
    type: 'object',
    required: ['m'],
    properties: {
      m: {
        type: 'object',
        properties: {},
        additionalProperties: { type: 'string', format: 'date' },
      },
    },
  });
  const withoutProperties = (): OpenApiSchemaObject => ({
    type: 'object',
    required: ['m'],
    properties: {
      m: {
        type: 'object',
        additionalProperties: { type: 'string', format: 'date' },
      },
    },
  });

  it('walks the map in the response direction', () => {
    expect(
      buildDateTransformStatements({
        schema: withEmptyProperties(),
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual([
      'if (data.m != null) {',
      '  for (const key0 of Object.keys(data.m)) {',
      '    data.m[key0] = new Date(data.m[key0]);',
      '  }',
      '}',
    ]);
  });

  it('walks the map in the request direction exactly as for a bare map, copying it once', () => {
    const statements = buildRequestDateSerializeStatements({
      schema: withEmptyProperties(),
      accessor: 'copy',
      context: makeContext(),
    });

    expect(statements).toEqual(
      buildRequestDateSerializeStatements({
        schema: withoutProperties(),
        accessor: 'copy',
        context: makeContext(),
      }),
    );
    expect(
      statements.filter((line) => line.includes('copy.m = { ...copy.m };')),
    ).toHaveLength(1);
  });

  it('does not treat an array with an empty `properties` block as array-and-object shaped', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['days'],
      properties: {
        days: {
          type: 'array',
          properties: {},
          items: { type: 'string', format: 'date' },
        },
      },
    };

    expect(
      buildRequestDateSerializeStatements({
        schema,
        accessor: 'copy',
        context: makeContext(),
      }).join('\n'),
    ).toContain('copy.days = copy.days.map((item0) => {');
  });
});

describe('response direction — required container guards', () => {
  // The response direction used to leave required, non-nullable containers
  // unguarded (see "leaves the response direction ... unchanged" pins
  // above, now updated): a server omitting a required array or object threw
  // a TypeError inside the generated deserializer, before the caller could
  // handle it. Containers are now guarded the same as the request
  // direction; a required *date leaf* stays unguarded either way, since
  // `new Date(undefined)` degrades to `Invalid Date` instead of throwing.
  it('guards a response-side required object property containing a date', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['a'],
      properties: {
        a: {
          type: 'object',
          required: ['day'],
          properties: { day: { type: 'string', format: 'date-time' } },
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
      'if (data.a != null) {',
      '  data.a.day = new Date(data.a.day);',
      '}',
    ]);
  });

  it('guards a response-side required array of objects containing a date', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['slots'],
      properties: {
        slots: {
          type: 'array',
          items: {
            type: 'object',
            required: ['start'],
            properties: { start: { type: 'string', format: 'date-time' } },
          },
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
      'if (data.slots != null) {',
      '  for (let i0 = 0; i0 < data.slots.length; i0++) {',
      '    const item0 = data.slots[i0];',
      '    item0.start = new Date(item0.start);',
      '  }',
      '}',
    ]);
  });

  it('guards a response-side required discriminated-union property', () => {
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
          adoptedAt: { type: ['string', 'null'], format: 'date-time' },
        },
      },
    });
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['pet'],
      properties: {
        pet: {
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
        'if (data.pet != null) {',
        '  switch (data.pet.petType) {',
        '    case "cat": {',
        '      data.pet.vaccinatedAt = new Date(data.pet.vaccinatedAt);',
        '      break;',
        '    }',
        '    case "dog": {',
        '      if (data.pet.adoptedAt != null) {',
        '        data.pet.adoptedAt = new Date(data.pet.adoptedAt);',
        '      }',
        '      break;',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('leaves a response-side required date leaf unguarded', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['day'],
      properties: { day: { type: 'string', format: 'date-time' } },
    };

    expect(
      buildDateTransformStatements({
        schema,
        accessor: 'data',
        context: makeContext(),
      }),
    ).toEqual(['data.day = new Date(data.day);']);
  });

  it('executes the guarded deserializer at runtime without throwing when required containers are omitted', () => {
    // Executed version of the two statement-level tests above: build a real
    // `deserialize...Response` function for a body with a required object
    // and a required array, strip the TS-only parameter/return annotations,
    // run it on a payload that omits both, and confirm it neither throws nor
    // fabricates keys the payload never had — matching the request
    // direction's own runtime test above.
    const schema: OpenApiSchemaObject = {
      type: 'object',
      required: ['a', 'slots'],
      properties: {
        a: {
          type: 'object',
          required: ['start'],
          properties: { start: { type: 'string', format: 'date-time' } },
        },
        slots: {
          type: 'array',
          items: {
            type: 'object',
            required: ['start'],
            properties: { start: { type: 'string', format: 'date-time' } },
          },
        },
      },
    };

    const result = generateResponseDateDeserializer({
      operationName: 'getAppointment',
      response: makeResponse({ successTypes: [{ originalSchema: schema }] }),
      context: makeContext(),
    });

    expect(result).toBeDefined();

    const runnable = result!.implementation.replace(
      /\(data: [^)]*\): [^=]*=>/,
      '(data) =>',
    );

    const fn = vm.runInThisContext(
      `(() => {\n${runnable}\nreturn ${result!.name};\n})()`,
    ) as (data: Record<string, unknown>) => unknown;

    const input = {};

    expect(() => fn(input)).not.toThrow();
    expect(fn(input)).toEqual({});
  });
});

describe('buildDateTransformStatements — property guards are unchanged', () => {
  it('leaves a required non-nullable date leaf unguarded', () => {
    const context = makeContext({});
    const statements = buildDateTransformStatements({
      schema: {
        type: 'object',
        required: ['seenOn'],
        properties: { seenOn: { type: 'string', format: 'date-time' } },
      },
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe('data.seenOn = new Date(data.seenOn);');
  });

  it('guards an optional date leaf on null only', () => {
    const context = makeContext({});
    const statements = buildDateTransformStatements({
      schema: {
        type: 'object',
        properties: { seenOn: { type: 'string', format: 'date-time' } },
      },
      accessor: 'data',
      context,
    });

    expect(statements.join('\n')).toBe(
      [
        'if (data.seenOn != null) {',
        '  data.seenOn = new Date(data.seenOn);',
        '}',
      ].join('\n'),
    );
  });
});
