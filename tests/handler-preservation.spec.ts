import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { generate } from 'orval';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const spec = {
  openapi: '3.1.0',
  info: { title: 'Test', version: '1.0.0' },
  paths: {
    '/pets': {
      post: {
        operationId: 'createPet',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'ok',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { id: { type: 'number' } },
                  required: ['id'],
                },
              },
            },
          },
        },
      },
    },
  },
};

// No `clean` — handler files must survive regeneration.
const config = {
  input: { target: spec },
  output: {
    target: 'src/endpoints.ts',
    mode: 'split',
    client: 'hono',
    override: { hono: { handlers: 'src/handlers' } },
  },
} as unknown as Parameters<typeof generate>[0];

describe('hono handler preservation (end-to-end, clean disabled)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'orval-hono-preserve-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('preserves custom imports, middleware, helpers, and bodies across regeneration', async () => {
    // 1. first generation → fresh handler stub
    await generate(config, dir);
    const handlerPath = path.join(dir, 'src/handlers/createPet.ts');
    const fresh = await readFile(handlerPath, 'utf8');
    expect(fresh).toContain('createPetHandlers');
    expect(fresh).toContain("zValidator('json'");
    expect(fresh).toContain("zValidator('response'");

    // 2. the user fills it in: custom imports, middleware, body, top-level helper
    const edited =
      fresh
        .replace(
          "import { createFactory } from 'hono/factory';",
          "import { db } from '../db';\nimport { authenticate } from '../mw';\nimport { createFactory } from 'hono/factory';",
        )
        .replace(
          'export const createPetHandlers = factory.createHandlers(',
          'export const createPetHandlers = factory.createHandlers(\n  authenticate(),',
        )
        .replace(
          '=> {',
          '=> {\n    return c.json(await save()); // USER_BODY',
        ) + '\nasync function save() {\n  return db.insert();\n}\n';
    await writeFile(handlerPath, edited, 'utf8');

    // 3. regenerate with the default `smart` strategy and no clean
    await generate(config, dir);
    const result = await readFile(handlerPath, 'utf8');

    // user-authored code survives
    expect(result).toContain("import { db } from '../db';");
    expect(result).toContain("import { authenticate } from '../mw';");
    expect(result).toContain('authenticate(),');
    expect(result).toContain('async function save() {');
    expect(result).toContain('USER_BODY');
    // orval-owned validators remain in sync
    expect(result).toContain("zValidator('json'");
    expect(result).toContain("zValidator('response'");
  });
});
