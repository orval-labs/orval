import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import type { OpenApiDocument } from '@orval/core';
import { noopReporter, withReporter } from '@orval/core';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
  dereferenceExternalRef,
  importSpecs,
  normalizeNullableRefs,
  normalizeToOpenApi31,
  validateComponentKeys,
} from './import-specs';
import { normalizeOptions } from './utils';

const TEST_SPEC: OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Single Route API',
    version: '1.0.0',
  },
  paths: {
    '/{workspace_id}/resource/{id}': {
      post: {
        summary: 'Single endpoint with optional inputs',
        operationId: 'handleResource',
        parameters: [
          {
            name: 'workspace_id',
            in: 'path',
            required: true,
            description:
              'Path identifier (logically optional, but required by OpenAPI)',
            schema: {
              type: 'string',
            },
          },
          {
            name: 'id',
            in: 'path',
            required: true,
            description:
              'Path identifier (logically optional, but required by OpenAPI)',
            schema: {
              type: 'string',
            },
          },
          {
            name: 'filter',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
          },
          {
            name: 'X-Request-Mode',
            in: 'header',
            required: false,
            schema: {
              type: 'string',
            },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  value: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Success',
          },
        },
      },
    },
  },
};

const OPTIONAL_SECURITY_SPEC: OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Optional Security API',
    version: '1.0.0',
  },
  paths: {
    '/public-or-authenticated': {
      get: {
        operationId: 'publicOrAuthenticated',
        security: [{}, { ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'Success',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
      },
    },
  },
};

const SSE_ITEM_SCHEMA_SPEC: OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'FastAPI',
    version: '0.1.0',
  },
  paths: {
    '/api/events/': {
      post: {
        tags: ['stream'],
        summary: 'Sse Endpoint',
        operationId: 'sse_endpoint',
        responses: {
          '200': {
            description: 'Successful Response',
            content: {
              'text/event-stream': {
                itemSchema: {
                  type: 'object',
                  properties: {
                    data: { type: 'string' },
                    event: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/pets': {
      get: {
        tags: ['pets'],
        summary: 'List Pets',
        operationId: 'list_pets',
        responses: {
          '200': {
            description: 'Successful Response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

describe('validation', () => {
  it('should accept optional security alternatives during import', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: { target: '' },
        input: { target: OPTIONAL_SECURITY_SPEC },
      },
      workspace,
      {},
    );

    const spec = await importSpecs(workspace, normalizedOptions);
    expect(spec.verbOptions).toHaveProperty('publicOrAuthenticated');
    expect(
      spec.spec.paths?.['/public-or-authenticated']?.get?.security,
    ).toEqual([{}, { ApiKeyAuth: [] }]);
  });

  it('should throw on non-standard fields like itemSchema by default', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: { target: '' },
        input: { target: SSE_ITEM_SCHEMA_SPEC },
      },
      workspace,
      {},
    );

    await expect(importSpecs(workspace, normalizedOptions)).rejects.toThrow(
      'OpenAPI spec validation failed',
    );
  });

  it('should run override.transformer before validation so users can repair malformed specs', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: { target: '' },
        input: {
          target: SSE_ITEM_SCHEMA_SPEC,
          override: {
            transformer: (spec: OpenApiDocument) => {
              // Strip the non-standard `itemSchema` field that would otherwise
              // fail validation, replacing it with a compliant `schema` field.
              type MediaContent = Record<string, Record<string, unknown>>;
              const next = structuredClone(spec);
              const sseResponse = next.paths?.['/api/events/']?.post
                ?.responses?.['200'] as { content?: MediaContent } | undefined;
              const eventStream = sseResponse?.content?.['text/event-stream'];
              if (eventStream && 'itemSchema' in eventStream) {
                eventStream.schema = eventStream.itemSchema;
                delete eventStream.itemSchema;
              }
              return next;
            },
          },
        },
      },
      workspace,
      {},
    );

    const spec = await importSpecs(workspace, normalizedOptions);
    expect(spec.verbOptions).toHaveProperty('sse_endpoint');
    expect(spec.verbOptions).toHaveProperty('list_pets');
    // The transformer rewrote `itemSchema` -> `schema`, so the SSE response
    // should resolve to a real generated type rather than the default `void`.
    // Resolve the schema dynamically from the verb's response type instead of
    // hard-coding the synthesized name so this doesn't break if orval's
    // response-schema naming convention changes.
    const sseReturn = spec.verbOptions.sse_endpoint.response.definition.success;
    expect(sseReturn).not.toBe('void');
    const sseSchema = spec.schemas.find((s) => s.name === sseReturn);
    expect(sseSchema?.model).toContain('data');
    expect(sseSchema?.model).toContain('event');
  });

  it('should throw a clear error when override.transformer returns nothing', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: { target: '' },
        input: {
          target: SSE_ITEM_SCHEMA_SPEC,
          override: {
            transformer: (() =>
              undefined as unknown as OpenApiDocument) satisfies (
              spec: OpenApiDocument,
            ) => OpenApiDocument,
          },
        },
      },
      workspace,
      {},
    );

    // JS assigns `.name` from the property key when an inline function is
    // bound to an object literal, so the source pointer is `transformer`
    // here. A truly anonymous function falls back to `<inline function>`.
    await expect(importSpecs(workspace, normalizedOptions)).rejects.toThrow(
      /input\.override\.transformer must return an OpenAPI document object; got undefined from transformer/,
    );
  });

  it('should skip validation when input.unsafeDisableValidation is true', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: { target: '' },
        input: { target: SSE_ITEM_SCHEMA_SPEC, unsafeDisableValidation: true },
      },
      workspace,
      {},
    );

    expect(normalizedOptions.input.unsafeDisableValidation).toBe(true);

    const warn = vi.fn();
    const spec = await withReporter({ ...noopReporter, warn }, () =>
      importSpecs(workspace, normalizedOptions),
    );

    expect(spec.verbOptions).toHaveProperty('sse_endpoint');
    expect(spec.verbOptions).toHaveProperty('list_pets');

    const warnings = warn.mock.calls.map(([event]) => event.message).join('\n');
    expect(warnings).toContain('OpenAPI spec validation is disabled');
  });

  it('should resolve external $ref injected by override.transformer (#3327)', async () => {
    // A transformer can inject a NEW external $ref (e.g. refs.yaml#/...) that was
    // absent from the original spec, so it never went through the initial bundle.
    // The injected refs must be bundled & dereferenced against the spec's origin,
    // otherwise generation fails with "Can't resolve external reference".
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), 'orval-issue-3327-'),
    );
    const specPath = path.join(workspace, 'spec.yaml');

    // JSON is a strict subset of YAML, so JSON content in .yaml files parses fine.
    const spec = {
      openapi: '3.0.2',
      info: { title: 'repro', version: '1.0.0' },
      paths: {
        '/path': {
          get: {
            operationId: 'getPath',
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Field' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Field: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    };
    const refs = {
      components: {
        schemas: {
          Point: {
            type: 'object',
            properties: { kind: { type: 'string', enum: ['Point'] } },
          },
          LineString: {
            type: 'object',
            properties: { kind: { type: 'string', enum: ['LineString'] } },
          },
        },
      },
    };

    try {
      await writeFile(specPath, JSON.stringify(spec), 'utf8');
      await writeFile(
        path.join(workspace, 'refs.yaml'),
        JSON.stringify(refs),
        'utf8',
      );

      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: { externalRefs: { allow: ['refs.yaml'] } },
            override: {
              transformer: (input: OpenApiDocument) => {
                const next = structuredClone(input);
                const field = next.components?.schemas?.Field as
                  | { properties: Record<string, unknown> }
                  | undefined;
                if (field) {
                  field.properties.geometry = {
                    oneOf: [
                      { $ref: 'refs.yaml#/components/schemas/Point' },
                      { $ref: 'refs.yaml#/components/schemas/LineString' },
                    ],
                  };
                }
                return next;
              },
            },
          },
        },
        workspace,
        {},
      );

      const result = await importSpecs(workspace, normalizedOptions);

      // The external schemas should now be merged into the generated output.
      const names = result.schemas.map((s) => s.name);
      expect(names).toContain('Point');
      expect(names).toContain('LineString');

      // Field.geometry should reference the resolved named types, not a raw
      // external file ref.
      const field = result.schemas.find((s) => s.name === 'Field');
      expect(field?.model).toContain('Point');
      expect(field?.model).toContain('LineString');
      expect(field?.model).not.toContain('refs.yaml');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('should apply async compress and always naming to transformer refs', async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), 'orval-issue-3166-transformer-'),
    );
    const specPath = path.join(workspace, 'spec.yaml');
    const externalPath = path.join(workspace, 'refs.yaml');
    const compressInputs: string[] = [];

    const spec = {
      openapi: '3.0.2',
      info: { title: 'transformer', version: '1.0.0' },
      paths: {
        '/path': {
          get: {
            operationId: 'getPath',
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Field' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Field: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    };
    const external = {
      components: {
        schemas: {
          Point: { type: 'object', properties: { x: { type: 'number' } } },
        },
      },
    };

    try {
      await writeFile(specPath, JSON.stringify(spec), 'utf8');
      await writeFile(externalPath, JSON.stringify(external), 'utf8');

      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: {
              compress: async (value) => {
                compressInputs.push(value);
                return 'refs';
              },
              externalRefs: {
                allow: ['refs.yaml'],
                strategy: 'always',
              },
            },
            override: {
              transformer: (input: OpenApiDocument) => {
                const next = structuredClone(input);
                const field = next.components?.schemas?.Field as
                  | { properties?: Record<string, unknown> }
                  | undefined;
                if (field) {
                  field.properties ??= {};
                  field.properties.geometry = {
                    $ref: 'refs.yaml#/components/schemas/Point',
                  };
                }
                return next;
              },
            },
          },
        },
        workspace,
        {},
      );

      const result = await importSpecs(workspace, normalizedOptions);

      expect(compressInputs).toContain('refs.yaml');
      expect(result.spec.components?.schemas).toHaveProperty('Point_refs');
      expect(result.spec.components?.schemas?.Field).toEqual(
        expect.objectContaining({
          properties: {
            id: { type: 'string' },
            geometry: { $ref: '#/components/schemas/Point_refs' },
          },
        }),
      );
      expect(JSON.stringify(result.spec)).not.toContain('refs.yaml');
      expect(JSON.stringify(result.spec)).not.toContain('#/x-ext/');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('should preserve date-like enum strings from YAML specs', async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), 'orval-yaml-date-enum-'),
    );
    const specPath = path.join(workspace, 'spec.yaml');

    // Write raw YAML (not JSON) so js-yaml actually parses the content.
    // Without JSON_SCHEMA, js-yaml coerces `2026-01-27` into a Date object.
    const yamlContent = [
      'openapi: "3.0.3"',
      'info:',
      '  title: DateEnumRepro',
      '  version: "1.0.0"',
      'paths:',
      '  /test:',
      '    get:',
      '      operationId: getTest',
      '      responses:',
      '        "200":',
      '          description: OK',
      '          content:',
      '            application/json:',
      '              schema:',
      '                $ref: "#/components/schemas/ApiVersion"',
      'components:',
      '  schemas:',
      '    ApiVersion:',
      '      type: string',
      '      enum:',
      '        - latest',
      '        - 2026-01-27',
    ].join('\n');

    try {
      await writeFile(specPath, yamlContent, 'utf8');

      const normalizedOptions = await normalizeOptions(
        { output: { target: '' }, input: { target: specPath } },
        workspace,
        {},
      );

      const result = await importSpecs(workspace, normalizedOptions);

      const apiVersion = result.schemas.find((s) => s.name === 'ApiVersion');
      expect(apiVersion).toBeDefined();
      expect(apiVersion?.model).toContain("'2026-01-27'");
      expect(apiVersion?.model).not.toContain('GMT');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('should resolve YAML merge keys in specs that use anchors', async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), 'orval-yaml-merge-key-'),
    );
    const specPath = path.join(workspace, 'spec.yaml');

    // Regression spec for https://github.com/orval-labs/orval/issues/4102:
    // `<<` is a YAML merge key, resolved by js-yaml's DEFAULT_SCHEMA but not by
    // JSON_SCHEMA. Left unresolved, the literal `<<` keys survive into the
    // document and the validator rejects them with
    // "Property << is not expected to be here".
    const yamlContent = [
      'openapi: "3.0.0"',
      'info:',
      '  title: MergeKeyRepro',
      '  version: "1.0.0"',
      'x-responses:',
      '  default-authenticated: &authenticated-responses',
      '    "401":',
      '      description: Unauthorized',
      'paths:',
      '  /api/dmz/resource:',
      '    post: &dmz-resource',
      '      operationId: dmzPostResource',
      '      responses: &dmz-post-resource-responses',
      '        "200":',
      '          description: OK',
      '          content:',
      '            application/json:',
      '              schema:',
      '                $ref: "#/components/schemas/Response"',
      '  /api/resource:',
      '    post:',
      '      <<: *dmz-resource',
      '      operationId: postResource',
      '      responses:',
      '        <<: [*dmz-post-resource-responses, *authenticated-responses]',
      'components:',
      '  schemas:',
      '    Response:',
      '      type: string',
    ].join('\n');

    try {
      await writeFile(specPath, yamlContent, 'utf8');

      const normalizedOptions = await normalizeOptions(
        { output: { target: '' }, input: { target: specPath } },
        workspace,
        {},
      );

      const result = await importSpecs(workspace, normalizedOptions);

      const merged = result.spec.paths?.['/api/resource']?.post;
      expect(merged).toBeDefined();
      expect(merged).not.toHaveProperty('<<');
      // The merged operation keeps its own overrides and inherits the rest.
      expect(merged?.operationId).toBe('postResource');
      expect(Object.keys(merged?.responses ?? {})).toEqual(
        expect.arrayContaining(['200', '401']),
      );
      expect(merged?.responses).not.toHaveProperty('<<');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('specParsing', () => {
  // JSON specs take `JSON.parse` instead of js-yaml, and specs whose $refs are
  // all local JSON pointers skip the bundle + dereference pipeline entirely
  // (#3805). Both fast paths must produce exactly what the slow paths did.
  const JSON_SPEC = {
    openapi: '3.0.3',
    info: { title: 'JsonFastPath', version: '1.0.0' },
    paths: {
      '/test': {
        get: {
          operationId: 'getTest',
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiVersion' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ApiVersion: { type: 'string', enum: ['latest', '2026-01-27'] },
      },
    },
  };

  async function importJsonSpec(content: string, prefix: string) {
    const workspace = await mkdtemp(path.join(os.tmpdir(), prefix));
    const specPath = path.join(workspace, 'spec.json');
    try {
      await writeFile(specPath, content, 'utf8');
      const normalizedOptions = await normalizeOptions(
        { output: { target: '' }, input: { target: specPath } },
        workspace,
        {},
      );
      return await importSpecs(workspace, normalizedOptions);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  it('should parse JSON specs and resolve their local refs', async () => {
    const result = await importJsonSpec(
      JSON.stringify(JSON_SPEC, undefined, 2),
      'orval-json-parse-',
    );

    const apiVersion = result.schemas.find((s) => s.name === 'ApiVersion');
    // The date-like enum member must stay a string, exactly as with js-yaml's
    // JSON_SCHEMA (#3947), and the local $ref must still resolve.
    expect(apiVersion?.model).toContain("'2026-01-27'");
    expect(apiVersion?.model).not.toContain('GMT');
    expect(JSON.stringify(result.spec)).not.toContain('x-ext');
  });

  it('should parse a JSON spec that carries a byte order mark', async () => {
    const result = await importJsonSpec(
      '﻿' + JSON.stringify(JSON_SPEC),
      'orval-json-bom-',
    );

    expect(result.verbOptions).toHaveProperty('getTest');
  });

  it('should fall back to the YAML parser for YAML that starts with "{"', async () => {
    // A flow mapping with a comment and unquoted keys: js-yaml accepts it,
    // `JSON.parse` does not, so the fast path has to fall back.
    const yamlFlow = [
      '{ # a YAML comment inside a flow mapping',
      '  openapi: "3.0.3",',
      '  info: { title: FlowMapping, version: "1.0.0" },',
      '  paths: {',
      '    /test: { get: { operationId: getTest, responses: { "200": { description: OK } } } }',
      '  }',
      '}',
    ].join('\n');

    const result = await importJsonSpec(yamlFlow, 'orval-json-fallback-');

    expect(result.verbOptions).toHaveProperty('getTest');
  });

  it('should report a parse error for text that is neither JSON nor YAML', async () => {
    await expect(
      importJsonSpec('{ "openapi": "3.0.3", ]', 'orval-json-invalid-'),
    ).rejects.toThrow();
  });

  it('should not mutate an in-memory spec passed as input.target', async () => {
    const workspace = 'test';
    const target = structuredClone(JSON_SPEC) as unknown as OpenApiDocument;
    const before = structuredClone(target);

    const normalizedOptions = await normalizeOptions(
      { output: { target: '' }, input: { target } },
      workspace,
      {},
    );
    await importSpecs(workspace, normalizedOptions);

    expect(target).toEqual(before);
  });
});

describe('swagger2FormData', () => {
  // Regression spec for https://github.com/orval-labs/orval/issues/3857:
  // @scalar/openapi-parser's upgrade() drops the `items` of Swagger 2.0
  // formData array parameters when converting them to a requestBody schema,
  // so generated types would degrade from `string[]` to `unknown[]`.
  const SWAGGER2_FORM_DATA_SPEC = {
    swagger: '2.0',
    info: { title: 'Form Data API (OAS 2.0)', version: '1.0.0' },
    basePath: '/',
    parameters: {
      tagList: {
        name: 'tags',
        in: 'formData',
        required: true,
        type: 'array',
        items: { type: 'string' },
      },
    },
    paths: {
      '/submit': {
        post: {
          operationId: 'submitForm',
          consumes: ['application/x-www-form-urlencoded'],
          produces: ['application/json'],
          parameters: [
            {
              name: 'tags',
              in: 'formData',
              required: true,
              type: 'array',
              items: { type: 'string' },
              collectionFormat: 'csv',
            },
          ],
          responses: {
            '200': {
              description: 'Success',
              schema: {
                type: 'object',
                properties: { ok: { type: 'boolean' } },
              },
            },
          },
        },
      },
      '/upload': {
        post: {
          operationId: 'uploadForm',
          consumes: ['multipart/form-data'],
          parameters: [{ $ref: '#/parameters/tagList' }],
          responses: { '200': { description: 'Success' } },
        },
      },
      '/ints': {
        post: {
          operationId: 'intListForm',
          consumes: ['application/x-www-form-urlencoded'],
          parameters: [
            {
              name: 'ids',
              in: 'formData',
              required: true,
              type: 'array',
              items: { type: 'integer', format: 'int64' },
            },
          ],
          responses: { '200': { description: 'Success' } },
        },
      },
    },
  };

  async function importSwagger2FormData() {
    const normalizedOptions = await normalizeOptions(
      {
        output: { target: '' },
        input: { target: SWAGGER2_FORM_DATA_SPEC },
      },
      'test',
      {},
    );
    return importSpecs('test', normalizedOptions);
  }

  it('keeps items on inline formData array parameters (#3857)', async () => {
    const spec = await importSwagger2FormData();
    const body = spec.schemas.find((s) => s.name === 'SubmitFormBody');
    expect(body?.model).toContain('tags: string[]');
    expect(body?.model).not.toContain('unknown[]');
  });

  it('keeps items on reusable formData parameters referenced via #/parameters (#3857)', async () => {
    const spec = await importSwagger2FormData();
    const body = spec.schemas.find((s) => s.name === 'TagListBody');
    expect(body?.model).toContain('tags: string[]');
    expect(body?.model).not.toContain('unknown[]');
  });

  it('keeps non-string item types (integer → number[]) (#3857)', async () => {
    const spec = await importSwagger2FormData();
    const body = spec.schemas.find((s) => s.name === 'IntListFormBody');
    expect(body?.model).toContain('ids: number[]');
    expect(body?.model).not.toContain('unknown[]');
  });

  it('keeps items on path-level inline formData array parameters (#3857)', async () => {
    // Swagger 2.0 allows parameters on a Path Item Object; they apply to every
    // operation under the path. The capture must merge them in.
    const spec = {
      swagger: '2.0',
      info: { title: 'Path-level form data', version: '1.0.0' },
      paths: {
        '/submit': {
          parameters: [
            {
              name: 'tags',
              in: 'formData',
              required: true,
              type: 'array',
              items: { type: 'string' },
            },
          ],
          post: {
            operationId: 'submitForm',
            consumes: ['application/x-www-form-urlencoded'],
            responses: { '200': { description: 'Success' } },
          },
        },
      },
    };
    const normalizedOptions = await normalizeOptions(
      { output: { target: '' }, input: { target: spec } },
      'test',
      {},
    );
    const result = await importSpecs('test', normalizedOptions);
    const body = result.schemas.find((s) => s.name === 'SubmitFormBody');
    expect(body?.model).toContain('tags: string[]');
    expect(body?.model).not.toContain('unknown[]');
  });

  it('keeps items on path-level reusable formData parameters (#3857)', async () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Path-level reusable form data', version: '1.0.0' },
      parameters: {
        tagList: {
          name: 'tags',
          in: 'formData',
          required: true,
          type: 'array',
          items: { type: 'string' },
        },
      },
      paths: {
        '/submit': {
          parameters: [{ $ref: '#/parameters/tagList' }],
          post: {
            operationId: 'submitForm',
            consumes: ['multipart/form-data'],
            responses: { '200': { description: 'Success' } },
          },
        },
      },
    };
    const normalizedOptions = await normalizeOptions(
      { output: { target: '' }, input: { target: spec } },
      'test',
      {},
    );
    const result = await importSpecs('test', normalizedOptions);
    // Reusable formData parameters are promoted to a requestBody component, so
    // the generated body type takes its name from the reusable parameter key.
    const body = result.schemas.find((s) => s.name === 'TagListBody');
    expect(body?.model).toContain('tags: string[]');
    expect(body?.model).not.toContain('unknown[]');
  });

  it('lets operation-level parameters override path-level ones (#3857)', async () => {
    const spec = {
      swagger: '2.0',
      info: { title: 'Path-level override', version: '1.0.0' },
      paths: {
        '/submit': {
          parameters: [
            {
              name: 'tags',
              in: 'formData',
              required: true,
              type: 'array',
              items: { type: 'string' },
            },
          ],
          post: {
            operationId: 'submitForm',
            consumes: ['application/x-www-form-urlencoded'],
            parameters: [
              {
                name: 'tags',
                in: 'formData',
                required: true,
                type: 'array',
                items: { type: 'integer', format: 'int64' },
              },
            ],
            responses: { '200': { description: 'Success' } },
          },
        },
      },
    };
    const normalizedOptions = await normalizeOptions(
      { output: { target: '' }, input: { target: spec } },
      'test',
      {},
    );
    const result = await importSpecs('test', normalizedOptions);
    const body = result.schemas.find((s) => s.name === 'SubmitFormBody');
    expect(body?.model).toContain('tags: number[]');
    expect(body?.model).not.toContain('unknown[]');
  });

  it('keeps shared path-level bodies intact when an operation overrides a parameter (#3857)', async () => {
    // A reusable path-level formData parameter is promoted to a shared
    // components.requestBodies entry referenced from the Path Item. When one
    // operation overrides that parameter, the override lives in the operation's
    // own request body — it must never be written into the shared body, which
    // other operations still use.
    const spec = {
      swagger: '2.0',
      info: { title: 'Shared path-level override', version: '1.0.0' },
      parameters: {
        tagList: {
          name: 'tags',
          in: 'formData',
          required: true,
          type: 'array',
          items: { type: 'string' },
        },
      },
      paths: {
        '/submit': {
          parameters: [{ $ref: '#/parameters/tagList' }],
          // The overriding operation is declared first so the repair cannot
          // hide behind iteration order: the shared body is patched by the
          // override before the non-overriding operation visits it.
          put: {
            operationId: 'replaceForm',
            consumes: ['multipart/form-data'],
            parameters: [
              {
                name: 'tags',
                in: 'formData',
                required: true,
                type: 'array',
                items: { type: 'integer', format: 'int64' },
              },
            ],
            responses: { '200': { description: 'Success' } },
          },
          post: {
            operationId: 'submitForm',
            consumes: ['multipart/form-data'],
            responses: { '200': { description: 'Success' } },
          },
        },
      },
    };
    const normalizedOptions = await normalizeOptions(
      { output: { target: '' }, input: { target: spec } },
      'test',
      {},
    );
    const result = await importSpecs('test', normalizedOptions);
    // The shared, path-level request body must keep the path-level item type.
    const shared = result.schemas.find((s) => s.name === 'TagListBody');
    expect(shared?.model).toContain('tags: string[]');
    expect(shared?.model).not.toContain('unknown[]');
    expect(shared?.model).not.toContain('number[]');
    // The overriding operation gets its own body with the operation-level type.
    const override = result.schemas.find((s) => s.name === 'ReplaceFormBody');
    expect(override?.model).toContain('tags: number[]');
    expect(override?.model).not.toContain('unknown[]');
  });

  it('does not alter OAS 3 formData array parameters (#3857)', async () => {
    // The working OAS 3.0 counterpart from the issue: item types are already
    // preserved by the upgrader, so the repair must be a no-op.
    const normalizedOptions = await normalizeOptions(
      {
        output: { target: '' },
        input: {
          target: {
            openapi: '3.0.3',
            info: { title: 'Form Data API (OAS 3.0)', version: '1.0.0' },
            paths: {
              '/submit': {
                post: {
                  operationId: 'submitForm',
                  requestBody: {
                    required: true,
                    content: {
                      'application/x-www-form-urlencoded': {
                        schema: {
                          type: 'object',
                          required: ['tags'],
                          properties: {
                            tags: {
                              type: 'array',
                              items: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                  responses: {
                    '200': {
                      description: 'Success',
                      content: {
                        'application/json': {
                          schema: {
                            type: 'object',
                            properties: { ok: { type: 'boolean' } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      'test',
      {},
    );

    const spec = await importSpecs('test', normalizedOptions);
    const body = spec.schemas.find((s) => s.name === 'SubmitFormBody');
    expect(body?.model).toContain('tags: string[]');
    expect(body?.model).not.toContain('unknown[]');
  });
});

describe('externalRefs', () => {
  async function createExternalRefWorkspace() {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'orval-allow-'));
    const specPath = path.join(workspace, 'spec.yaml');
    const externalPath = path.join(workspace, 'external.yaml');
    const external = {
      openapi: '3.0.2',
      info: { title: 'ext', version: '1.0' },
      paths: {},
      components: { schemas: { Foo: { type: 'string' } } },
    };
    const spec = {
      openapi: '3.0.2',
      info: { title: 'main', version: '1.0' },
      paths: {
        '/x': {
          get: {
            operationId: 'getX',
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: 'external.yaml#/components/schemas/Foo' },
                  },
                },
              },
            },
          },
        },
      },
    };
    await writeFile(externalPath, JSON.stringify(external), 'utf8');
    await writeFile(specPath, JSON.stringify(spec), 'utf8');
    return { workspace, specPath };
  }

  async function createSchemaRefWorkspace(
    externalFiles: Record<string, unknown>,
    refs: Record<string, string>,
  ) {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'orval-schema-'));
    const specPath = path.join(workspace, 'spec.yaml');
    const paths = Object.fromEntries(
      Object.entries(refs).map(([name, ref]) => [
        `/${name}`,
        {
          get: {
            operationId: `get${name}`,
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': { schema: { $ref: ref } },
                },
              },
            },
          },
        },
      ]),
    );

    await Promise.all(
      Object.entries(externalFiles).map(([fileName, document]) =>
        writeFile(
          path.join(workspace, fileName),
          JSON.stringify(document),
          'utf8',
        ),
      ),
    );
    await writeFile(
      specPath,
      JSON.stringify({
        openapi: '3.0.2',
        info: { title: 'main', version: '1.0' },
        paths,
      }),
      'utf8',
    );

    return { workspace, specPath };
  }

  it('should block external $ref by default and print a config snippet', async () => {
    const { workspace, specPath } = await createExternalRefWorkspace();
    try {
      const normalizedOptions = await normalizeOptions(
        { output: { target: '' }, input: { target: specPath } },
        workspace,
        {},
      );
      await expect(importSpecs(workspace, normalizedOptions)).rejects.toThrow(
        /External \$ref targets are not allowed by default/,
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('should resolve external $ref when explicitly allowed', async () => {
    const { workspace, specPath } = await createExternalRefWorkspace();
    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: { externalRefs: { allow: ['external.yaml'] } },
          },
        },
        workspace,
        {},
      );
      const spec = await importSpecs(workspace, normalizedOptions);
      expect(spec.verbOptions).toHaveProperty('getX');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('should resolve all external $refs with wildcard and emit warnings', async () => {
    const { workspace, specPath } = await createExternalRefWorkspace();
    const warn = vi.fn();
    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: { externalRefs: { allow: ['*'] } },
          },
        },
        workspace,
        {},
      );
      const spec = await withReporter({ ...noopReporter, warn }, () =>
        importSpecs(workspace, normalizedOptions),
      );
      expect(spec.verbOptions).toHaveProperty('getX');

      const warnings = warn.mock.calls
        .map(([event]) => event.message)
        .join('\n');
      expect(warnings).toContain('External $ref documents being resolved');
      expect(warnings).toContain('external.yaml');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('should use configured headers when loading a remote top-level spec', async () => {
    const remoteTarget = 'https://api.example.com/openapi.json';
    const spec = {
      openapi: '3.0.2',
      info: { title: 'remote', version: '1.0' },
      paths: {},
    };
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer token',
      );
      if (init?.method === 'HEAD') {
        return new Response(undefined, { status: 200 });
      }
      return new Response(JSON.stringify(spec), { status: 200 });
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);
    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: [remoteTarget],
            parserOptions: {
              headers: [
                {
                  domains: ['api.example.com'],
                  headers: { Authorization: 'Bearer token' },
                },
              ],
            },
          },
        },
        'test',
        {},
      );

      const specBuilder = await importSpecs('test', normalizedOptions);

      expect(specBuilder.spec.info?.title).toBe('remote');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('should allow remote relative refs when listed relative to the remote spec', async () => {
    const remoteTarget = 'https://api.example.com/openapi.json';
    const spec = {
      openapi: '3.0.2',
      info: { title: 'remote', version: '1.0' },
      paths: {
        '/x': {
          get: {
            operationId: 'getX',
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: './common.yaml#/components/schemas/Foo' },
                  },
                },
              },
            },
          },
        },
      },
    };
    const external = {
      openapi: '3.0.2',
      info: { title: 'external', version: '1.0' },
      paths: {},
      components: { schemas: { Foo: { type: 'string' } } },
    };
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      if (init?.method === 'HEAD') {
        return new Response(undefined, { status: 200 });
      }
      const url = input instanceof Request ? input.url : String(input);
      return new Response(
        JSON.stringify(url.endsWith('/common.yaml') ? external : spec),
        { status: 200 },
      );
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);
    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: [remoteTarget],
            parserOptions: { externalRefs: { allow: ['./common.yaml'] } },
          },
        },
        'test',
        {},
      );

      const specBuilder = await importSpecs('test', normalizedOptions);

      expect(specBuilder.verbOptions).toHaveProperty('getX');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('should forward compress and always-suffix external schemas', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'orval-compress-'));
    const specPath = path.join(workspace, 'spec.yaml');
    const externalPath = path.join(workspace, 'billing.yaml');

    await writeFile(
      externalPath,
      JSON.stringify({
        openapi: '3.0.2',
        info: { title: 'billing', version: '1.0' },
        paths: {},
        components: {
          schemas: {
            User: { type: 'object' },
          },
        },
      }),
      'utf8',
    );
    await writeFile(
      specPath,
      JSON.stringify({
        openapi: '3.0.2',
        info: { title: 'main', version: '1.0' },
        paths: {
          '/user': {
            get: {
              operationId: 'getUser',
              responses: {
                '200': {
                  description: 'ok',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: 'billing.yaml#/components/schemas/User',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      'utf8',
    );

    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: {
              compress: () => 'billing',
              externalRefs: {
                allow: ['billing.yaml'],
                strategy: 'always',
              },
            },
          },
        },
        workspace,
        {},
      );

      const result = await importSpecs(workspace, normalizedOptions);

      expect(result.spec.components?.schemas).toHaveProperty('User_billing');
      expect(
        result.spec.paths?.['/user']?.get?.responses?.['200']?.content?.[
          'application/json'
        ]?.schema,
      ).toEqual({ $ref: '#/components/schemas/User_billing' });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('should await an async compress callback end to end', async () => {
    const compressInputs: string[] = [];
    const { workspace, specPath } = await createSchemaRefWorkspace(
      {
        'billing.yaml': {
          components: { schemas: { User: { type: 'object' } } },
        },
      },
      { user: 'billing.yaml#/components/schemas/User' },
    );

    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: {
              compress: async (value) => {
                compressInputs.push(value);
                return 'billing';
              },
              externalRefs: {
                allow: ['billing.yaml'],
                strategy: 'always',
              },
            },
          },
        },
        workspace,
        {},
      );

      const result = await importSpecs(workspace, normalizedOptions);

      expect(compressInputs).toEqual(['billing.yaml']);
      expect(result.spec.components?.schemas).toHaveProperty('User_billing');
      expect(
        result.spec.paths?.['/user']?.get?.responses?.['200']?.content,
      ).toEqual({
        'application/json': {
          schema: { $ref: '#/components/schemas/User_billing' },
        },
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it("should use Scalar's generated key for always mode without compress", async () => {
    const { workspace, specPath } = await createSchemaRefWorkspace(
      {
        'billing.yaml': {
          components: { schemas: { User: { type: 'object' } } },
        },
      },
      { user: 'billing.yaml#/components/schemas/User' },
    );

    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: {
              externalRefs: {
                allow: ['billing.yaml'],
                strategy: 'always',
              },
            },
          },
        },
        workspace,
        {},
      );

      const result = await importSpecs(workspace, normalizedOptions);
      const schemaNames = Object.keys(result.spec.components?.schemas ?? {});
      const generatedName = schemaNames.find((name) =>
        name.startsWith('User_'),
      );

      expect(generatedName).toMatch(/^User_[a-zA-Z0-9]+$/);
      expect(generatedName).not.toBe('User_billing');
      expect(
        result.spec.paths?.['/user']?.get?.responses?.['200']?.content?.[
          'application/json'
        ]?.schema,
      ).toEqual({ $ref: `#/components/schemas/${generatedName}` });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('should keep stable names when external schema content changes', async () => {
    const { workspace, specPath } = await createSchemaRefWorkspace(
      {
        'billing.yaml': {
          components: {
            schemas: {
              User: {
                type: 'object',
                required: ['id'],
                properties: { id: { type: 'string' } },
              },
            },
          },
        },
      },
      { user: 'billing.yaml#/components/schemas/User' },
    );

    const importWithStableIdentity = async () => {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: {
              compress: () => 'billing',
              externalRefs: {
                allow: ['billing.yaml'],
                strategy: 'always',
              },
            },
          },
        },
        workspace,
        {},
      );
      return importSpecs(workspace, normalizedOptions);
    };

    try {
      const first = await importWithStableIdentity();
      await writeFile(
        path.join(workspace, 'billing.yaml'),
        JSON.stringify({
          components: {
            schemas: {
              User: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'string' },
                  nickname: { type: 'string' },
                },
              },
            },
          },
        }),
        'utf8',
      );
      const second = await importWithStableIdentity();

      expect(first.spec.components?.schemas).toHaveProperty('User_billing');
      expect(second.spec.components?.schemas).toHaveProperty('User_billing');
      expect(first.spec.components?.schemas?.User_billing).not.toHaveProperty(
        'properties.nickname',
      );
      expect(second.spec.components?.schemas?.User_billing).toHaveProperty(
        'properties.nickname',
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('should propagate Scalar compressor collisions without a secondary error', async () => {
    const { workspace, specPath } = await createSchemaRefWorkspace(
      {
        'billing.yaml': {
          components: { schemas: { User: { type: 'object' } } },
        },
        'catalog.yaml': {
          components: { schemas: { User: { type: 'object' } } },
        },
      },
      {
        billing: 'billing.yaml#/components/schemas/User',
        catalog: 'catalog.yaml#/components/schemas/User',
      },
    );

    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: {
              compress: () => 'same',
              externalRefs: {
                allow: ['billing.yaml', 'catalog.yaml'],
                strategy: 'always',
              },
            },
          },
        },
        workspace,
        {},
      );

      await expect(importSpecs(workspace, normalizedOptions)).rejects.toBe(
        'Can not generate unique compressed values',
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('externalRefs allow-list and redirects', () => {
  const EXTERNAL_DOC = JSON.stringify({
    openapi: '3.0.2',
    info: { title: 'ext', version: '1.0' },
    paths: {},
    components: { schemas: { Foo: { type: 'string' } } },
  });

  /**
   * Two loopback servers: `redirectUrl` answers 302 pointing at `targetUrl`,
   * and `targetUrl` serves the external document while counting requests.
   */
  async function startRedirectingServers() {
    const target = http.createServer((req, res) => {
      target.hits += 1;
      target.lastHeaders = { ...req.headers };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(EXTERNAL_DOC);
    }) as http.Server & {
      hits: number;
      lastHeaders: Record<string, string | string[] | undefined>;
    };
    target.hits = 0;
    target.lastHeaders = {};

    await new Promise<void>((resolve) =>
      target.listen(0, '127.0.0.1', resolve),
    );
    const targetPort = (target.address() as AddressInfo).port;
    const targetUrl = `http://127.0.0.1:${targetPort}/external.json`;

    const redirector = http.createServer((_req, res) => {
      res.writeHead(302, { Location: targetUrl });
      res.end();
    });
    await new Promise<void>((resolve) =>
      redirector.listen(0, '127.0.0.1', resolve),
    );
    const redirectUrl = `http://127.0.0.1:${(redirector.address() as AddressInfo).port}/external.json`;

    return {
      redirectUrl,
      targetUrl,
      get targetHits() {
        return target.hits;
      },
      get targetHeaders() {
        return target.lastHeaders;
      },
      async close() {
        await Promise.all([
          new Promise<void>((resolve) => target.close(() => resolve())),
          new Promise<void>((resolve) => redirector.close(() => resolve())),
        ]);
      },
    };
  }

  async function createWorkspaceFor(ref: string) {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'orval-redirect-'));
    const specPath = path.join(workspace, 'spec.yaml');
    await writeFile(
      specPath,
      JSON.stringify({
        openapi: '3.0.2',
        info: { title: 'main', version: '1.0' },
        paths: {
          '/x': {
            get: {
              operationId: 'getX',
              responses: {
                '200': {
                  description: 'ok',
                  content: {
                    'application/json': {
                      schema: { $ref: `${ref}#/components/schemas/Foo` },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      'utf8',
    );
    return { workspace, specPath };
  }

  it('does not follow a redirect to a URL outside the allow-list', async () => {
    const servers = await startRedirectingServers();
    const { workspace, specPath } = await createWorkspaceFor(
      servers.redirectUrl,
    );
    const warn = vi.fn();

    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            // Only the redirecting URL is allowed, not where it points.
            parserOptions: {
              externalRefs: { allow: [servers.redirectUrl] },
            },
          },
        },
        workspace,
        {},
      );

      await expect(
        withReporter({ ...noopReporter, warn }, () =>
          importSpecs(workspace, normalizedOptions),
        ),
      ).rejects.toBeDefined();

      // The blocked destination must never be contacted.
      expect(servers.targetHits).toBe(0);

      const warnings = warn.mock.calls
        .map(([event]) => event.message)
        .join('\n');
      expect(warnings).toContain('Refused to follow a redirect');
      expect(warnings).toContain(servers.targetUrl);
    } finally {
      await servers.close();
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('follows a redirect when the destination is also allowed', async () => {
    const servers = await startRedirectingServers();
    const { workspace, specPath } = await createWorkspaceFor(
      servers.redirectUrl,
    );

    try {
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: {
              externalRefs: {
                allow: [servers.redirectUrl, servers.targetUrl],
              },
            },
          },
        },
        workspace,
        {},
      );

      const spec = await importSpecs(workspace, normalizedOptions);

      expect(spec.verbOptions).toHaveProperty('getX');
      expect(servers.targetHits).toBe(1);
    } finally {
      await servers.close();
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('does not carry headers configured for the source host to the redirect target', async () => {
    const servers = await startRedirectingServers();
    const { workspace, specPath } = await createWorkspaceFor(
      servers.redirectUrl,
    );

    try {
      const sourceHost = new URL(servers.redirectUrl).host;
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: {
              // The credential is scoped to the redirecting host only.
              headers: [
                {
                  domains: [sourceHost],
                  headers: { authorization: 'Bearer SOURCE-ONLY' },
                },
              ],
              externalRefs: {
                allow: [servers.redirectUrl, servers.targetUrl],
              },
            },
          },
        },
        workspace,
        {},
      );

      const spec = await importSpecs(workspace, normalizedOptions);

      expect(spec.verbOptions).toHaveProperty('getX');
      expect(servers.targetHits).toBe(1);
      // `fetchUrls` matches headers against the first URL's host, so carrying
      // `init` across hops would hand this credential to the other host.
      expect(servers.targetHeaders.authorization).toBeUndefined();
    } finally {
      await servers.close();
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('sends headers configured for the redirect target host', async () => {
    const servers = await startRedirectingServers();
    const { workspace, specPath } = await createWorkspaceFor(
      servers.redirectUrl,
    );

    try {
      const targetHost = new URL(servers.targetUrl).host;
      const normalizedOptions = await normalizeOptions(
        {
          output: { target: '' },
          input: {
            target: specPath,
            parserOptions: {
              headers: [
                {
                  domains: [targetHost],
                  headers: { authorization: 'Bearer TARGET' },
                },
              ],
              externalRefs: {
                allow: [servers.redirectUrl, servers.targetUrl],
              },
            },
          },
        },
        workspace,
        {},
      );

      await importSpecs(workspace, normalizedOptions);

      // Recomputing per hop must still deliver what the user configured for
      // the host actually being contacted.
      expect(servers.targetHeaders.authorization).toBe('Bearer TARGET');
    } finally {
      await servers.close();
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('optionsParamRequired', () => {
  it('should not require all params when optionsParamRequired is false', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: {
          target: '',
        },
        input: {
          target: TEST_SPEC,
        },
      },
      workspace,
      {},
    );
    const spec = await importSpecs(workspace, normalizedOptions);

    const body = spec.verbOptions.handleResource.props.find(
      (p) => p.name === 'handleResourceBody',
    );
    expect(body).toBeDefined();
    expect(body).toBeTypeOf('object');
    expect(body).not.toBeNull();

    expect(body?.name).toBe('handleResourceBody');
    expect(body?.definition).toBe('handleResourceBody?: HandleResourceBody');
    expect(body?.implementation).toBe(
      'handleResourceBody?: HandleResourceBody',
    );
    expect(body?.default).toBeUndefined();
    expect(body?.required).toBe(false);
    expect(body?.type).toBe('body');

    const params = spec.verbOptions.handleResource.props.find(
      (p) => p.name === 'params',
    );
    expect(params).toBeDefined();
    expect(params).toBeTypeOf('object');
    expect(params).not.toBeNull();

    expect(params?.name).toBe('params');
    expect(params?.definition).toBe('params?: HandleResourceParams');
    expect(params?.implementation).toBe('params?: HandleResourceParams');
    expect(params?.default).toBeUndefined();
    expect(params?.required).toBe(false);
    expect(params?.type).toBe('queryParam');

    const implementation = spec.operations.handleResource.implementation;
    expect(implementation).toBeDefined();

    const expectedImplementation = `/**
 * @summary Single endpoint with optional inputs
 */
export const handleResource = (
    workspaceId: string,
    id: string,
    handleResourceBody?: HandleResourceBody,
    params?: HandleResourceParams, options?: AxiosRequestConfig
 ): Promise<AxiosResponse<void>> => {
    return axios.post(
      \`/\${workspaceId}/resource/\${id}\`,
      handleResourceBody,{
    ...options,
        params: {...params, ...options?.params},}
    );
  }
export const getHandleResourceUrl = (workspaceId: string,
    id: string,
    params?: HandleResourceParams,) => {
    \n  return axios.create({
    baseURL: '',
    params: null,
  }).getUri({
    url: \`/\${workspaceId}/resource/\${id}\`,
    baseURL: '',
    params,
    \n  });
}
`;

    expect(implementation).toBe(expectedImplementation);
  });

  it('should require all params when optionsParamRequired is true', async () => {
    const workspace = 'test';
    const normalizedOptions = await normalizeOptions(
      {
        output: {
          optionsParamRequired: true,
          target: '',
        },
        input: {
          target: TEST_SPEC,
        },
      },
      workspace,
      {},
    );
    const spec = await importSpecs(workspace, normalizedOptions);
    expect(normalizedOptions.output.optionsParamRequired).toBe(true);

    const body = spec.verbOptions.handleResource.props.find(
      (p) => p.name === 'handleResourceBody',
    );
    expect(body).toBeDefined();
    expect(body).toBeTypeOf('object');
    expect(body).not.toBeNull();

    expect(body?.name).toBe('handleResourceBody');
    expect(body?.definition).toBe('handleResourceBody: HandleResourceBody');
    expect(body?.implementation).toBe('handleResourceBody: HandleResourceBody');
    expect(body?.default).toBeUndefined();
    expect(body?.required).toBe(true);
    expect(body?.type).toBe('body');

    const params = spec.verbOptions.handleResource.props.find(
      (p) => p.name === 'params',
    );
    expect(params).toBeDefined();
    expect(params).toBeTypeOf('object');
    expect(params).not.toBeNull();

    expect(params?.name).toBe('params');
    expect(params?.definition).toBe('params: HandleResourceParams');
    expect(params?.implementation).toBe('params: HandleResourceParams');
    expect(params?.default).toBeUndefined();
    expect(params?.required).toBe(true);
    expect(params?.type).toBe('queryParam');

    const implementation = spec.operations.handleResource.implementation;
    expect(implementation).toBeDefined();

    const expectedImplementation = `/**
 * @summary Single endpoint with optional inputs
 */
export const handleResource = (
    workspaceId: string,
    id: string,
    handleResourceBody: HandleResourceBody,
    params: HandleResourceParams, options: AxiosRequestConfig
 ): Promise<AxiosResponse<void>> => {
    return axios.post(
      \`/\${workspaceId}/resource/\${id}\`,
      handleResourceBody,{
    ...options,
        params: {...params, ...options?.params},}
    );
  }
export const getHandleResourceUrl = (workspaceId: string,
    id: string,
    params: HandleResourceParams,) => {
    \n  return axios.create({
    baseURL: '',
    params: null,
  }).getUri({
    url: \`/\${workspaceId}/resource/\${id}\`,
    baseURL: '',
    params,
    \n  });
}
`;

    expect(implementation).toBe(expectedImplementation);
  });
});

describe('dereferenceExternalRefs', () => {
  it('should match an x-ext placeholder to its source document', () => {
    const input = {
      components: {
        schemas: {
          User: {
            $ref: '#/x-ext/catalog/components/schemas/User',
          },
        },
      },
      'x-ext': {
        billing: {
          components: {
            schemas: {
              User: { type: 'string', enum: ['billing'] },
            },
          },
        },
        catalog: {
          components: {
            schemas: {
              User: { type: 'string', enum: ['catalog'] },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as {
      components: { schemas: Record<string, unknown> };
    };

    expect(result.components.schemas.User).toEqual({
      type: 'string',
      enum: ['catalog'],
    });
    expect(result.components.schemas.User_billing).toEqual({
      type: 'string',
      enum: ['billing'],
    });
    expect(JSON.stringify(result)).not.toContain('#/x-ext/');
  });

  it('should reject an occupied default-mode suffix without overwriting it', () => {
    const input = {
      components: {
        schemas: {
          User: { type: 'string', enum: ['local'] },
          User_billing: { type: 'string', enum: ['occupied'] },
        },
      },
      'x-ext': {
        billing: {
          components: {
            schemas: {
              User: { type: 'string', enum: ['external'] },
            },
          },
        },
      },
    };

    expect(() => dereferenceExternalRef(input)).toThrow(
      /external schema.*User.*billing.*User_billing/i,
    );
  });

  it('should rewrite always-mode direct and nested cross-document refs', () => {
    const input = {
      components: {
        schemas: {
          Holder: {
            $ref: '#/x-ext/billing/components/schemas/Order',
          },
        },
      },
      'x-ext': {
        billing: {
          components: {
            schemas: {
              Order: {
                type: 'object',
                properties: {
                  product: {
                    $ref: '#/x-ext/catalog/components/schemas/Product',
                  },
                },
              },
            },
          },
        },
        catalog: {
          components: {
            schemas: {
              Product: { type: 'string' },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input, 'always') as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };

    expect(result.components.schemas.Holder).toEqual({
      $ref: '#/components/schemas/Order_billing',
    });
    expect(result.components.schemas.Order_billing).toEqual({
      type: 'object',
      properties: {
        product: { $ref: '#/components/schemas/Product_catalog' },
      },
    });
    expect(result.components.schemas).toHaveProperty('Product_catalog');
    expect(JSON.stringify(result)).not.toContain('#/x-ext/');
  });

  it('should reject a post-sanitization external schema collision', () => {
    const input = {
      'x-ext': {
        'service-a': {
          components: {
            schemas: { User: { type: 'string', enum: ['first'] } },
          },
        },
        service_a: {
          components: {
            schemas: { User: { type: 'string', enum: ['second'] } },
          },
        },
      },
    };

    expect(() => dereferenceExternalRef(input, 'always')).toThrow(
      /external schema.*User.*service_a.*User_service_a/i,
    );
  });

  it('should always name duplicate schemas by their external document', () => {
    const input = {
      components: {
        schemas: {
          BillingUser: {
            $ref: '#/x-ext/billing/components/schemas/User',
          },
          CatalogUser: {
            $ref: '#/x-ext/catalog/components/schemas/User',
          },
        },
      },
      'x-ext': {
        billing: {
          components: { schemas: { User: { type: 'string' } } },
        },
        catalog: {
          components: { schemas: { User: { type: 'number' } } },
        },
      },
    };

    const result = dereferenceExternalRef(input, 'always') as {
      components: { schemas: Record<string, unknown> };
    };

    expect(result.components.schemas).toHaveProperty('User_billing');
    expect(result.components.schemas).toHaveProperty('User_catalog');
    expect(result.components.schemas.BillingUser).toEqual({
      $ref: '#/components/schemas/User_billing',
    });
    expect(result.components.schemas.CatalogUser).toEqual({
      $ref: '#/components/schemas/User_catalog',
    });
  });

  it('should reuse one always-named component for repeated external refs', () => {
    const input = {
      components: {
        schemas: {
          First: { $ref: '#/x-ext/billing/components/schemas/User' },
          Second: { $ref: '#/x-ext/billing/components/schemas/User' },
        },
      },
      'x-ext': {
        billing: {
          components: { schemas: { User: { type: 'string' } } },
        },
      },
    };

    const result = dereferenceExternalRef(input, 'always') as {
      components: { schemas: Record<string, unknown> };
    };

    expect(Object.keys(result.components.schemas)).toEqual([
      'First',
      'Second',
      'User_billing',
    ]);
    expect(result.components.schemas.First).toEqual({
      $ref: '#/components/schemas/User_billing',
    });
    expect(result.components.schemas.Second).toEqual({
      $ref: '#/components/schemas/User_billing',
    });
  });

  it('should keep always-mode names stable when external order is reversed', () => {
    const createInput = (reverse: boolean) => ({
      components: {
        schemas: {
          BillingUser: {
            $ref: '#/x-ext/billing/components/schemas/User',
          },
          CatalogUser: {
            $ref: '#/x-ext/catalog/components/schemas/User',
          },
        },
      },
      'x-ext': reverse
        ? {
            catalog: {
              components: { schemas: { User: { type: 'number' } } },
            },
            billing: {
              components: { schemas: { User: { type: 'string' } } },
            },
          }
        : {
            billing: {
              components: { schemas: { User: { type: 'string' } } },
            },
            catalog: {
              components: { schemas: { User: { type: 'number' } } },
            },
          },
    });

    const project = (reverse: boolean) => {
      const schemas = (
        dereferenceExternalRef(createInput(reverse), 'always') as {
          components: { schemas: Record<string, unknown> };
        }
      ).components.schemas;
      return {
        billing: schemas.BillingUser,
        catalog: schemas.CatalogUser,
        names: Object.keys(schemas)
          .filter((name) => name.startsWith('User_'))
          .sort(),
      };
    };

    expect(project(true)).toEqual(project(false));
  });

  it('should always suffix external schemas and rewrite their internal refs', () => {
    const input = {
      components: {
        schemas: {
          Holder: {
            allOf: [{ $ref: '#/x-ext/billing/components/schemas/Order' }],
          },
        },
      },
      'x-ext': {
        billing: {
          components: {
            schemas: {
              User: { type: 'object' },
              Order: {
                type: 'object',
                properties: {
                  user: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input, 'always') as {
      components: { schemas: Record<string, Record<string, unknown>> };
    };

    expect(result.components.schemas).toHaveProperty('User_billing');
    expect(result.components.schemas).toHaveProperty('Order_billing');
    expect(result.components.schemas.Order_billing).toEqual({
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User_billing' },
      },
    });
    expect(result.components.schemas.Holder).toEqual({
      allOf: [{ $ref: '#/components/schemas/Order_billing' }],
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should preserve an x-ext placeholder as an alias in always mode', () => {
    const input = {
      components: {
        schemas: {
          User: {
            $ref: '#/x-ext/billing/components/schemas/User',
          },
        },
      },
      'x-ext': {
        billing: {
          components: {
            schemas: {
              User: { type: 'object', properties: { id: { type: 'string' } } },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input, 'always') as {
      components: { schemas: Record<string, unknown> };
    };

    expect(result.components.schemas.User).toEqual({
      $ref: '#/components/schemas/User_billing',
    });
    expect(result.components.schemas.User_billing).toEqual({
      type: 'object',
      properties: { id: { type: 'string' } },
    });
  });

  it('should reject a suffixed external schema name collision', () => {
    const input = {
      components: {
        schemas: {
          User_billing: { type: 'string' },
        },
      },
      'x-ext': {
        billing: {
          components: {
            schemas: {
              User: { type: 'object' },
            },
          },
        },
      },
    };

    expect(() => dereferenceExternalRef(input, 'always')).toThrow(
      /external schema.*User.*billing.*User_billing/i,
    );
  });

  it('should dereference x-ext references and remove x-ext property', () => {
    const input = {
      openapi: '3.0.0',
      info: {
        title: 'Sample API',
        version: '0.0.0',
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      paths: {
        '/points': {
          get: {
            operationId: 'get-points',
            responses: {
              '200': {
                description: 'A JSON array of GeoJSON points',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        $ref: '#/x-ext/d4e2d5e',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      'x-ext': {
        d4e2d5e: {
          $schema: 'http://json-schema.org/draft-07/schema#',
          $id: 'https://geojson.org/schema/Point.json',
          title: 'GeoJSON Point',
          type: 'object',
          required: ['type', 'coordinates'],
          properties: {
            type: {
              type: 'string',
              enum: ['Point'],
            },
            coordinates: {
              type: 'array',
              minItems: 2,
              items: {
                type: 'number',
              },
            },
            bbox: {
              type: 'array',
              minItems: 4,
              items: {
                type: 'number',
              },
            },
          },
        },
      },
    };

    const expected = {
      openapi: '3.0.0',
      info: {
        title: 'Sample API',
        version: '0.0.0',
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      // No `components`: the external schema is inlined, so nothing is merged
      // and no container is created. The empty one this used to assert was
      // residue that made Swagger 2.0 documents fail validation (#2993).
      paths: {
        '/points': {
          get: {
            operationId: 'get-points',
            responses: {
              '200': {
                description: 'A JSON array of GeoJSON points',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        title: 'GeoJSON Point',
                        type: 'object',
                        required: ['type', 'coordinates'],
                        properties: {
                          type: {
                            type: 'string',
                            enum: ['Point'],
                          },
                          coordinates: {
                            type: 'array',
                            minItems: 2,
                            items: {
                              type: 'number',
                            },
                          },
                          bbox: {
                            type: 'array',
                            minItems: 4,
                            items: {
                              type: 'number',
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input);

    expect(result).toEqual(expected);
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle multiple x-ext references', () => {
    const input = {
      components: {
        schemas: {
          Dog: {
            $ref: '#/x-ext/dog',
          },
          Cat: {
            $ref: '#/x-ext/cat',
          },
        },
      },
      'x-ext': {
        dog: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            breed: { type: 'string' },
          },
        },
        cat: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            color: { type: 'string' },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as {
      components: { schemas: Record<string, unknown> };
    };

    expect(result.components.schemas.Dog).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        breed: { type: 'string' },
      },
    });
    expect(result.components.schemas.Cat).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        color: { type: 'string' },
      },
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle nested x-ext references', () => {
    const input = {
      schema: {
        allOf: [
          {
            $ref: '#/x-ext/base',
          },
          {
            properties: {
              extra: { type: 'string' },
            },
          },
        ],
      },
      'x-ext': {
        base: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as {
      schema: { allOf: unknown[] };
    };

    expect(result.schema.allOf[0]).toEqual({
      type: 'object',
      properties: {
        id: { type: 'integer' },
      },
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle arrays with x-ext references', () => {
    const input = {
      items: [{ $ref: '#/x-ext/item1' }, { $ref: '#/x-ext/item2' }],
      'x-ext': {
        item1: { value: 'first' },
        item2: { value: 'second' },
      },
    };

    const result = dereferenceExternalRef(input);

    expect(result.items).toEqual([{ value: 'first' }, { value: 'second' }]);
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle missing x-ext property gracefully', () => {
    const input = {
      openapi: '3.0.0',
      paths: {},
    };

    const result = dereferenceExternalRef(input);

    expect(result).toEqual(input);
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle invalid x-ext references gracefully', () => {
    const input = {
      schema: {
        $ref: '#/x-ext/nonexistent',
      },
      'x-ext': {
        test: { type: 'string' },
      },
    };

    const result = dereferenceExternalRef(input);

    // The reference should remain unchanged if it doesn't exist
    expect(result.schema).toEqual({
      $ref: '#/x-ext/nonexistent',
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should recursively dereference nested objects within x-ext', () => {
    const input = {
      schema: {
        $ref: '#/x-ext/outer',
      },
      'x-ext': {
        outer: {
          type: 'object',
          properties: {
            inner: {
              $ref: '#/x-ext/inner',
            },
          },
        },
        inner: {
          type: 'string',
        },
      },
    };

    const result = dereferenceExternalRef(input);

    expect(result.schema).toEqual({
      type: 'object',
      properties: {
        inner: {
          type: 'string',
        },
      },
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should dereference x-ext entry with internal paths', () => {
    const input = {
      openapi: '3.0.2',
      info: { version: '1.0.0', title: 'Swagger Petstore' },
      servers: [{ url: 'http://petstore.swagger.io/v1' }],
      paths: {
        '/pets': {
          post: {
            responses: {
              '200': {
                description: 'Created Pet',
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/x-ext/cefada3/components/schemas/Pet',
                    },
                  },
                },
              },
            },
          },
        },
      },
      'x-ext': {
        cefada3: {
          components: {
            schemas: {
              Pet: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'integer', format: 'int64' },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;

    // Schemas from external docs should be merged into components
    expect(result.components?.schemas).toHaveProperty('Pet');
    expect(result.paths?.['/pets']?.post?.responses?.['200']?.content).toEqual({
      'application/json': {
        schema: {
          // updated from '#/x-ext/cefada3/components/schemas/Pet'
          $ref: '#/components/schemas/Pet',
        },
      },
    });

    expect(result).not.toHaveProperty('x-ext');
  });

  it('should resolve external path-item refs with escaped JSON Pointer tokens (#3380)', () => {
    // A cross-file path-item `$ref` (e.g. `common.yaml#/paths/~1pets`) is
    // bundled into an x-ext ref whose pointer keeps the JSON Pointer escape
    // `~1` (for `/`) and percent-encoding (`%7B`/`%7D` for `{`/`}` in
    // templated paths). Both must be decoded before walking the external doc.
    const input = {
      openapi: '3.0.0',
      info: { version: '1.0.0', title: 'API' },
      paths: {
        '/pets': {
          $ref: '#/x-ext/abc1234/paths/~1pets',
        },
        '/pets/{petId}': {
          $ref: '#/x-ext/abc1234/paths/~1pets~1%7BpetId%7D',
        },
        // `~0` is the JSON Pointer escape for a literal `~` (RFC 6901).
        '/pets~dogs': {
          $ref: '#/x-ext/abc1234/paths/~1pets~0dogs',
        },
      },
      'x-ext': {
        abc1234: {
          paths: {
            '/pets': {
              get: {
                operationId: 'listPets',
                responses: { '200': { description: 'ok' } },
              },
            },
            '/pets/{petId}': {
              get: {
                operationId: 'getPet',
                parameters: [
                  {
                    name: 'petId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                  },
                ],
                responses: { '200': { description: 'ok' } },
              },
            },
            '/pets~dogs': {
              get: {
                operationId: 'listPetsDogs',
                responses: { '200': { description: 'ok' } },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;

    expect(result.paths?.['/pets']).toEqual({
      get: {
        operationId: 'listPets',
        responses: { '200': { description: 'ok' } },
      },
    });
    expect(result.paths?.['/pets/{petId}']).toEqual({
      get: {
        operationId: 'getPet',
        parameters: [
          {
            name: 'petId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'ok' } },
      },
    });
    expect(result.paths?.['/pets~dogs']).toEqual({
      get: {
        operationId: 'listPetsDogs',
        responses: { '200': { description: 'ok' } },
      },
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should dereference external doc schemas with internal refs', () => {
    const input = {
      openapi: '3.0.3',
      info: { title: 'Demo', version: '0.0.0' },
      paths: {},
      components: {
        schemas: {
          ExternalSchema: {
            $ref: '#/x-ext/external-doc/components/schemas/ExternalSchema',
          },
        },
      },
      'x-ext': {
        'external-doc': {
          openapi: '3.0.3',
          info: { title: 'External API', version: '0.0.0' },
          components: {
            schemas: {
              ExternalSchema: {
                type: 'object',
                required: ['version'],
                allOf: [
                  { $ref: '#/components/schemas/Version' },
                  { $ref: '#/components/schemas/FirstValue' },
                ],
              },
              Version: {
                type: 'object',
                properties: {
                  version: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
              FirstValue: {
                type: 'object',
                properties: {
                  first: { type: 'number', format: 'double', example: 5.2 },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;
    const schemas = result.components?.schemas;

    // --- Assert: All 3 schemas merged from external doc ---
    expect(schemas).toHaveProperty('ExternalSchema');
    expect(schemas).toHaveProperty('Version');
    expect(schemas).toHaveProperty('FirstValue');

    expect(schemas?.ExternalSchema).toEqual(
      expect.objectContaining({
        type: 'object',
        required: ['version'],
        allOf: [
          expect.objectContaining({ $ref: '#/components/schemas/Version' }),
          expect.objectContaining({ $ref: '#/components/schemas/FirstValue' }),
        ],
      }),
    );

    expect(result).not.toHaveProperty('x-ext');
  });

  // Regression test for https://github.com/orval-labs/orval/issues/1935
  it('should resolve a barrel $ref that crosses into a second external doc', () => {
    // The middle external doc ("barrel") only re-exports a schema as a $ref
    // into a third external doc ("concrete"). The cross-doc rewrite in
    // `replaceXExtRefs` must collapse the chain so the merged barrel schema
    // ends up pointing at the resolved schema in the main spec, not at the
    // raw `#/x-ext/concrete/...` ref it was bundled with.
    const input = {
      openapi: '3.0.3',
      info: { title: 'Demo', version: '0.0.0' },
      paths: {},
      components: {
        schemas: {
          UserProjectDTO: {
            $ref: '#/x-ext/barrel/components/schemas/UserProjectDTO',
          },
        },
      },
      'x-ext': {
        barrel: {
          openapi: '3.0.3',
          info: { title: 'Barrel', version: '0.0.0' },
          components: {
            schemas: {
              UserProjectDTO: {
                $ref: '#/x-ext/concrete/components/schemas/UserProject',
              },
            },
          },
        },
        concrete: {
          openapi: '3.0.3',
          info: { title: 'Concrete', version: '0.0.0' },
          components: {
            schemas: {
              UserProject: {
                type: 'object',
                required: ['id', 'title'],
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;
    const schemas = result.components?.schemas;

    // Both ends of the chain are merged into the main spec.
    expect(schemas?.UserProject).toEqual({
      type: 'object',
      required: ['id', 'title'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
      },
    });

    // The barrel entry collapses to an internal $ref pointing at the
    // resolved concrete schema — the x-ext hop must be rewritten, otherwise
    // downstream resolveRef() throws "Ref not found".
    expect(schemas?.UserProjectDTO).toEqual({
      $ref: '#/components/schemas/UserProject',
    });

    expect(result).not.toHaveProperty('x-ext');
  });

  it('should rewrite an always-mode barrel ref across external documents', () => {
    const input = {
      components: {
        schemas: {
          UserProjectDTO: {
            $ref: '#/x-ext/barrel/components/schemas/UserProjectDTO',
          },
        },
      },
      'x-ext': {
        barrel: {
          components: {
            schemas: {
              UserProjectDTO: {
                $ref: '#/x-ext/concrete/components/schemas/UserProject',
              },
            },
          },
        },
        concrete: {
          components: {
            schemas: {
              UserProject: {
                type: 'object',
                properties: { id: { type: 'string' } },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input, 'always') as OpenApiDocument;
    const schemas = result.components?.schemas;

    expect(schemas).toHaveProperty('UserProjectDTO_barrel');
    expect(schemas).toHaveProperty('UserProject_concrete');
    expect(schemas?.UserProjectDTO_barrel).toEqual({
      $ref: '#/components/schemas/UserProject_concrete',
    });
    expect(schemas?.UserProject_concrete).toEqual({
      type: 'object',
      properties: { id: { type: 'string' } },
    });
    expect(JSON.stringify(result)).not.toContain('#/x-ext/');
  });

  // Regression test for https://github.com/orval-labs/orval/issues/394
  it('should resolve internal $ref inside an external parameter against the external doc', () => {
    const input = {
      openapi: '3.0.2',
      info: { title: 'Demo', version: '0.0.0' },
      paths: {
        '/path': {
          get: {
            parameters: [{ $ref: '#/x-ext/refs/components/parameters/switch' }],
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': { schema: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      'x-ext': {
        refs: {
          components: {
            schemas: {
              Switch: {
                type: 'string',
                enum: ['on', 'off'],
              },
            },
            parameters: {
              switch: {
                name: 'switch',
                in: 'query',
                schema: { $ref: '#/components/schemas/Switch' },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;

    // The Switch schema from the external doc should be merged into main
    // components with its content intact
    expect(result.components?.schemas?.Switch).toEqual({
      type: 'string',
      enum: ['on', 'off'],
    });

    // The parameter should be inlined where the x-ext ref was, and its
    // internal $ref must still point to Switch (now in the main spec)
    const params = result.paths?.['/path']?.get?.parameters;
    expect(params).toEqual([
      expect.objectContaining({
        name: 'switch',
        in: 'query',
        schema: { $ref: '#/components/schemas/Switch' },
      }),
    ]);

    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle schema name collisions - add suffix to external schema', () => {
    const input = {
      openapi: '3.0.3',
      info: { title: 'Demo', version: '0.0.0' },
      paths: {},
      components: {
        schemas: {
          // Main spec has its own User schema
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
          Holder: {
            $ref: '#/x-ext/external/components/schemas/User',
          },
        },
      },
      'x-ext': {
        external: {
          components: {
            schemas: {
              // External doc also has User, but different structure
              User: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  age: { type: 'number' },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;

    expect(result.components?.schemas?.User).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
    });
    expect(result.components?.schemas?.User_external).toEqual({
      type: 'object',
      properties: {
        email: { type: 'string' },
        age: { type: 'number' },
      },
    });
    expect(result.components?.schemas?.Holder).toEqual({
      $ref: '#/components/schemas/User_external',
    });
    expect(result).not.toHaveProperty('x-ext');
  });

  it('should handle schema collisions between multiple external docs', () => {
    const input = {
      openapi: '3.0.3',
      info: { title: 'Demo', version: '0.0.0' },
      paths: {},
      'x-ext': {
        'external-1': {
          components: {
            schemas: {
              SharedSchema: {
                type: 'object',
                properties: {
                  source: { type: 'string', enum: ['external-1'] },
                },
              },
            },
          },
        },
        'external-2': {
          components: {
            schemas: {
              SharedSchema: {
                type: 'object',
                properties: {
                  source: { type: 'string', enum: ['external-2'] },
                },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as OpenApiDocument;

    // First external doc's SharedSchema (no suffix - arrived first)
    expect(result.components?.schemas).toHaveProperty('SharedSchema');

    // Second external doc's SharedSchema (suffixed due to collision)
    expect(result.components?.schemas).toHaveProperty(
      'SharedSchema_external_2',
    );

    expect(result).not.toHaveProperty('x-ext');
  });

  it('should break cycles when an external ref recursively points back to itself (#1642)', () => {
    // A self-referencing x-ext entry outside components.schemas would
    // otherwise inline forever and OOM; the inner ref must collapse to `{}`.
    const warn = vi.fn();
    const input = {
      openapi: '3.0.0',
      components: {
        schemas: {
          Foo: { $ref: '#/x-ext/abc/Foo' },
        },
      },
      'x-ext': {
        abc: {
          Foo: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              self: { $ref: '#/x-ext/abc/Foo' },
            },
          },
        },
      },
    };

    const result = withReporter({ ...noopReporter, warn }, () =>
      dereferenceExternalRef(input),
    ) as {
      components: { schemas: { Foo: Record<string, unknown> } };
    };

    expect(result.components.schemas.Foo).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        self: {},
      },
    });
    expect(result).not.toHaveProperty('x-ext');
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('circular external $ref'),
      }),
    );
  });

  it('should not inject components into Swagger 2.0 spec when no external refs exist', () => {
    const input = {
      swagger: '2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
      definitions: { Foo: { type: 'object' } },
    };

    const result = dereferenceExternalRef(input);

    expect(result).not.toHaveProperty('components');
  });
});

describe('validateComponentKeys', () => {
  it('should pass for valid ASCII component keys', () => {
    const data = {
      components: {
        schemas: {
          User: { type: 'object' },
          User_v2: { type: 'object' },
          'my.org.User': { type: 'object' },
          'user-name': { type: 'object' },
        },
      },
    };
    expect(() => {
      validateComponentKeys(data);
    }).not.toThrow();
  });

  it('should report all invalid keys at once', () => {
    const data = {
      components: {
        schemas: {
          Användare: { type: 'object' },
          상품: { type: 'object' },
        },
      },
    };
    expect(() => {
      validateComponentKeys(data);
    }).toThrow(/Invalid component keys/);
  });

  it.each([
    ['schemas', { Ünvalid: {} }],
    ['responses', { Réponse: {} }],
    ['parameters', { パラメータ: {} }],
    ['examples', { 例子: {} }],
    ['requestBodies', { тело: {} }],
    ['headers', { κεφαλίδα: {} }],
    ['securitySchemes', { sécurité: {} }],
    ['links', { länk: {} }],
    ['callbacks', { رد: {} }],
    ['pathItems', { เส้นทาง: {} }],
  ])('should reject invalid key in %s', (section, value) => {
    const data = { components: { [section]: value } };
    expect(() => {
      validateComponentKeys(data);
    }).toThrow(new RegExp(String.raw`components\.${section}\.`));
  });

  it('should pass when no components exist', () => {
    const data = { openapi: '3.0.0', paths: {} };
    expect(() => {
      validateComponentKeys(data);
    }).not.toThrow();
  });
});

describe('normalizeNullableRefs', () => {
  it('should rewrite a $ref with sibling nullable: true into anyOf', () => {
    const input = {
      $ref: '#/components/schemas/Pet',
      nullable: true,
    };

    const result = normalizeNullableRefs(input) as Record<string, unknown>;
    expect(result).toEqual({
      anyOf: [{ $ref: '#/components/schemas/Pet' }, { type: 'null' }],
    });
  });

  it('should not touch a $ref without nullable', () => {
    const input = { $ref: '#/components/schemas/Pet' };
    const result = normalizeNullableRefs(input);
    expect(result).toEqual({ $ref: '#/components/schemas/Pet' });
  });

  it('should not touch a nullable schema without $ref', () => {
    const input = { type: 'string', nullable: true };
    const result = normalizeNullableRefs(input);
    expect(result).toEqual({ type: 'string', nullable: true });
  });

  it('should still rewrite a nullable $ref nested below an allOf member', () => {
    const input = {
      allOf: [
        {
          type: 'object',
          properties: {
            pet: { $ref: '#/components/schemas/Pet', nullable: true },
          },
        },
      ],
    };

    const result = normalizeNullableRefs(input);

    // The exemption covers direct allOf members only. This `$ref` sits in a
    // member's `properties`, not in the intersection itself, so the union does
    // reach the emitted type as `pet?: Pet | null` and has to be kept.
    expect(result).toEqual({
      allOf: [
        {
          type: 'object',
          properties: {
            pet: {
              anyOf: [{ $ref: '#/components/schemas/Pet' }, { type: 'null' }],
            },
          },
        },
      ],
    });
  });

  it('should drop a nullable sibling from a $ref that is a direct allOf member', () => {
    const input = {
      allOf: [
        { $ref: '#/components/schemas/Pet', nullable: true },
        { type: 'object', properties: { marker: { type: 'string' } } },
      ],
    };

    const result = normalizeNullableRefs(input);

    // Left as a plain `$ref` rather than rewritten into a union. The sibling is
    // out of spec in both positions — the difference from the test above is not
    // what it means, but whether the union can survive where it sits. Members of
    // an allOf are intersected, and `null & { marker?: string }` reduces to
    // `never`, so `(Pet | null) & { marker?: string }` and
    // `Pet & { marker?: string }` are the same type: emitting the union changes
    // nothing. It does cost something, though — orval reads through allOf members
    // to collect the keys a schema guarantees, and a union member hides them,
    // degrading `Pick<W, 'id'>` to `Pick<W, Extract<keyof W, 'id'>>` (#3714).
    // To make a composition nullable, `nullable` goes on the composed schema
    // rather than on a member; see NullablePlacementOnWrapper in regressions.yaml.
    expect(result).toEqual({
      allOf: [
        { $ref: '#/components/schemas/Pet' },
        { type: 'object', properties: { marker: { type: 'string' } } },
      ],
    });
  });

  it('should keep the union when an allOf has nothing to absorb the null', () => {
    // A lone member has no intersection partner, so the null branch is the whole
    // type: `Base | null`, not `Base`. Dropping it here would silently delete a
    // null the API can really return.
    const input = {
      allOf: [{ $ref: '#/components/schemas/Base', nullable: true }],
    };

    expect(normalizeNullableRefs(input)).toEqual({
      allOf: [
        { anyOf: [{ $ref: '#/components/schemas/Base' }, { type: 'null' }] },
      ],
    });
  });

  it('should keep the union when every allOf member is itself nullable', () => {
    // `(Base | null) & (Other | null)` reduces to `(Base & Other) | null`, so
    // neither member absorbs the other's null branch.
    const input = {
      allOf: [
        { $ref: '#/components/schemas/Base', nullable: true },
        { $ref: '#/components/schemas/Other', nullable: true },
      ],
    };

    expect(normalizeNullableRefs(input)).toEqual({
      allOf: [
        { anyOf: [{ $ref: '#/components/schemas/Base' }, { type: 'null' }] },
        { anyOf: [{ $ref: '#/components/schemas/Other' }, { type: 'null' }] },
      ],
    });
  });

  it('should drop the sibling when the enclosing schema absorbs the null', () => {
    // The absorbing shape need not be inside the array: `{ properties, allOf }`
    // is itself an intersection of the two halves. This is NullableParentWrapper
    // in regressions.yaml.
    const input = {
      type: 'object',
      properties: { marker: { type: 'string' } },
      allOf: [{ $ref: '#/components/schemas/Base', nullable: true }],
    };

    expect(normalizeNullableRefs(input)).toEqual({
      type: 'object',
      properties: { marker: { type: 'string' } },
      allOf: [{ $ref: '#/components/schemas/Base' }],
    });
  });

  it('should treat a property named allOf as a property, not a composition', () => {
    // `allOf` here is an ordinary property name; its value is a schema, not an
    // array of members, so it must take the normal rewrite like its twin.
    const input = {
      type: 'object',
      properties: {
        allOf: { $ref: '#/components/schemas/Base', nullable: true },
        other: { $ref: '#/components/schemas/Base', nullable: true },
      },
    };

    const result = normalizeNullableRefs(input) as Record<string, unknown>;
    const props = result.properties as Record<string, unknown>;
    const expected = {
      anyOf: [{ $ref: '#/components/schemas/Base' }, { type: 'null' }],
    };

    expect(props.allOf).toEqual(expected);
    expect(props.other).toEqual(expected);
  });

  it('should normalize nullable refs nested inside properties', () => {
    const input = {
      type: 'object',
      properties: {
        owner: {
          $ref: '#/components/schemas/Owner',
          nullable: true,
        },
        pet: {
          $ref: '#/components/schemas/Pet',
        },
      },
    };
    const result = normalizeNullableRefs(input) as Record<string, unknown>;
    const props = result.properties as Record<string, unknown>;

    expect(props.owner).toEqual({
      anyOf: [{ $ref: '#/components/schemas/Owner' }, { type: 'null' }],
    });
    expect(props.pet).toEqual({ $ref: '#/components/schemas/Pet' });
  });

  it('should normalize nullable refs inside arrays', () => {
    const input = {
      anyOf: [
        { $ref: '#/components/schemas/A', nullable: true },
        { type: 'string' },
      ],
    };
    const result = normalizeNullableRefs(input) as Record<string, unknown>;
    const items = result.anyOf as unknown[];
    expect(items[0]).toEqual({
      anyOf: [{ $ref: '#/components/schemas/A' }, { type: 'null' }],
    });
  });

  it('should pass through non-object types unchanged', () => {
    expect(normalizeNullableRefs('string')).toBe('string');
    expect(normalizeNullableRefs(null)).toBe(null);
    expect(normalizeNullableRefs(42)).toBe(42);
    expect(normalizeNullableRefs([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe('normalizeToOpenApi31', () => {
  const normalize = (input: unknown) =>
    normalizeToOpenApi31(input, 'schema') as Record<string, unknown>;

  describe('residual `nullable` left behind by the upgrader', () => {
    it('should append a null branch to a nullable anyOf', () => {
      expect(
        normalize({
          anyOf: [{ type: 'string' }, { type: 'number' }],
          nullable: true,
        }),
      ).toEqual({
        anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
      });
    });

    it('should append a null branch to a nullable oneOf', () => {
      expect(
        normalize({
          oneOf: [{ type: 'string' }, { type: 'number' }],
          nullable: true,
        }),
      ).toEqual({
        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
      });
    });

    it('should not add a second null branch when the combinator already has one', () => {
      expect(
        normalize({
          anyOf: [{ type: 'string' }, { type: 'null' }],
          nullable: true,
        }),
      ).toEqual({
        anyOf: [{ type: 'string' }, { type: 'null' }],
      });
    });

    it('should add null to a nullable enum that has no sibling type', () => {
      expect(normalize({ enum: ['foo', 'bar'], nullable: true })).toEqual({
        enum: ['foo', 'bar', null],
      });
    });

    it('should not add a second null to a nullable enum that already lists it', () => {
      expect(normalize({ enum: ['foo', null], nullable: true })).toEqual({
        enum: ['foo', null],
      });
    });

    it('should widen a nullable type into a type union', () => {
      expect(normalize({ type: 'string', nullable: true })).toEqual({
        type: ['string', 'null'],
      });
    });

    it('should widen a nullable type that is already an array', () => {
      expect(normalize({ type: ['string'], nullable: true })).toEqual({
        type: ['string', 'null'],
      });
    });

    it('should rewrite a nullable $ref into an anyOf, keeping other siblings', () => {
      expect(
        normalize({
          $ref: '#/components/schemas/Pet',
          nullable: true,
          description: 'a pet',
        }),
      ).toEqual({
        description: 'a pet',
        anyOf: [{ $ref: '#/components/schemas/Pet' }, { type: 'null' }],
      });
    });

    it('should rewrite a nullable $dynamicRef into an anyOf', () => {
      expect(normalize({ $dynamicRef: '#meta', nullable: true })).toEqual({
        anyOf: [{ $dynamicRef: '#meta' }, { type: 'null' }],
      });
    });

    it('should unwrap a single-member nullable allOf into an anyOf', () => {
      expect(
        normalize({
          allOf: [{ $ref: '#/components/schemas/Pet' }],
          nullable: true,
        }),
      ).toEqual({
        anyOf: [{ $ref: '#/components/schemas/Pet' }, { type: 'null' }],
      });
    });

    it('should wrap a multi-member nullable allOf rather than appending null to it', () => {
      // Appending `{ type: 'null' }` to the `allOf` array would be
      // unsatisfiable: `allOf` is an intersection, and null intersected with an
      // object schema is `never`.
      expect(
        normalize({
          allOf: [{ type: 'object' }, { $ref: '#/components/schemas/Pet' }],
          nullable: true,
        }),
      ).toEqual({
        anyOf: [
          { allOf: [{ type: 'object' }, { $ref: '#/components/schemas/Pet' }] },
          { type: 'null' },
        ],
      });
    });

    it('should drop a nullable that has nothing to attach to', () => {
      // No `type` in 3.1 already admits every type, `null` included.
      expect(normalize({ nullable: true, description: 'anything' })).toEqual({
        description: 'anything',
      });
    });

    it('should drop `nullable: false`', () => {
      expect(normalize({ type: 'string', nullable: false })).toEqual({
        type: 'string',
      });
    });
  });

  describe('enum widening the upgrader misses', () => {
    it('should add null to an enum whose type union admits null', () => {
      // What `upgrade()` emits for `{ type: 'string', enum: [...], nullable:
      // true }`: it widens `type` but not `enum`, and the two combine with AND,
      // so the author's `null` is gone and the `'null'` in `type` is unreachable.
      expect(normalize({ type: ['string', 'null'], enum: ['a', 'b'] })).toEqual(
        {
          type: ['string', 'null'],
          enum: ['a', 'b', null],
        },
      );
    });

    it('should widen both type and enum for a nullable typed enum', () => {
      expect(
        normalize({ type: 'string', enum: ['a', 'b'], nullable: true }),
      ).toEqual({
        type: ['string', 'null'],
        enum: ['a', 'b', null],
      });
    });

    it('should leave an enum alone when the type union does not admit null', () => {
      expect(normalize({ type: ['string', 'number'], enum: ['a'] })).toEqual({
        type: ['string', 'number'],
        enum: ['a'],
      });
    });
  });

  describe('binary formats the upgrader misses on type unions', () => {
    it('should convert format: binary on a nullable string union', () => {
      // `upgrade()` widens `type` first, and its own `format` handling only
      // fires for `type === 'string'`, so the union keeps `format: 'binary'`.
      expect(normalize({ type: ['string', 'null'], format: 'binary' })).toEqual(
        {
          type: ['string', 'null'],
          contentMediaType: 'application/octet-stream',
        },
      );
    });

    it('should convert format: binary on a plain string schema', () => {
      expect(normalize({ type: 'string', format: 'binary' })).toEqual({
        type: 'string',
        contentMediaType: 'application/octet-stream',
      });
    });

    it('should convert format: base64 on a nullable string union', () => {
      expect(normalize({ type: ['string', 'null'], format: 'base64' })).toEqual(
        {
          type: ['string', 'null'],
          contentEncoding: 'base64',
        },
      );
    });

    it('should convert format: byte on a nullable string union', () => {
      expect(normalize({ type: ['string', 'null'], format: 'byte' })).toEqual({
        type: ['string', 'null'],
        contentEncoding: 'base64',
      });
    });

    it('should carry the enclosing media type onto a converted format: byte', () => {
      const result = normalizeToOpenApi31({
        content: {
          'image/png': {
            schema: { type: ['string', 'null'], format: 'byte' },
          },
        },
      }) as Record<string, unknown>;
      expect(
        (result.content as Record<string, Record<string, unknown>>)['image/png']
          .schema,
      ).toEqual({
        type: ['string', 'null'],
        contentEncoding: 'base64',
        contentMediaType: 'image/png',
      });
    });

    it('should leave a non-string format alone', () => {
      expect(normalize({ type: 'integer', format: 'int64' })).toEqual({
        type: 'integer',
        format: 'int64',
      });
    });
  });

  describe('content keywords the upgrader leaves without a type (#4157)', () => {
    it('should restore type: string on a typeless contentMediaType schema', () => {
      // What `@scalar/openapi-upgrader` >= 0.2.16 makes of a Swagger 2.0
      // `type: file` formData parameter, and of any `{ type: 'string',
      // format: 'binary' }`: it writes the content keyword but drops the
      // `type` that carried it, so the part came out `unknown` (#4157).
      expect(
        normalize({ contentMediaType: 'application/octet-stream' }),
      ).toEqual({
        type: 'string',
        contentMediaType: 'application/octet-stream',
      });
    });

    it('should restore type: string on a typeless contentEncoding schema', () => {
      expect(normalize({ contentEncoding: 'base64' })).toEqual({
        type: 'string',
        contentEncoding: 'base64',
      });
    });

    it('should restore type: string alongside other string assertions', () => {
      expect(
        normalize({ contentMediaType: 'image/png', maxLength: 10 }),
      ).toEqual({
        type: 'string',
        contentMediaType: 'image/png',
        maxLength: 10,
      });
    });

    it('should leave an existing type alone', () => {
      expect(
        normalize({
          type: ['string', 'null'],
          contentMediaType: 'application/octet-stream',
        }),
      ).toEqual({
        type: ['string', 'null'],
        contentMediaType: 'application/octet-stream',
      });
    });

    it('should not narrow a reference that carries a content keyword', () => {
      expect(
        normalize({
          $ref: '#/components/schemas/Upload',
          contentMediaType: 'application/octet-stream',
        }),
      ).toEqual({
        $ref: '#/components/schemas/Upload',
        contentMediaType: 'application/octet-stream',
      });
    });

    it('should not narrow a composition that carries a content keyword', () => {
      expect(
        normalize({
          anyOf: [{ type: 'string' }, { type: 'null' }],
          contentMediaType: 'application/octet-stream',
        }),
      ).toEqual({
        anyOf: [{ type: 'string' }, { type: 'null' }],
        contentMediaType: 'application/octet-stream',
      });
    });

    it('should not narrow a schema that asserts object or array keywords', () => {
      expect(
        normalize({
          properties: { data: { type: 'string' } },
          contentMediaType: 'application/json',
        }),
      ).toEqual({
        properties: { data: { type: 'string' } },
        contentMediaType: 'application/json',
      });
      expect(
        normalize({
          items: { type: 'string' },
          contentMediaType: 'application/json',
        }),
      ).toEqual({
        items: { type: 'string' },
        contentMediaType: 'application/json',
      });
    });

    it('should keep a sibling nullable when it infers the type', () => {
      // The inference has to run before `resolveNullable`, which drops a
      // `nullable` it has nothing to attach to. That is only harmless while
      // the schema stays typeless: a `type` added afterwards would exclude the
      // null. A 3.1 document still carrying 3.0 `nullable` reaches us this way.
      expect(
        normalize({
          contentMediaType: 'application/octet-stream',
          nullable: true,
        }),
      ).toEqual({
        type: ['string', 'null'],
        contentMediaType: 'application/octet-stream',
      });
    });

    it('should not narrow a schema carrying object assertions', () => {
      for (const assertion of [
        { required: ['a'] },
        { minProperties: 1 },
        { maxProperties: 2 },
        { propertyNames: { pattern: '^a' } },
        { dependentRequired: { a: ['b'] } },
      ]) {
        expect(
          normalize({ contentMediaType: 'application/json', ...assertion }),
        ).toEqual({ contentMediaType: 'application/json', ...assertion });
      }
    });

    it('should not narrow a schema carrying array assertions', () => {
      for (const assertion of [
        { minItems: 1 },
        { maxItems: 2 },
        { uniqueItems: true },
        { contains: { type: 'string' } },
      ]) {
        expect(
          normalize({ contentMediaType: 'application/json', ...assertion }),
        ).toEqual({ contentMediaType: 'application/json', ...assertion });
      }
    });

    it('should not narrow a schema carrying numeric assertions', () => {
      for (const assertion of [
        { minimum: 1 },
        { maximum: 2 },
        { multipleOf: 2 },
      ]) {
        expect(
          normalize({ contentMediaType: 'application/json', ...assertion }),
        ).toEqual({ contentMediaType: 'application/json', ...assertion });
      }
    });

    it('should not narrow a schema carrying a conditional applicator', () => {
      // `then` is in the same set, but an object literal spelling it trips the
      // no-thenable lint rule, so the two siblings stand in for it.
      for (const assertion of [
        { if: { type: 'object' } },
        { else: { type: 'number' } },
      ]) {
        expect(
          normalize({ contentMediaType: 'application/json', ...assertion }),
        ).toEqual({ contentMediaType: 'application/json', ...assertion });
      }
    });

    it('should still infer through annotations and string assertions', () => {
      // The common shape the fix exists for: a documented file part. Only
      // assertions block the inference, never annotations.
      expect(
        normalize({
          description: 'The image to upload',
          deprecated: false,
          contentMediaType: 'application/octet-stream',
          minLength: 1,
          pattern: '^.+$',
        }),
      ).toEqual({
        description: 'The image to upload',
        deprecated: false,
        type: 'string',
        contentMediaType: 'application/octet-stream',
        minLength: 1,
        pattern: '^.+$',
      });
    });

    it('should leave a schema with neither content keyword untouched', () => {
      expect(normalize({ maxLength: 10 })).toEqual({ maxLength: 10 });
    });

    it('should restore the type under a Media Type Object', () => {
      const result = normalizeToOpenApi31({
        content: {
          'image/png': { schema: { contentEncoding: 'base64' } },
        },
      }) as Record<string, unknown>;
      expect(
        (result.content as Record<string, Record<string, unknown>>)['image/png']
          .schema,
      ).toEqual({ type: 'string', contentEncoding: 'base64' });
    });
  });

  describe('exclusive bounds', () => {
    it('should convert a boolean exclusiveMinimum into the numeric form', () => {
      expect(
        normalize({ type: 'number', minimum: 1, exclusiveMinimum: true }),
      ).toEqual({ type: 'number', exclusiveMinimum: 1 });
    });

    it('should convert a boolean exclusiveMaximum into the numeric form', () => {
      expect(
        normalize({ type: 'number', maximum: 9, exclusiveMaximum: true }),
      ).toEqual({ type: 'number', exclusiveMaximum: 9 });
    });

    it('should drop a boolean exclusive bound with no bound to attach to', () => {
      expect(
        normalize({ type: 'number', exclusiveMinimum: true }),
      ).not.toHaveProperty('exclusiveMinimum');
    });

    it('should drop the undefined exclusiveMinimum the upgrader leaves behind', () => {
      // `upgrade()` assigns `exclusiveMinimum = schema.minimum` unconditionally,
      // so a spec with no `minimum` ends up with the key present and undefined.
      expect(
        normalize({ type: 'number', exclusiveMinimum: undefined }),
      ).not.toHaveProperty('exclusiveMinimum');
    });

    it('should drop exclusiveMaximum: false', () => {
      expect(
        normalize({ type: 'number', maximum: 9, exclusiveMaximum: false }),
      ).toEqual({ type: 'number', maximum: 9 });
    });

    it('should leave a numeric exclusiveMinimum alone', () => {
      expect(normalize({ type: 'number', exclusiveMinimum: 1 })).toEqual({
        type: 'number',
        exclusiveMinimum: 1,
      });
    });
  });

  describe('resolveSpec boundary', () => {
    // A 3.0 document carrying one of every residual case, run through the real
    // pipeline. `importSpecs` hands back the document `importOpenApi` was given,
    // which is the boundary this issue is about (#4115).
    const RESIDUAL_30_SPEC = {
      openapi: '3.0.3',
      info: { title: 'Residual', version: '1.0.0' },
      paths: {
        '/things': {
          post: {
            operationId: 'createThing',
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      file: {
                        type: 'string',
                        format: 'binary',
                        nullable: true,
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Thing' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Base: { type: 'object', properties: { id: { type: 'string' } } },
          UntypedEnum: { enum: ['foo', null], nullable: true },
          TypedEnum: { type: 'string', enum: ['a', 'b'], nullable: true },
          AnyOfNullable: {
            anyOf: [{ type: 'string' }, { type: 'number' }],
            nullable: true,
          },
          OneOfNullable: {
            oneOf: [{ type: 'string' }, { type: 'number' }],
            nullable: true,
          },
          AllOfNullable: {
            allOf: [
              { $ref: '#/components/schemas/Base' },
              { type: 'object', properties: { extra: { type: 'string' } } },
            ],
            nullable: true,
          },
          NullableBinary: { type: 'string', format: 'binary', nullable: true },
          Bounds: {
            type: 'number',
            minimum: 1,
            exclusiveMinimum: true,
            maximum: 9,
            exclusiveMaximum: true,
          },
          UnboundedExclusive: { type: 'number', exclusiveMinimum: true },
          Thing: {
            type: 'object',
            properties: {
              untypedEnum: { $ref: '#/components/schemas/UntypedEnum' },
              typedEnum: { $ref: '#/components/schemas/TypedEnum' },
              anyOfNullable: { $ref: '#/components/schemas/AnyOfNullable' },
              oneOfNullable: { $ref: '#/components/schemas/OneOfNullable' },
              allOfNullable: { $ref: '#/components/schemas/AllOfNullable' },
              nullableBinary: { $ref: '#/components/schemas/NullableBinary' },
              bounds: { $ref: '#/components/schemas/Bounds' },
            },
          },
        },
      },
    };

    /**
     * Every OpenAPI 3.0 keyword that must not survive `resolveSpec`, as a
     * predicate over one node. The walk below is deliberately exhaustive — it
     * visits data values too, which is why the fixture holds no `example`
     * payloads; preserving those is covered by the traversal tests above.
     */
    const RESIDUAL_30_KEYWORDS: {
      label: string;
      found: (node: Record<string, unknown>) => boolean;
    }[] = [
      { label: 'nullable', found: (node) => 'nullable' in node },
      {
        label: 'boolean or undefined exclusiveMinimum',
        found: (node) =>
          'exclusiveMinimum' in node &&
          typeof node.exclusiveMinimum !== 'number',
      },
      {
        label: 'boolean or undefined exclusiveMaximum',
        found: (node) =>
          'exclusiveMaximum' in node &&
          typeof node.exclusiveMaximum !== 'number',
      },
      {
        label: 'content format',
        found: (node) =>
          node.format === 'binary' ||
          node.format === 'base64' ||
          node.format === 'byte',
      },
    ];

    function findResidual30Keywords(
      node: unknown,
      path: string[] = [],
    ): string[] {
      if (Array.isArray(node)) {
        return node.flatMap((item, i) =>
          findResidual30Keywords(item, [...path, i + '']),
        );
      }
      if (typeof node !== 'object' || node === null) {
        return [];
      }

      const record = node as Record<string, unknown>;
      const here = RESIDUAL_30_KEYWORDS.filter((k) => k.found(record)).map(
        (k) => `${k.label} at #/${path.join('/')}`,
      );

      return [
        ...here,
        ...Object.entries(record).flatMap(([key, value]) =>
          findResidual30Keywords(value, [...path, key]),
        ),
      ];
    }

    async function resolveResidualSpec() {
      const workspace = await mkdtemp(path.join(os.tmpdir(), 'orval-oas31-'));
      const specPath = path.join(workspace, 'spec.json');
      try {
        await writeFile(specPath, JSON.stringify(RESIDUAL_30_SPEC), 'utf8');
        const normalizedOptions = await normalizeOptions(
          { output: { target: '' }, input: { target: specPath } },
          workspace,
          {},
        );
        const { spec } = await importSpecs(workspace, normalizedOptions);
        return spec;
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    }

    it('should leave no OpenAPI 3.0 keyword in the document handed to importOpenApi', async () => {
      const spec = await resolveResidualSpec();

      expect(findResidual30Keywords(spec)).toEqual([]);
    });

    it('should carry each residual 3.0 shape into its 3.1 equivalent', async () => {
      const spec = await resolveResidualSpec();
      const schemas = spec.components?.schemas as Record<string, unknown>;

      expect(schemas.UntypedEnum).toEqual({ enum: ['foo', null] });
      expect(schemas.TypedEnum).toEqual({
        type: ['string', 'null'],
        enum: ['a', 'b', null],
      });
      expect(schemas.AnyOfNullable).toEqual({
        anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
      });
      expect(schemas.OneOfNullable).toEqual({
        oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
      });
      expect(schemas.AllOfNullable).toEqual({
        anyOf: [
          {
            allOf: [
              { $ref: '#/components/schemas/Base' },
              { type: 'object', properties: { extra: { type: 'string' } } },
            ],
          },
          { type: 'null' },
        ],
      });
      expect(schemas.NullableBinary).toEqual({
        type: ['string', 'null'],
        contentMediaType: 'application/octet-stream',
      });
      expect(schemas.Bounds).toEqual({
        type: 'number',
        exclusiveMinimum: 1,
        exclusiveMaximum: 9,
      });
      expect(schemas.UnboundedExclusive).toEqual({ type: 'number' });
    });
  });

  describe('traversal', () => {
    it('should normalize schemas nested anywhere in the document', () => {
      const result = normalize({
        paths: {
          '/pets': {
            get: {
              responses: {
                200: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { enum: ['foo'], nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      expect(result).toEqual({
        paths: {
          '/pets': {
            get: {
              responses: {
                200: {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { enum: ['foo', null] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('should not touch a schema-shaped value held by `example`', () => {
      const result = normalize({
        type: 'object',
        example: { nullable: true, enum: ['foo'] },
      });
      expect(result.example).toEqual({ nullable: true, enum: ['foo'] });
    });

    it('should not touch a schema-shaped value held by `default`', () => {
      const result = normalize({
        type: 'object',
        default: { nullable: true },
      });
      expect(result.default).toEqual({ nullable: true });
    });

    it('should normalize a property that happens to be named `default`', () => {
      const result = normalize({
        type: 'object',
        properties: { default: { type: 'string', nullable: true } },
      });
      expect(result.properties).toEqual({
        default: { type: ['string', 'null'] },
      });
    });

    it('should normalize a schema named `example` under components', () => {
      const result = normalize({
        components: {
          schemas: { example: { type: 'string', nullable: true } },
        },
      });
      expect((result.components as Record<string, unknown>).schemas).toEqual({
        example: { type: ['string', 'null'] },
      });
    });

    it('should keep a schema property literally named `nullable`', () => {
      // Inside a `properties` map every key is a member name, so `nullable`
      // there is a field the API really has — not a keyword to consume.
      const result = normalize({
        type: 'object',
        properties: { nullable: { type: 'boolean' } },
      });
      expect(result.properties).toEqual({ nullable: { type: 'boolean' } });
    });

    it('should keep a component schema literally named `nullable`', () => {
      const result = normalizeToOpenApi31({
        components: { schemas: { nullable: { type: 'string' } } },
      }) as Record<string, Record<string, unknown>>;
      expect(result.components.schemas).toEqual({
        nullable: { type: 'string' },
      });
    });

    it('should normalize the schema of a `default` response', () => {
      // `responses` is keyed by status code, so `default` there is a status
      // key and not the schema keyword whose value must be left alone.
      const result = normalizeToOpenApi31({
        paths: {
          '/pets': {
            get: {
              responses: {
                default: {
                  content: {
                    'application/json': {
                      schema: { enum: ['a'], nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      });

      expect(result).toEqual({
        paths: {
          '/pets': {
            get: {
              responses: {
                default: {
                  content: {
                    'application/json': { schema: { enum: ['a', null] } },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('should normalize the schema of a header named after a data keyword', () => {
      const result = normalizeToOpenApi31({
        components: {
          headers: {
            example: { schema: { type: 'string', nullable: true } },
          },
        },
      });

      expect(result).toEqual({
        components: {
          headers: { example: { schema: { type: ['string', 'null'] } } },
        },
      });
    });

    it('should not invent a media type from a property named `content`', () => {
      // A schema may have an ordinary property called `content`. Only a real
      // Content Object supplies the media type that `format: 'byte'` carries
      // over, so this one must contribute nothing.
      const result = normalize({
        type: 'object',
        properties: {
          content: {
            type: 'object',
            properties: {
              data: { type: ['string', 'null'], format: 'byte' },
            },
          },
        },
      });

      expect(result).toEqual({
        type: 'object',
        properties: {
          content: {
            type: 'object',
            properties: {
              data: { type: ['string', 'null'], contentEncoding: 'base64' },
            },
          },
        },
      });
    });

    it('should leave a schema-shaped `x-` extension value alone', () => {
      // A Specification Extension value is unrestricted, so it is the user's
      // data and not ours to rewrite — even when it happens to look like a
      // schema. Nothing orval reads from an extension is a schema.
      const result = normalize({
        type: 'object',
        'x-custom': { schema: { enum: ['a'], nullable: true } },
      });

      expect(result['x-custom']).toEqual({
        schema: { enum: ['a'], nullable: true },
      });
    });

    it('should leave an `x-` extension on a non-schema object alone', () => {
      const result = normalizeToOpenApi31({
        paths: {
          '/pets': {
            get: {
              'x-custom': { schema: { type: 'string', nullable: true } },
            },
          },
        },
      });

      expect(result).toEqual({
        paths: {
          '/pets': {
            get: {
              'x-custom': { schema: { type: 'string', nullable: true } },
            },
          },
        },
      });
    });

    it('should normalize a property whose name begins with `x-`', () => {
      // Inside `properties` the key is a field name, so `x-legacy-id` is a
      // field the API has and its schema still has to be normalized.
      const result = normalize({
        type: 'object',
        properties: { 'x-legacy-id': { type: 'string', nullable: true } },
      });

      expect(result.properties).toEqual({
        'x-legacy-id': { type: ['string', 'null'] },
      });
    });

    it('should normalize the schema of a header whose name begins with `x-`', () => {
      const result = normalizeToOpenApi31({
        components: {
          headers: {
            'x-request-id': { schema: { type: 'string', nullable: true } },
          },
        },
      });

      expect(result).toEqual({
        components: {
          headers: { 'x-request-id': { schema: { type: ['string', 'null'] } } },
        },
      });
    });
    it('should leave a Link Object `requestBody` literal alone', () => {
      // A Link Object's `requestBody` is `Any | {expression}` — the literal
      // value to send, not an OpenAPI object, so it is the user's data.
      const result = normalizeToOpenApi31({
        components: {
          links: {
            GetPet: {
              operationId: 'getPet',
              requestBody: { schema: { enum: ['a'], nullable: true } },
            },
          },
        },
      });

      expect(result).toEqual({
        components: {
          links: {
            GetPet: {
              operationId: 'getPet',
              requestBody: { schema: { enum: ['a'], nullable: true } },
            },
          },
        },
      });
    });

    it('should leave Link Object `parameters` literals alone', () => {
      // `parameters` on a Link is a map of names to `Any | {expression}`, not
      // to Parameter Objects.
      const result = normalizeToOpenApi31({
        paths: {
          '/pets': {
            get: {
              responses: {
                '200': {
                  links: {
                    GetPet: {
                      operationId: 'getPet',
                      parameters: {
                        petId: { schema: { type: 'string', nullable: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      expect(result).toEqual({
        paths: {
          '/pets': {
            get: {
              responses: {
                '200': {
                  links: {
                    GetPet: {
                      operationId: 'getPet',
                      parameters: {
                        petId: { schema: { type: 'string', nullable: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('should still normalize a Link Object`s `server` variables', () => {
      // Everything on a Link that really is an OpenAPI object stays reachable.
      const result = normalizeToOpenApi31({
        components: {
          links: {
            GetPet: {
              operationId: 'getPet',
              server: {
                url: 'http://localhost',
                'x-custom': { schema: { type: 'string', nullable: true } },
              },
            },
          },
        },
      });

      expect(result).toEqual({
        components: {
          links: {
            GetPet: {
              operationId: 'getPet',
              server: {
                url: 'http://localhost',
                'x-custom': { schema: { type: 'string', nullable: true } },
              },
            },
          },
        },
      });
    });

    it('should pass through non-object types unchanged', () => {
      expect(normalizeToOpenApi31('string')).toBe('string');
      expect(normalizeToOpenApi31(null)).toBe(null);
      expect(normalizeToOpenApi31(42)).toBe(42);
      expect(normalizeToOpenApi31([1, 2, 3])).toEqual([1, 2, 3]);
    });
  });
});

describe('dereferenceExternalRef — Swagger 2.0 documents', () => {
  /** Just enough of a Swagger 2.0 path item to read the response schema back. */
  type PathsWithResponseSchema = Record<
    string,
    { get: { responses: Record<string, { schema: unknown }> } }
  >;

  it('does not inject a components key when nothing is merged', () => {
    // Strava's shape: the external document holds bare schemas at its root, so
    // the ref is inlined and no schema is merged. Creating the container
    // regardless left an empty `components` on a 2.0 document, which the
    // validator rejects with "Property components is not expected to be here".
    const input = {
      swagger: '2.0',
      paths: {
        '/athlete': {
          get: {
            responses: {
              '200': { schema: { $ref: '#/x-ext/athlete/DetailedAthlete' } },
            },
          },
        },
      },
      'x-ext': {
        athlete: {
          DetailedAthlete: {
            type: 'object',
            properties: { id: { type: 'integer' } },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as {
      paths: PathsWithResponseSchema;
    };

    expect(result).not.toHaveProperty('components');
    expect(result.paths['/athlete'].get.responses['200'].schema).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' } },
    });
  });

  it('leaves an OpenAPI 3 document without merged schemas free of an empty container', () => {
    const input = {
      openapi: '3.0.3',
      paths: {
        '/athlete': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: { $ref: '#/x-ext/athlete/DetailedAthlete' },
                  },
                },
              },
            },
          },
        },
      },
      'x-ext': {
        athlete: { DetailedAthlete: { type: 'object' } },
      },
    };

    const result = dereferenceExternalRef(input) as Record<string, unknown>;

    expect(result).not.toHaveProperty('components');
  });

  it('merges external schemas into definitions and rewrites refs accordingly', () => {
    const input = {
      swagger: '2.0',
      definitions: {
        Local: { type: 'string' },
      },
      paths: {
        '/athlete': {
          get: {
            responses: {
              '200': {
                schema: {
                  $ref: '#/x-ext/athlete/components/schemas/DetailedAthlete',
                },
              },
            },
          },
        },
      },
      'x-ext': {
        athlete: {
          components: {
            schemas: {
              DetailedAthlete: {
                type: 'object',
                properties: { id: { type: 'integer' } },
              },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as {
      definitions: Record<string, unknown>;
      paths: PathsWithResponseSchema;
    };

    expect(result).not.toHaveProperty('components');
    expect(result.definitions.DetailedAthlete).toEqual({
      type: 'object',
      properties: { id: { type: 'integer' } },
    });
    expect(result.definitions.Local).toEqual({ type: 'string' });
    expect(result.paths['/athlete'].get.responses['200'].schema).toEqual({
      $ref: '#/definitions/DetailedAthlete',
    });
  });

  it('rewrites a merged schema’s own internal refs to definitions', () => {
    const input = {
      swagger: '2.0',
      paths: {},
      'x-ext': {
        athlete: {
          components: {
            schemas: {
              DetailedAthlete: {
                type: 'object',
                properties: { club: { $ref: '#/components/schemas/Club' } },
              },
              Club: { type: 'object' },
            },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as {
      definitions: { DetailedAthlete: { properties: { club: unknown } } };
    };

    expect(result.definitions.DetailedAthlete.properties.club).toEqual({
      $ref: '#/definitions/Club',
    });
  });

  it('keeps OpenAPI 3 documents merging into components.schemas', () => {
    const input = {
      openapi: '3.0.3',
      paths: {},
      'x-ext': {
        athlete: {
          components: {
            schemas: { DetailedAthlete: { type: 'object' } },
          },
        },
      },
    };

    const result = dereferenceExternalRef(input) as {
      components: { schemas: Record<string, unknown> };
      definitions?: unknown;
    };

    expect(result).not.toHaveProperty('definitions');
    expect(result.components.schemas.DetailedAthlete).toEqual({
      type: 'object',
    });
  });
});
