import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../test-utils/context';
import { EnumGeneration, type OpenApiParameterObject } from '../types';
import { getQueryParams } from './query-params';

// Fully-typed context via the shared factory — no unsafe cast, so missing
// or renamed fields surface at compile time if getQueryParams starts
// reading additional context. `Filter` backs the $ref test cases below.
const context = createTestContextSpec({
  spec: {
    components: {
      schemas: {
        Filter: {
          type: 'object',
          properties: { field: { type: 'string' } },
        },
      },
    },
  },
  override: {
    useDates: true,
    components: {
      schemas: { suffix: 'Dto', itemSuffix: 'Item' },
      responses: { suffix: 'Response' },
      parameters: { suffix: 'Params' },
      requestBodies: { suffix: 'Body' },
    },
  },
});

const queryParams: {
  parameter: OpenApiParameterObject;
  optional: boolean;
}[] = [
  {
    parameter: {
      name: 'queryParamWithSchemaNotRequired',
      in: 'query',
      schema: {
        type: 'string',
      },
      required: false,
    },
    optional: true,
  },
  {
    parameter: {
      name: 'queryParamWithSchemaRequired',
      in: 'query',
      schema: {
        type: 'string',
      },
      required: true,
    },
    optional: false,
  },
  {
    parameter: {
      name: 'queryParamWithSchemaDefaultValue',
      in: 'query',
      schema: {
        default: 'defaultValue',
        type: 'string',
      },
    },
    optional: true,
  },
  {
    parameter: {
      name: 'queryParamWithContentNotRequired',
      in: 'query',
      content: {
        'application/json': {
          schema: {
            type: 'string',
          },
        },
      },
      required: false,
    },
    optional: true,
  },
  {
    parameter: {
      name: 'queryParamWithContentRequired',
      in: 'query',
      content: {
        'application/json': {
          schema: {
            type: 'string',
          },
        },
      },
      required: true,
    },
    optional: false,
  },
  {
    parameter: {
      name: 'queryParamWithContentDefaultValue',
      in: 'query',
      content: {
        'application/json': {
          schema: {
            default: 'defaultValue',
            type: 'string',
          },
        },
      },
      required: true,
    },
    optional: true,
  },
];

describe('getQueryParams getter', () => {
  for (const { parameter, optional } of queryParams) {
    it(`${parameter.name} should${optional ? ' ' : ' NOT '}be optional`, () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter,
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.schema.model.trim()).toBe(
        `export type Params = {\n${parameter.name}${
          optional ? '?' : ''
        }: string;\n};`,
      );
    });
  }

  it('queryParamWithDescription should be documented', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'queryParamWithDescription',
            in: 'query',
            description: 'Parameter description.',
            schema: {
              type: 'string',
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });
    expect(result?.schema.model.trim()).toBe(
      [
        'export type Params = {',
        '/**',
        ' * Parameter description.',
        ' */',
        'queryParamWithDescription?: string;',
        '};',
      ].join('\n'),
    );
  });

  it('queryParam with anyOf and null should be nullable and optional', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'affiliations',
            in: 'query',
            required: false,
            schema: {
              anyOf: [
                {
                  format: 'uuid',
                  type: 'string',
                },
                {
                  type: 'null',
                },
              ],
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });

    expect(result?.schema.model.trim()).toBe(
      `export type Params = {\naffiliations?: string | null;\n};`,
    );
  });

  // OpenAPI 3.1 lets users express a nullable enum either as
  // `{type: ['string','null'], enum: [...]}` (already extracted) or as
  // `anyOf: [{enum: [...]}, {type: 'null'}]`. Both spellings should produce
  // a named parameter type. See issue #2710.
  it('queryParam with anyOf containing enum and null extracts a named nullable enum type', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              anyOf: [{ enum: ['new', 'in_progress'] }, { type: 'null' }],
              title: 'Status',
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });

    expect(result?.schema.model.trim()).toBe(
      `export type Params = {\nstatus?: Status;\n};`,
    );

    const statusEnum = result?.deps.find((schema) => schema.name === 'Status');
    expect(statusEnum).toBeDefined();
    expect(statusEnum?.model).toContain(`'new' | 'in_progress' | null`);
  });

  // Under enumGenerationType: 'const', getEnum's stripNullUnion handling moves
  // `| null` off the const body onto the type alias, producing the same
  // typeof+const pattern as a non-nullable enum. Pins that #2710's fix routes
  // through that same helper rather than emitting a broken `null: null` member.
  it('queryParam with anyOf [enum, null] under const enum mode emits typeof+const pattern', () => {
    const constContext = createTestContextSpec({
      override: {
        enumGenerationType: EnumGeneration.CONST,
      },
    });

    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              anyOf: [{ enum: ['new', 'in_progress'] }, { type: 'null' }],
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context: constContext,
    });

    expect(result?.schema.model.trim()).toBe(
      `export type Params = {\nstatus?: Status;\n};`,
    );

    const statusEnum = result?.deps.find((schema) => schema.name === 'Status');
    expect(statusEnum).toBeDefined();
    expect(statusEnum?.model).toContain(
      `export type Status = typeof Status[keyof typeof Status] | null;`,
    );
    expect(statusEnum?.model).toContain(`export const Status = {`);
    // The const body must contain the enum members (not just the wrapper),
    // so we know the values made it across the nullable composition.
    expect(statusEnum?.model).toContain(`new:`);
    expect(statusEnum?.model).toContain(`in_progress:`);
    // The null variant must not leak into the const body as a `null: null`
    // member — that would emit invalid TypeScript.
    expect(statusEnum?.model).not.toContain('null: null');
  });

  // Parallel integration coverage for `oneOf`. Same processing path as anyOf
  // but worth pinning so future combine.ts refactors don't accidentally
  // narrow the fix.
  it('queryParam with oneOf containing enum and null extracts a named nullable enum type', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'priority',
            in: 'query',
            required: false,
            schema: {
              oneOf: [{ enum: ['low', 'high'] }, { type: 'null' }],
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });

    expect(result?.schema.model.trim()).toBe(
      `export type Params = {\npriority?: Priority;\n};`,
    );

    const priorityEnum = result?.deps.find((s) => s.name === 'Priority');
    expect(priorityEnum).toBeDefined();
    expect(priorityEnum?.model).toContain(`'low' | 'high' | null`);
  });

  // Negative: a `$ref` enum branch should reuse the referenced component, not
  // be re-extracted as a parallel inline enum. Without the isRef guard in
  // combine.ts the caller would emit a nested `{Status: Status}` const.
  it('queryParam with anyOf [$ref enum, null] reuses the referenced type', () => {
    const refContext = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            Status: {
              type: 'string',
              enum: ['new', 'in_progress'],
            },
          },
        },
      },
    });

    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              anyOf: [
                { $ref: '#/components/schemas/Status' },
                { type: 'null' },
              ],
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context: refContext,
    });

    // The param should reference the existing Status type (with null), not
    // a freshly extracted inline enum named after the parameter.
    expect(result?.schema.model.trim()).toBe(
      `export type Params = {\nstatus?: Status | null;\n};`,
    );
    // No parameter-scoped enum should be emitted.
    expect(result?.deps.find((s) => s.name === 'Status')).toBeUndefined();
  });

  // Negative regression: anyOf with multiple non-null variants is a genuine
  // union, not a nullable enum, and must stay inlined. This guards the
  // #2710 fix from over-matching.
  it('queryParam with anyOf [enum, non-null scalar] stays inlined', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              anyOf: [{ enum: ['new', 'in_progress'] }, { type: 'string' }],
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });

    expect(result?.schema.model.trim()).toBe(
      `export type Params = {\nstatus?: 'new' | 'in_progress' | string;\n};`,
    );
    // No named Status type should be emitted for this case.
    expect(result?.deps.find((s) => s.name === 'Status')).toBeUndefined();
  });

  it('tracks required nullable keys for downstream generators', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'requiredNullableParam',
            in: 'query',
            required: true,
            schema: {
              type: ['string', 'null'],
            },
          },
          imports: [],
        },
        {
          parameter: {
            name: 'optionalNullableParam',
            in: 'query',
            required: false,
            schema: {
              nullable: true,
              type: 'string',
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });

    expect(result?.requiredNullableKeys).toEqual(['requiredNullableParam']);
  });

  it('tracks required nullable keys when nullability comes from oneOf', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'requiredOneOfNullableParam',
            in: 'query',
            required: true,
            schema: {
              oneOf: [
                {
                  type: 'string',
                },
                {
                  type: 'null',
                },
              ],
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });

    expect(result?.requiredNullableKeys).toEqual([
      'requiredOneOfNullableParam',
    ]);
  });

  it('tracks raw query parameter names for downstream generators', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'cursor',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
          },
          imports: [],
        },
        {
          parameter: {
            name: 'page-size',
            in: 'query',
            required: false,
            schema: {
              type: 'number',
            },
          },
          imports: [],
        },
      ],
      operationName: 'listPets',
      context,
    });

    expect(result?.paramNames).toEqual(['cursor', 'page-size']);
  });

  // Tracking non-primitive keys lets Angular generators preserve schema-
  // declared object/array-of-object params through the default filterParams
  // helper instead of silently dropping them. See issue #3326.
  describe('nonPrimitiveKeys (Angular passthrough)', () => {
    it('flags object-typed query params', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'filters',
              in: 'query',
              required: false,
              schema: { type: 'object' },
            },
            imports: [],
          },
          {
            parameter: {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['filters']);
    });

    it('flags arrays of objects', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'items',
              in: 'query',
              required: false,
              schema: {
                type: 'array',
                items: { type: 'object' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['items']);
    });

    it('flags nullable arrays of objects', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'items',
              in: 'query',
              required: false,
              schema: {
                type: ['array', 'null'],
                items: { type: 'object' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['items']);
    });
    it('flags object via oneOf composition', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'either',
              in: 'query',
              required: false,
              schema: {
                oneOf: [{ type: 'string' }, { type: 'object' }],
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['either']);
    });

    it('flags type-less schemas with additionalProperties', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'filters',
              in: 'query',
              required: false,
              schema: {
                additionalProperties: { type: 'string' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['filters']);
    });
    it('omits the field when all params are primitive', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'id',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toBeUndefined();
    });

    it('flags arrays whose items are a $ref', () => {
      // `items` is a reference object, not an inline schema. It almost
      // always points at a component object and must survive the filter
      // (when a paramsSerializer is configured). See #3326.
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'filters',
              in: 'query',
              required: false,
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Filter' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['filters']);
    });

    it('flags arrays without an items schema', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'filters',
              in: 'query',
              required: false,
              schema: {
                type: 'array',
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['filters']);
    });

    it('flags a $ref variant inside a composition', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'either',
              in: 'query',
              required: false,
              schema: {
                oneOf: [
                  { type: 'string' },
                  { $ref: '#/components/schemas/Filter' },
                ],
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['either']);
    });

    it('does not flag arrays of primitives', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'tags',
              in: 'query',
              required: false,
              schema: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toBeUndefined();
    });
  });

  // Locks the contract that getParameters/issue-1879 fix relies on: when the
  // caller surfaces an import (i.e. the parameter resolved to a named
  // `#/components/parameters/*` slot), the type must be that import name, and
  // when it does not, the parameter's `schema` must be inlined as `string`.
  describe('parameter import handling', () => {
    it('renders the import name when a non-empty import is supplied', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'Content-Type',
              in: 'header',
              schema: { type: 'string' },
            },
            imports: [
              { name: 'ContentTypeHeader', schemaName: 'ContentTypeHeader' },
            ],
          },
        ],
        operationName: '',
        context,
        suffix: 'headers',
      });

      expect(result?.schema.model.trim()).toBe(
        `export type Headers = {\n'Content-Type'?: ContentTypeHeader;\n};`,
      );
    });

    it('inlines the resolved schema as `string` when no import is surfaced (issue #1879)', () => {
      // Mirrors what getParameters now feeds in for header refs like
      // `#/paths/~1requestA/post/parameters/0`: the resolved parameter object
      // with empty imports. Without the upstream fix the resolver would have
      // emitted `{ name: 'N0', ... }` here, producing a dangling `N0` type.
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'Content-Type',
              in: 'header',
              schema: { type: 'string' },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
        suffix: 'headers',
      });

      expect(result?.schema.model.trim()).toBe(
        `export type Headers = {\n'Content-Type'?: string;\n};`,
      );
    });
  });
});
