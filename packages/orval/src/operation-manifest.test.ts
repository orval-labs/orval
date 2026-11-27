import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vite-plus/test';

import { typeCheck } from '../../core/src/test-utils/typescript';
import { generate } from './generate';

it.each([
  {
    variant: 'with schema-less text/plain',
    plainText: true,
    exclude: ['text/markdown'],
    expected: 'unknown',
  },
  {
    variant: 'with text/plain excluded',
    plainText: true,
    exclude: ['text/markdown', 'text/plain'],
    expected: 'Pet | PetPreview',
  },
  {
    variant: 'with only JSON media types declared',
    plainText: false,
    exclude: ['text/markdown'],
    expected: 'Pet | PetPreview',
  },
])('generates a response lookup $variant', async (scenario) => {
  const { plainText, exclude, expected } = scenario;
  const workspace = await mkdtemp(path.join(tmpdir(), 'orval-manifest-'));
  try {
    const petResponse = {
      description: 'Pet',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Pet' },
        },
        'application/vnd.pet-preview+json': {
          schema: { $ref: '#/components/schemas/PetPreview' },
        },
        ...(plainText ? { 'text/plain': {} } : {}),
      },
    };
    await generate(
      {
        input: {
          target: {
            openapi: '3.1.0',
            info: { title: 'Petstore', version: '1.0.0' },
            paths: {
              '/pet': {
                get: {
                  operationId: 'getPet',
                  responses: {
                    200: petResponse,
                    201: {
                      description: 'Created',
                      content: { 'application/json': {} },
                    },
                    202: {
                      description: 'Filtered out',
                      content: { 'text/markdown': {} },
                    },
                    203: { $ref: '#/components/responses/PetResponse' },
                    204: { description: 'No content' },
                    404: {
                      description: 'Not found',
                      content: {
                        'application/json': {
                          schema: { type: 'string', format: 'pet-error' },
                        },
                      },
                    },
                    409: {
                      description: 'Conflict',
                      content: {
                        'application/json': {
                          schema: { type: 'string', format: 'pet-conflict' },
                        },
                      },
                    },
                    '4XX': {
                      description: 'Other client error',
                      content: {
                        'application/json': { schema: { type: 'string' } },
                      },
                    },
                    default: {
                      description: 'Unspecified error',
                      content: { 'application/json': { schema: true } },
                    },
                  },
                },
              },
            },
            components: {
              responses: { PetResponse: petResponse },
              schemas: {
                Pet: { type: 'object', properties: { id: { type: 'string' } } },
                PetPreview: {
                  type: 'object',
                  properties: { name: { type: 'string' } },
                },
              },
            },
          },
        },
        output: {
          client: 'fetch',
          target: './endpoints.ts',
          schemas: './models',
          operationManifest: {
            path: './metadata/operations.ts',
            responsesByStatus: true,
          },
          override: {
            contentType: { exclude },
            fetch: { includeHttpResponseReturnType: false },
            formatType: {
              'pet-error': {
                type: 'PetError',
                import: { name: 'PetError', importPath: './errors.js' },
              },
              'pet-conflict': {
                type: 'PetConflict',
                import: { name: 'PetConflict', importPath: 'pet-types' },
              },
            },
          },
        },
      },
      workspace,
      { throwOnError: true, logLevel: 'error' },
    );

    expect(
      await readFile(path.join(workspace, 'metadata/operations.ts'), 'utf8'),
    ).toContain("from '../errors.js'");

    expect(
      typeCheck(
        {
          'errors.ts': `export type PetError = 'PET_NOT_FOUND';`,
          'pet-types.d.ts': `declare module 'pet-types' { export type PetConflict = 'PET_CONFLICT'; }`,
          'assertions.ts': `
            import type { OperationTypes } from './metadata/operations';
            import type { Pet, PetPreview } from './models';
            import type { PetError } from './errors.js';
            import type { PetConflict } from 'pet-types';

            type Responses = OperationTypes['getPet']['responsesByStatus'];
            type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
              (<T>() => T extends B ? 1 : 2) ? true : false;
            type Check<T extends true> = T;
            export type Keys = Check<Equal<keyof Responses, 200 | 201 | 203 | 204 | 404 | 409 | '4XX' | 'default'>>;
            export type Success = Check<Equal<Responses[200], ${expected}>>;
            export type NoSchema = Check<Equal<Responses[201], unknown>>;
            export type Referenced = Check<Equal<Responses[203], ${expected}>>;
            export type NoContent = Check<Equal<Responses[204], void>>;
            export type NotFound = Check<Equal<Responses[404], PetError>>;
            export type Conflict = Check<Equal<Responses[409], PetConflict>>;
            export type Range = Check<Equal<Responses['4XX'], string>>;
            export type Default = Check<Equal<Responses['default'], unknown>>;
          `,
        },
        {
          cwd: workspace,
          compilerOptions: {
            strict: true,
            module: 'ESNext',
            moduleResolution: 'Bundler',
            target: 'ES2022',
          },
        },
      ),
    ).toEqual([]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
