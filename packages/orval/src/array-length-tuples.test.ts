import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import type {
  OpenApiDocument,
  OpenApiSchemaObject,
  OutputOptions,
} from '@orval/core';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { typeCheck } from '../../core/src/test-utils/typescript';
import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils/options';

const arrangements: OpenApiSchemaObject = {
  type: 'array',
  minItems: 1,
  maxItems: 4,
  items: { $ref: '#/components/schemas/Arrangement' },
};
const dates: OpenApiSchemaObject = {
  type: 'array',
  minItems: 1,
  maxItems: 2,
  items: { type: 'string', format: 'date' },
};

const spec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Array length tuples', version: '1.0.0' },
  paths: {
    '/dates': {
      post: {
        operationId: 'saveDates',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: dates } },
        },
        responses: {
          200: {
            description: 'Saved',
            content: { 'application/json': { schema: dates } },
          },
        },
      },
    },
    '/empty': {
      post: {
        operationId: 'saveEmpty',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'array', items: { type: 'string' }, maxItems: 0 },
            },
          },
        },
        responses: { 204: { description: 'Saved' } },
      },
    },
    '/policy': {
      post: {
        operationId: 'savePolicy',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Policy' },
            },
          },
        },
        responses: { 204: { description: 'Saved' } },
      },
      get: {
        operationId: 'getPolicy',
        responses: {
          200: {
            description: 'Policy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Policy' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Arrangement: {
        type: 'object',
        required: ['bed'],
        properties: { bed: { type: 'string' } },
      },
      Policy: {
        type: 'object',
        required: ['id', 'groups'],
        properties: {
          id: { type: 'string', readOnly: true },
          groups: {
            type: 'array',
            items: {
              type: 'object',
              required: ['arrangements'],
              properties: { arrangements },
            },
          },
        },
      },
    },
  },
};

const consumer = (tooShort = '', tooLong = '') => `
import type { Policy } from './model';
type Arrangements = Policy['groups'][number]['arrangements'];
declare const bed: Arrangements[number];
export const one: Arrangements = [bed];
export const two: Arrangements = [bed, bed];
export const three: Arrangements = [bed, bed, bed];
export const four: Arrangements = [bed, bed, bed, bed];
${tooShort}
export const zero: Arrangements = [];
${tooLong}
export const five: Arrangements = [bed, bed, bed, bed, bed];
`;

describe('array length tuples in generated types', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(
      path.resolve(
        import.meta.dirname,
        '../../../tests/.orval-array-length-tuples-',
      ),
    );
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  async function generate(output: OutputOptions = {}) {
    const options = await normalizeOptions(
      {
        input: { target: spec },
        output: {
          target: './client.ts',
          schemas: './model',
          client: 'fetch',
          ...output,
        },
      },
      workspace,
    );
    await generateSpec(workspace, options);
  }

  function diagnostics(source: string) {
    return typeCheck(
      { 'consumer.ts': source },
      {
        cwd: workspace,
        compilerOptions: {
          strict: true,
          exactOptionalPropertyTypes: true,
          noUncheckedIndexedAccess: true,
          noUnusedLocals: true,
          skipLibCheck: true,
          types: [],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          target: 'ES2022',
        },
      },
    );
  }

  it('keeps the unbounded element array by default and when set to false', async () => {
    await generate();
    const model = path.join(workspace, 'model', 'policyGroupsItem.ts');
    const baseline = await readFile(model, 'utf8');
    expect(diagnostics(consumer())).toEqual([]);
    await generate({ override: { useArrayLengthTuples: false } });
    expect(await readFile(model, 'utf8')).toBe(baseline);
  });

  it('checks both bounds through split models and an inline request', async () => {
    await generate({ override: { useArrayLengthTuples: true } });
    expect(
      diagnostics(
        consumer(
          '// @ts-expect-error At least one arrangement is required.',
          '// @ts-expect-error At most four arrangements are allowed.',
        ) +
          `
import { saveEmpty, savePolicy } from './client';
void saveEmpty([]);
// @ts-expect-error This body has a maximum length of zero.
void saveEmpty(['unexpected']);
void savePolicy({groups: [{arrangements: [bed]}]});
// @ts-expect-error The request body requires at least one arrangement.
void savePolicy({groups: [{arrangements: []}]});
// @ts-expect-error The request body allows at most four arrangements.
void savePolicy({groups: [{arrangements: [bed, bed, bed, bed, bed]}]});
`,
      ),
    ).toEqual([]);
  });

  it('reports the incompatible generated mock response types before writing files', async () => {
    await expect(
      generate({
        mock: true,
        override: { useArrayLengthTuples: true },
      }),
    ).rejects.toThrow(
      '`override.useArrayLengthTuples` cannot be combined with built-in mocks',
    );
    await expect(
      readFile(path.join(workspace, 'client.ts')),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('works with request and response date transforms', async () => {
    await generate({
      override: { useArrayLengthTuples: true, useDatesTransform: true },
    });
    expect(diagnostics("export * from './client';")).toEqual([]);
  });
});
