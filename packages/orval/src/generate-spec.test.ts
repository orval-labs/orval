import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { OpenApiDocument } from '@orval/core';
import fs from 'fs-extra';
import { describe, expect, it } from 'vitest';

import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils';

const PETSTORE_SPEC: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Petstore', version: '1.0.0' },
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
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
        },
      },
    },
  },
};

const createTempWorkspace = async () => {
  return mkdtemp(path.join(os.tmpdir(), 'orval-gen-spec-'));
};

describe('generateSpec - schemas: false', () => {
  it('does not generate separate schema files when schemas is false', async () => {
    const workspace = await createTempWorkspace();
    const schemasDir = path.join(workspace, 'model');
    const targetFile = path.join(workspace, 'endpoints.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './endpoints.ts',
            client: 'zod',
            schemas: false,
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      // schemas: false should prevent the schemas directory from being created
      expect(await fs.pathExists(schemasDir)).toBe(false);

      // The target file should still be generated
      expect(await fs.pathExists(targetFile)).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('generates separate schema files when schemas is a path', async () => {
    const workspace = await createTempWorkspace();
    const schemasDir = path.join(workspace, 'model');
    const targetFile = path.join(workspace, 'endpoints.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './endpoints.ts',
            client: 'zod',
            schemas: './model',
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      // schemas: './model' should create the schemas directory with files
      expect(await fs.pathExists(schemasDir)).toBe(true);
      const schemaFiles = await fs.readdir(schemasDir);
      expect(schemaFiles.length).toBeGreaterThan(0);

      // The target file should also be generated
      expect(await fs.pathExists(targetFile)).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
