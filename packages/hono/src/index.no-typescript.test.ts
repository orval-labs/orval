import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { GeneratorVerbOptions, OrvalReporter } from '@orval/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

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
    // The "warn once" guard is module-scoped state in ./index. Reset the module
    // registry so each test gets a fresh guard and the warning assertion below
    // doesn't depend on test order.
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const run = async (strategy: 'smart' | 'full', reporter?: OrvalReporter) => {
    const { generateHandlerFile } = await import('./index');
    const { withReporter } = await import('@orval/core');
    const file = path.join(dir, 'listPets.ts');
    await writeFile(file, existing, 'utf8');
    const generate = () =>
      generateHandlerFile({
        verbs: [verb('listPets')],
        path: file,
        header: '/* eslint-disable */\n',
        zodModule: path.join(dir, 'endpoints.zod'),
        contextModule: path.join(dir, 'endpoints.context'),
        strategy,
      });
    return reporter ? withReporter(reporter, generate) : generate();
  };

  it('smart falls back to leaving the file unchanged and warns', async () => {
    const warn = vi.fn();
    const result = await run('smart', {
      info() {},
      warn,
      error() {},
      verbose() {},
      debug() {},
    });
    expect(result).toBe(existing);
    expect(warn).toHaveBeenCalled();
  });

  it('full also falls back to leaving the file unchanged', async () => {
    const result = await run('full');
    expect(result).toBe(existing);
  });
});
