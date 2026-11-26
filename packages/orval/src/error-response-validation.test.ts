import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

import {
  dynamicImport,
  type OpenApiDocument,
  type ZodOptions,
} from '@orval/core';
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

// A declared error body must not be validated against the success schema
// (#4609): an object schema rejects it just like a primitive one does.
const spec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Demo', version: '0.0.0' },
  paths: {
    '/pets/{id}': {
      get: {
        operationId: 'getPet',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'The pet.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' },
              },
            },
          },
          404: {
            description: 'No such pet.',
            content: {
              'application/problem+json': {
                schema: { $ref: '#/components/schemas/Problem' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      },
      Problem: {
        type: 'object',
        required: ['title', 'status'],
        properties: { title: { type: 'string' }, status: { type: 'integer' } },
      },
    },
  },
};

const respond = (status: number, body: unknown, contentType: string) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': contentType },
      }),
    ),
  );
};

describe.each(['inline', 'shared'] as const)(
  'fetch runtimeValidation with %s runtime',
  (runtimeImplementationStyle) => {
    let workspace: string;

    beforeEach(async () => {
      workspace = await mkdtemp(
        path.resolve(import.meta.dirname, '../../../tests/.orval-error-body-'),
      );
      const options = await normalizeOptions(
        {
          input: { target: spec },
          output: {
            target: './client.ts',
            schemas: { path: './model', type: 'zod' },
            client: 'fetch',
            override: {
              header: false,
              zod: { version: 4 } as ZodOptions,
              fetch: { runtimeValidation: true, runtimeImplementationStyle },
            },
          },
        },
        workspace,
      );
      await generateSpec(workspace, options);
    });

    afterEach(async () => {
      vi.unstubAllGlobals();
      await rm(workspace, { recursive: true, force: true });
    });

    const load = () =>
      dynamicImport<{ getPet: (id: string) => Promise<unknown> }>(
        './client.ts',
        workspace,
        false,
      );

    it('validates a 2xx body against the success schema', async () => {
      const { getPet } = await load();
      respond(200, { id: '1', name: 'Rex' }, 'application/json');
      await expect(getPet('1')).resolves.toMatchObject({
        status: 200,
        data: { id: '1', name: 'Rex' },
      });

      respond(200, { id: '1' }, 'application/json');
      await expect(getPet('1')).rejects.toMatchObject({ name: 'ZodError' });
    });

    it('returns a declared error body unvalidated', async () => {
      const { getPet } = await load();
      respond(
        404,
        { title: 'Not Found', status: 404 },
        'application/problem+json',
      );
      await expect(getPet('1')).resolves.toMatchObject({
        status: 404,
        data: { title: 'Not Found', status: 404 },
      });
    });
  },
);
