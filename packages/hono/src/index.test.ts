import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { GeneratorVerbOptions } from '@orval/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateHandlerFile } from './index';

const verb = (operationName: string): GeneratorVerbOptions =>
  ({
    operationName,
    params: [],
    body: { definition: '' },
    response: { originalSchema: {} },
  }) as unknown as GeneratorVerbOptions;

// A handler the user has filled in: a custom import, middleware in the chain, a
// distinctive body marker, and a top-level helper — none of which orval owns.
const userHandler = `import { getPets } from './db';
import { createFactory } from 'hono/factory';
import { ListPetsContext } from './endpoints.context';

const factory = createFactory();

export const listPetsHandlers = factory.createHandlers(
  authenticate(),
  async (c: ListPetsContext) => {
    return c.json(await loadPets()); // BODY_MARKER
  },
);

async function loadPets() {
  return getPets(); // HELPER_BODY
}
`;

describe('generateHandlerFile strategies', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'orval-hono-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const args = (file: string, strategy: 'smart' | 'skip' | 'full') => ({
    verbs: [verb('listPets')],
    path: file,
    header: '/* eslint-disable */\n',
    zodModule: path.join(dir, 'endpoints.zod'),
    contextModule: path.join(dir, 'endpoints.context'),
    strategy,
  });

  const writeHandler = async (content = userHandler) => {
    const file = path.join(dir, 'listPets.ts');
    await writeFile(file, content, 'utf8');
    return file;
  };

  it('generates a fresh file when none exists (any strategy)', async () => {
    const file = path.join(dir, 'listPets.ts');
    const result = await generateHandlerFile(args(file, 'smart'));

    expect(result).toContain("import { createFactory } from 'hono/factory';");
    expect(result).toContain('const factory = createFactory();');
    expect(result).toContain(
      'export const listPetsHandlers = factory.createHandlers(',
    );
  });

  it('skip: returns an existing file byte-for-byte', async () => {
    const file = await writeHandler();
    const result = await generateHandlerFile(args(file, 'skip'));
    expect(result).toBe(userHandler);
  });

  it('smart (regenerate, no clean): preserves custom imports, middleware, helpers, and body', async () => {
    const file = await writeHandler();
    const result = await generateHandlerFile(args(file, 'smart'));

    expect(result).toContain("import { getPets } from './db';"); // custom import
    expect(result).toContain('authenticate(),'); // middleware
    expect(result).toContain('async function loadPets() {'); // top-level helper
    expect(result).toContain('HELPER_BODY');
    expect(result).toContain('BODY_MARKER'); // handler body
  });

  it('full: keeps the body but drops custom imports, middleware, and helpers', async () => {
    const file = await writeHandler();
    const result = await generateHandlerFile(args(file, 'full'));

    expect(result).toContain('BODY_MARKER'); // body spliced back
    expect(result).not.toContain("import { getPets } from './db';");
    expect(result).not.toContain('authenticate(),');
    expect(result).not.toContain('async function loadPets()');
  });

  it('uses zValidator("form") for multipart/form-data bodies', async () => {
    const file = path.join(dir, 'uploadPhoto.ts');
    const formVerb = {
      operationName: 'uploadPhoto',
      params: [],
      body: {
        definition: 'UploadPhotoBody',
        contentType: 'multipart/form-data',
      },
      response: { originalSchema: {} },
      pathRoute: '/photo',
      tags: ['default'],
    } as unknown as GeneratorVerbOptions;

    const result = await generateHandlerFile({
      verbs: [formVerb],
      path: file,
      header: '/* eslint-disable */\n',
      validatorModule: path.join(dir, 'endpoints.validator'),
      zodModule: path.join(dir, 'endpoints.zod'),
      contextModule: path.join(dir, 'endpoints.context'),
      strategy: 'smart',
    });

    expect(result).toContain("zValidator('form', UploadPhotoBody)");
    expect(result).not.toContain("zValidator('json'");
  });
});
