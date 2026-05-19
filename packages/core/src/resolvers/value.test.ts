import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiDocument,
  OpenApiReferenceObject,
} from '../types';
import { resolveValue } from './value';

function createContext(spec: OpenApiDocument): ContextSpec {
  return {
    target: 'core-test',
    workspace: '/tmp',
    spec,
    output: {
      override: {
        components: {
          schemas: { suffix: '' },
        },
      },
    },
  } as ContextSpec;
}

describe('resolveValue', () => {
  it('emits a named import for a component schema ref', () => {
    const context = createContext({
      openapi: '3.1.0',
      components: {
        schemas: {
          Pet: {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        },
      },
    });

    const result = resolveValue({
      schema: { $ref: '#/components/schemas/Pet' } as OpenApiReferenceObject,
      context,
    });

    expect(result.value).toBe('Pet');
    expect(result.imports[0]).toMatchObject({
      name: 'Pet',
      schemaName: 'Pet',
    });
    expect(result.isRef).toBe(true);
  });

  // Regression for issue #398: a $ref like `#/paths/.../schema` (emitted by
  // JSON-Schema-Ref-Parser bundle()) resolves to an inline schema with no
  // corresponding `export type`. orval previously generated a broken
  // `import { Schema } from './model'` referencing an undeclared type.
  it('inlines a path-based ref instead of emitting a broken import', () => {
    const context = createContext({
      openapi: '3.0.3',
      paths: {
        '/{id}': {
          get: {
            parameters: [
              {
                in: 'path',
                name: 'id',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/paths/~1%7Bid%7D/get/parameters/0/schema',
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    const result = resolveValue({
      schema: {
        $ref: '#/paths/~1%7Bid%7D/get/parameters/0/schema',
      } as OpenApiReferenceObject,
      context,
    });

    expect(result.value).toBe('string');
    expect(result.imports).toHaveLength(0);
    expect(result.isRef).toBe(false);
  });

  // Defensive guard: a self-referential path-ref would otherwise recurse via
  // getScalar -> resolveValue forever, since the named-ref cycle tracker keys
  // off `resolvedImport.name` and not the ref string.
  it('breaks cycles on self-referential path-based refs', () => {
    const selfRef =
      '#/paths/~1self/get/responses/200/content/application~1json/schema';
    const context = createContext({
      openapi: '3.0.3',
      paths: {
        '/self': {
          get: {
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        child: { $ref: selfRef },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(() =>
      resolveValue({
        schema: { $ref: selfRef } as OpenApiReferenceObject,
        context,
      }),
    ).not.toThrow();
  });
});
