import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiParameterObject, OpenApiReferenceObject } from '../types';
import { getParameters } from './parameters';

describe('getParameters', () => {
  it('keeps the operation-level parameter when it overrides a path-level parameter (issue #3745)', () => {
    const pathParameter: OpenApiParameterObject = {
      name: 'name',
      in: 'query',
      description: 'Path-level definition',
      schema: { type: 'string' },
    };
    const operationParameter: OpenApiParameterObject = {
      name: 'name',
      in: 'query',
      description: 'Operation-level override',
      schema: { type: 'integer' },
    };

    const result = getParameters({
      parameters: [pathParameter, operationParameter],
      context: createTestContextSpec(),
    });

    expect(result.query).toEqual([
      { parameter: operationParameter, imports: [] },
    ]);
  });

  it('matches header parameter names case-insensitively when applying overrides', () => {
    const pathParameter: OpenApiParameterObject = {
      name: 'X-Trace-Id',
      in: 'header',
      description: 'Path-level definition',
      schema: { type: 'string' },
    };
    const operationParameter: OpenApiParameterObject = {
      name: 'x-trace-id',
      in: 'header',
      description: 'Operation-level override',
      schema: { type: 'integer' },
    };

    const result = getParameters({
      parameters: [pathParameter, operationParameter],
      context: createTestContextSpec(),
    });

    expect(result.header).toEqual([
      { parameter: operationParameter, imports: [] },
    ]);
  });

  it('resolves a header parameter referenced via #/components/parameters/* and surfaces its named import', () => {
    // Refs that target a slot under `#/components/<NAMED_COMPONENT_SECTIONS>`
    // have a matching `export type` emitted by `generateParameterDefinition`,
    // so the import must flow through to downstream getters (e.g.
    // `getQueryParams` renders the header type as that named import).
    const sharedHeader: OpenApiParameterObject = {
      name: 'Content-Type',
      in: 'header',
      schema: { type: 'string' },
    };
    const context = createTestContextSpec({
      spec: {
        components: { parameters: { ContentTypeHeader: sharedHeader } },
      },
    });

    const ref: OpenApiReferenceObject = {
      $ref: '#/components/parameters/ContentTypeHeader',
    };

    const result = getParameters({ parameters: [ref], context });

    expect(result.header).toHaveLength(1);
    expect(result.header[0].parameter.name).toBe('Content-Type');
    expect(result.header[0].imports).toEqual([
      { name: 'ContentTypeHeader', schemaName: 'ContentTypeHeader' },
    ]);
  });

  it('keeps only the reusable parameter import when its schema is a component ref (issue #4057)', () => {
    const whereItem = {
      type: 'object',
      properties: {
        attribute: { type: 'string' },
        value: { type: 'string' },
      },
    } as const;
    const whereParameter: OpenApiParameterObject = {
      name: 'where',
      in: 'query',
      description: 'Complex filtering criteria',
      style: 'deepObject',
      explode: true,
      schema: { $ref: '#/components/schemas/WhereItem' },
    };
    const context = createTestContextSpec({
      spec: {
        components: {
          parameters: { Where: whereParameter },
          schemas: { WhereItem: whereItem },
        },
      },
      override: {
        components: {
          schemas: {
            prefix: '',
            itemPrefix: '',
            suffix: '',
            itemSuffix: '',
          },
          responses: { prefix: '', suffix: '' },
          parameters: { prefix: '', suffix: 'Parameter' },
          requestBodies: { prefix: '', suffix: '' },
        },
      },
    });

    const result = getParameters({
      parameters: [{ $ref: '#/components/parameters/Where' }],
      context,
    });

    expect(result.query).toHaveLength(1);
    expect(result.query[0].parameter.schema).toEqual(whereItem);
    expect(result.query[0].imports).toEqual([
      { name: 'WhereParameter', schemaName: 'Where' },
    ]);
  });

  it('keeps imports empty for inline query parameters', () => {
    const inlineParameter: OpenApiParameterObject = {
      name: 'limit',
      in: 'query',
      schema: { type: 'integer' },
    };

    const result = getParameters({
      parameters: [inlineParameter],
      context: createTestContextSpec(),
    });

    expect(result.query).toEqual([{ parameter: inlineParameter, imports: [] }]);
  });

  it('drops imports when a header parameter $ref targets a non-component slot (issue #1879)', () => {
    // Repro for #1879: JSON Pointer refs into another path's `parameters` array
    // (`#/paths/~1requestA/post/parameters/0`) resolve to a synthesized name
    // like `N0` that has no corresponding `export type`. Surfacing that import
    // would produce a dangling reference downstream — drop it so consumers
    // inline the resolved parameter's `schema` instead. Mirrors the #398 fix
    // applied to schema refs in `resolvers/value.ts`.
    const requestAHeader: OpenApiParameterObject = {
      name: 'Content-Type',
      in: 'header',
      schema: { type: 'string' },
    };
    const context = createTestContextSpec({
      spec: {
        paths: {
          '/requestA': {
            post: { parameters: [requestAHeader], responses: {} },
          },
        },
      },
    });

    const ref: OpenApiReferenceObject = {
      $ref: '#/paths/~1requestA/post/parameters/0',
    };

    const result = getParameters({ parameters: [ref], context });

    expect(result.header).toHaveLength(1);
    expect(result.header[0].parameter.name).toBe('Content-Type');
    // The resolver synthesizes `{ name: 'N0', schemaName: '0' }` from the
    // numeric path segment. Without the fix this leaks downstream and types
    // the header as `N0` while importing it from `./n0`.
    expect(result.header[0].imports).toEqual([]);
  });
});
