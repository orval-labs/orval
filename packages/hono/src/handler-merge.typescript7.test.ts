import { describe, expect, it, vi } from 'vite-plus/test';

// TypeScript 7 (the native port) only exposes `version` from its main entry;
// the JS compiler API (`createSourceFile`, `ScriptTarget`, ...) is gone.
vi.mock('typescript', () => ({ default: { version: '7.0.2' } }));

describe('ensureTypeScript with a TypeScript 7 module', () => {
  it('reports the compiler API as unavailable instead of throwing', async () => {
    const { ensureTypeScript, reconcileHandlerFile } =
      await import('./handler-merge');

    expect(await ensureTypeScript()).toBe(false);

    const source = `export const listPetsHandlers = factory.createHandlers(async (c) => c.json({}));\n`;
    await expect(
      reconcileHandlerFile(source, {
        imports: {
          factory: { names: ['createFactory'], module: 'hono/factory' },
          context: { names: [], module: './context' },
        },
        handlers: [],
      }),
    ).resolves.toBe(source);
  });
});
