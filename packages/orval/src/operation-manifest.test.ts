import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vite-plus/test';

import { typeCheck } from '../../core/src/test-utils/typescript';
import { generate } from './generate';

it('generates a TypeScript response lookup by status with payload-only fetch', async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), 'orval-manifest-'));
  try {
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
                    200: {
                      description: 'Pet',
                      content: {
                        'application/json': {
                          schema: { $ref: '#/components/schemas/Pet' },
                        },
                        'application/vnd.pet-preview+json': {
                          schema: { $ref: '#/components/schemas/PetPreview' },
                        },
                      },
                    },
                    204: { description: 'No content' },
                    404: {
                      description: 'Not found',
                      content: {
                        'application/json': {
                          schema: { type: 'string', format: 'pet-error' },
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
          operationManifest: { responsesByStatus: true },
          override: {
            fetch: { includeHttpResponseReturnType: false },
            formatType: {
              'pet-error': {
                type: 'PetError',
                import: { name: 'PetError', importPath: './errors' },
              },
            },
          },
        },
      },
      workspace,
      { throwOnError: true, logLevel: 'error' },
    );

    expect(
      typeCheck(
        {
          'errors.ts': `export type PetError = 'PET_NOT_FOUND';`,
          'assertions.ts': `
            import type { OperationTypes } from './endpoints.operations';
            import type { Pet, PetPreview } from './models';
            import type { PetError } from './errors';

            type Responses = OperationTypes['getPet']['responsesByStatus'];
            type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
              (<T>() => T extends B ? 1 : 2) ? true : false;
            type Check<T extends true> = T;
            export type Keys = Check<Equal<keyof Responses, 200 | 204 | 404 | '4XX' | 'default'>>;
            export type Success = Check<Equal<Responses[200], Pet | PetPreview>>;
            export type NoContent = Check<Equal<Responses[204], void>>;
            export type NotFound = Check<Equal<Responses[404], PetError>>;
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
