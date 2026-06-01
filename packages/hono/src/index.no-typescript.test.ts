import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { GeneratorVerbOptions } from '@orval/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { logWarningSpy } = vi.hoisted(() => ({ logWarningSpy: vi.fn() }));

vi.mock('@orval/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orval/core')>();
  return { ...actual, logWarning: logWarningSpy };
});

// Simulate the optional `typescript` peer dependency being absent.
vi.mock('./handler-merge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./handler-merge')>();
  return { ...actual, ensureTypeScript: vi.fn().mockResolvedValue(false) };
});

const verb = (operationName: string): GeneratorVerbOptions =>
  ({
    operationName,
    params: [],
    body: { definition: '' },
    response: { originalSchema: {} },
  }) as unknown as GeneratorVerbOptions;

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

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'orval-hono-nots-'));
    logWarningSpy.mockClear();
    // The "warn once" guard is module-scoped state in ./index. Reset the module
    // registry so each test gets a fresh guard and the warning assertion below
    // doesn't depend on test order.
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const run = async (strategy: 'smart' | 'full') => {
    const { generateHandlerFile } = await import('./index');
    const file = path.join(dir, 'listPets.ts');
    await writeFile(file, existing, 'utf8');
    return generateHandlerFile({
      verbs: [verb('listPets')],
      path: file,
      header: '/* eslint-disable */\n',
      zodModule: path.join(dir, 'endpoints.zod'),
      contextModule: path.join(dir, 'endpoints.context'),
      strategy,
    });
  };

  it('smart falls back to leaving the file unchanged and warns', async () => {
    const result = await run('smart');
    expect(result).toBe(existing);
    expect(logWarningSpy).toHaveBeenCalled();
  });

  it('full also falls back to leaving the file unchanged', async () => {
    const result = await run('full');
    expect(result).toBe(existing);
  });
});
