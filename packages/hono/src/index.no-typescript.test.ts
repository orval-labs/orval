import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createTestGeneratorVerbOptions } from '../../core/src/test-utils';
import { generateHandlerFile } from './index';

// Simulate the TypeScript compiler API being unavailable.
vi.mock('./handler-merge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./handler-merge')>();
  return { ...actual, ensureTypeScript: vi.fn().mockResolvedValue(false) };
});

const verb = (operationName: string) =>
  createTestGeneratorVerbOptions({
    operationName,
    typeName: operationName,
  });

const existing = `import { custom } from './x';
const factory = createFactory();
export const listPetsHandlers = factory.createHandlers(
  async (c) => {
    return c.json(custom());
  },
);
`;

describe('generateHandlerFile when typescript is unavailable', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'orval-hono-nots-'));
    file = path.join(dir, 'listPets.ts');
    await writeFile(file, existing, 'utf8');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const run = (strategy: 'smart' | 'full' | 'skip') =>
    generateHandlerFile({
      verbs: [verb('listPets'), verb('createPet')],
      path: file,
      header: '/* eslint-disable */\n',
      zodModule: path.join(dir, 'endpoints.zod'),
      contextModule: path.join(dir, 'endpoints.context'),
      strategy,
    });

  // Silently keeping the stale file would let the regenerated router reference
  // handlers (here `createPetHandlers`) that the file does not export.
  it.each(['smart', 'full'] as const)(
    '%s fails generation and leaves the file unchanged',
    async (strategy) => {
      await expect(run(strategy)).rejects.toThrow(
        /requires the TypeScript compiler API/,
      );
      expect(await readFile(file, 'utf8')).toBe(existing);
    },
  );

  it('skip does not need the compiler API', async () => {
    await expect(run('skip')).resolves.toBe(existing);
  });
});
