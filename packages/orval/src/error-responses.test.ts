import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  OpenApiDocument,
  OpenApiSchemaObject,
  OverrideOutputContentType,
} from '@orval/core';
import ts from 'typescript';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils/options';

const json = (properties: Record<string, OpenApiSchemaObject>) => ({
  description: 'Example response',
  content: {
    'application/json': {
      schema: {
        type: 'object' as const,
        properties,
        required: Object.keys(properties),
      },
    },
  },
});
const responses = {
  200: json({ ok: { type: 'boolean' } }),
  404: json({ message: { type: 'string' } }),
  422: json({ fields: { type: 'array', items: { type: 'string' } } }),
};
const spec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Response errors', version: '1' },
  paths: {
    '/example': {
      get: { operationId: 'load', responses },
      post: { operationId: 'save', responses },
    },
    '/empty': {
      get: {
        operationId: 'emptyError',
        responses: {
          200: responses[200],
          404: { description: 'No body' },
        },
      },
    },
    '/referenced': {
      get: {
        operationId: 'referencedError',
        responses: {
          200: responses[200],
          404: { $ref: '#/components/responses/MultiMedia' },
        },
      },
    },
    '/health': {
      get: { operationId: 'health', responses: { 200: responses[200] } },
    },
  },
  components: {
    responses: {
      MultiMedia: {
        description: 'JSON or text error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { message: { type: 'string' } },
            },
          },
          'text/plain': { schema: { type: 'string' } },
        },
      },
    },
  },
};

// This example mutator owns error handling; the generator only supplies metadata.
const mutator = `
export type ErrorType<T> = T | Error;
export async function request<T>(url: string, options: RequestInit, context?: {
  errorResponses: readonly { status: number; contentType: string }[];
}): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.text();
  const data: unknown = body === '' ? undefined
    : response.headers.get('content-type')?.includes('json') ? JSON.parse(body) : body;
  const result = { status: response.status, data, headers: response.headers };
  if (!response.ok) {
    if (context?.errorResponses.some(entry => entry.status === response.status &&
      entry.contentType === (response.headers.get('content-type')?.split(';')[0] ?? ''))) throw result;
    throw new Error('Unexpected response');
  }
  return result as T;
}
`;
const consumer = `
import type { LoadQueryError, SaveMutationError, HealthQueryError } from './client';
export function query(error: LoadQueryError) {
  if (error instanceof Error) return;
  switch (error.status) {
    case 404: return error.data.message;
    case 422: return error.data.fields;
    default: { const unhandled: never = error; return unhandled; }
  }
}
export function mutation(error: SaveMutationError) {
  if (error instanceof Error) return;
  if (error.status === 422) { const fields: string[] = error.data.fields; return fields; }
  // @ts-expect-error 404 has not been handled
  const unhandled: never = error;
  return unhandled;
}
export function health(error: HealthQueryError) { const unexpected: Error = error; return unexpected; }
`;

describe.each([false, true])(
  'custom fetch error responses (#4111, default export: %s)',
  (defaultExport) => {
    let workspace: string;

    beforeEach(async () => {
      // Resolve the real React Query dependency already installed for this sample.
      workspace = await mkdtemp(
        path.resolve(
          import.meta.dirname,
          '../../../samples/react-query/custom-fetch/.orval-errors-',
        ),
      );
      await writeFile(
        path.join(workspace, 'mutator.ts'),
        mutator + (defaultExport ? '\nexport default request;\n' : ''),
      );
      await writeFile(path.join(workspace, 'consumer.ts'), consumer);
    });

    afterEach(async () => {
      vi.unstubAllGlobals();
      await rm(workspace, { recursive: true, force: true });
    });

    async function generate(
      enabled: boolean,
      input = spec,
      contentType?: OverrideOutputContentType,
    ) {
      const options = await normalizeOptions(
        {
          input: { target: input },
          output: {
            target: './client.ts',
            client: 'react-query',
            httpClient: 'fetch',
            override: {
              header: false,
              contentType,
              mutator: {
                path: './mutator.ts',
                ...(defaultExport ? {} : { name: 'request' }),
              },
              fetch: {
                includeHttpErrorResponse: enabled,
                forceSuccessResponse: true,
              },
            },
          },
        },
        workspace,
      );
      await generateSpec(workspace, options);
      return readFile(path.join(workspace, 'client.ts'), 'utf8');
    }

    function diagnostics() {
      const program = ts.createProgram([path.join(workspace, 'consumer.ts')], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
      });
      return ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    }

    it('omits response metadata and status narrowing when disabled', async () => {
      const baseline = await generate(false);
      expect(baseline).not.toContain('"errorResponses"');
      expect(
        diagnostics().some((message) =>
          message.includes("Property 'status' does not exist"),
        ),
      ).toBe(true);
    });

    it('generates narrowing and exhaustive error types deterministically', async () => {
      const enabled = await generate(true);
      expect(diagnostics()).toEqual([]);
      expect(await generate(true)).toBe(enabled);
    });

    it('passes error metadata to the mutator at runtime', async () => {
      await generate(true);
      const client = (await import(
        /* @vite-ignore */ path.join(workspace, 'client.ts')
      )) as {
        load: () => Promise<unknown>;
        save: () => Promise<unknown>;
        health: () => Promise<unknown>;
        emptyError: () => Promise<unknown>;
        referencedError: () => Promise<unknown>;
      };
      for (const request of [client.load, client.save]) {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ fields: ['name'] }), {
              status: 422,
              headers: { 'content-type': 'application/json; charset=utf-8' },
            }),
          ),
        );
        await expect(request()).rejects.toMatchObject({
          status: 422,
          data: { fields: ['name'] },
        });
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            new Response('{}', {
              status: 502,
              headers: { 'content-type': 'application/json' },
            }),
          ),
        );
        await expect(request()).rejects.toThrow('Unexpected response');
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            new Response('{}', {
              status: 422,
              headers: { 'content-type': 'text/plain' },
            }),
          ),
        );
        await expect(request()).rejects.toThrow('Unexpected response');
      }
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('{}', {
            status: 422,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      );
      await expect(client.health()).rejects.toThrow('Unexpected response');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      );
      await expect(client.emptyError()).rejects.toMatchObject({
        status: 404,
        data: undefined,
      });
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('Missing', {
            status: 404,
            headers: { 'content-type': 'text/plain' },
          }),
        ),
      );
      await expect(client.referencedError()).rejects.toMatchObject({
        status: 404,
        data: 'Missing',
      });
    });

    it.each(['default', '4XX'])(
      'rejects retained %s error responses',
      async (key) => {
        await expect(
          generate(true, {
            ...spec,
            paths: {
              '/unsupported': {
                get: {
                  operationId: 'unsupported',
                  responses: {
                    ...responses,
                    [key]: responses[404],
                  },
                },
              },
            },
          }),
        ).rejects.toThrow(
          /includeHttpErrorResponse requires explicit error status codes/,
        );
      },
    );

    it.each([{ include: ['application/json'] }, { exclude: ['text/plain'] }])(
      'ignores excluded error responses with %j',
      async (filter) => {
        const expected = await generate(true, spec, filter);
        expect(diagnostics()).toEqual([]);
        for (const key of ['default', '4XX']) {
          const filteredSpec: OpenApiDocument = {
            ...spec,
            paths: {
              ...spec.paths,
              '/example': {
                get: {
                  operationId: 'load',
                  responses: {
                    ...responses,
                    [key]: {
                      description: 'Excluded error response',
                      content: { 'text/plain': { schema: { type: 'string' } } },
                    },
                  },
                },
                post: { operationId: 'save', responses },
              },
            },
          };
          // Identical source shares the baseline's type-check result.
          expect(await generate(true, filteredSpec, filter)).toBe(expected);
        }
      },
    );
  },
);
