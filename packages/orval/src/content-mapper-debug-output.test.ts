import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createGeneratedFileCheck,
  type OpenApiDocument,
  type OutputOptions,
  withGeneratedFileCheck,
} from '@orval/core';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { generateContentMapperOutput } from './generate-content-mapper-output';
import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils/options';

const SPEC: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Petstore', version: '1.0.0' },
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': {
            description: 'A list of pets',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Pet' },
                },
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
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['available', 'sold'] },
        },
      },
    },
  },
};

describe('output.contentMapper.debugOutputPath', () => {
  let workspace: string;
  let debugFile: string;

  beforeEach(async () => {
    workspace = await mkdtemp(path.join(os.tmpdir(), 'orval-debug-output-'));
    await mkdir(path.join(workspace, 'specs'));
    // JSON is YAML, so the spec keeps the extension the content mapper serves.
    await writeFile(
      path.join(workspace, 'specs/petstore.openapi.yaml'),
      JSON.stringify(SPEC),
    );
    debugFile = path.join(workspace, '.orval/petstore.schemas.ts');
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  const normalize = (output: OutputOptions = {}) =>
    normalizeOptions(
      {
        input: './specs/petstore.openapi.yaml',
        output: {
          target: './api/endpoints.ts',
          contentMapper: { schemas: true, debugOutputPath: './.orval' },
          ...output,
        },
      },
      workspace,
    );

  it('writes what the content mapper serves, named after the spec', async () => {
    const options = await normalize();
    await generateSpec(workspace, options);

    const content = await readFile(debugFile, 'utf8');
    expect(content).toBe(await generateContentMapperOutput(workspace, options));
    expect(content).toContain('export interface Pet');
  });

  it('writes the content unformatted', async () => {
    const options = await normalize({ formatter: 'prettier' });
    await generateSpec(workspace, options);

    expect(await readFile(debugFile, 'utf8')).toBe(
      await generateContentMapperOutput(workspace, options),
    );
  });

  it('writes nothing under a check, and leaves it out of the comparison', async () => {
    const options = await normalize();
    const check = createGeneratedFileCheck();
    await withGeneratedFileCheck(check, () => generateSpec(workspace, options));

    await expect(stat(debugFile)).rejects.toThrow();
    expect([...check.files.keys()]).not.toContain(debugFile);
  });

  it('leaves an unchanged file untouched', async () => {
    const options = await normalize();
    await generateSpec(workspace, options);
    const { mtimeMs } = await stat(debugFile);

    await new Promise((resolve) => setTimeout(resolve, 20));
    await generateSpec(workspace, options);

    expect((await stat(debugFile)).mtimeMs).toBe(mtimeMs);
  });
});
