import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { getStandardSchemaHelper } from '@orval/core';
import ts from 'typescript';
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import * as zod from 'zod';

import * as both from './generated/runtime-validation/fetch-standard-schema-both/endpoints';
import * as throwing from './generated/runtime-validation/fetch-standard-schema/endpoints';

/**
 * `runtimeValidation.standardSchema` replaces Zod's `parse`/`safeParse` with an
 * inline helper that calls `schema['~standard'].validate()`. These specs run
 * that emitted helper itself, with Zod and Valibot schema values, and run the
 * generated fetch clients that call it for both strategies.
 */
interface StandardSchemaHelpers {
  orvalParseStandardSchema: (schema: unknown, value: unknown) => unknown;
  orvalSafeParseStandardSchema: (
    schema: unknown,
    value: unknown,
  ) => { success: boolean; data?: unknown; error?: Error };
}

const isHelpers = (value: unknown): value is StandardSchemaHelpers =>
  typeof value === 'object' &&
  value !== null &&
  'orvalParseStandardSchema' in value &&
  typeof value.orvalParseStandardSchema === 'function' &&
  'orvalSafeParseStandardSchema' in value &&
  typeof value.orvalSafeParseStandardSchema === 'function';

const loadHelpers = (): StandardSchemaHelpers => {
  const { outputText } = ts.transpileModule(
    getStandardSchemaHelper('orvalParseStandardSchema(Schema, value)'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  );
  // Wrapped in an IIFE so the declarations stay local instead of becoming
  // globals of the test worker.
  const loaded: unknown = vm.runInThisContext(
    `(() => {\n${outputText}\nreturn { orvalParseStandardSchema, orvalSafeParseStandardSchema };\n})()`,
  );
  if (!isHelpers(loaded)) throw new Error('helpers were not declared');
  return loaded;
};

const { orvalParseStandardSchema, orvalSafeParseStandardSchema } =
  loadHelpers();

const schemas = {
  zod: zod.array(zod.object({ id: zod.number() })),
  valibot: v.array(v.object({ id: v.number() })),
};

describe.each(Object.entries(schemas))(
  'emitted helper with %s',
  (_, schema) => {
    it('returns the parsed value on success', () => {
      expect(orvalParseStandardSchema(schema, [{ id: 1 }])).toEqual([
        { id: 1 },
      ]);
      expect(orvalSafeParseStandardSchema(schema, [{ id: 1 }])).toEqual({
        success: true,
        data: [{ id: 1 }],
      });
    });

    it('throws a StandardSchemaError with a path message and issues', () => {
      const error = orvalSafeParseStandardSchema(schema, [{ id: 'one' }]).error;

      expect(error?.name).toBe('StandardSchemaError');
      expect(error?.message).toMatch(/^0\.id: /);
      expect(error).toHaveProperty('issues');
      expect(() => orvalParseStandardSchema(schema, [{ id: 'one' }])).toThrow(
        /^0\.id: /,
      );
    });
  },
);

describe('emitted helper with an async schema', () => {
  it('throws a TypeError and handles the rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const asyncSchema = {
      '~standard': {
        validate: () => Promise.reject(new Error('boom')),
      },
    };

    try {
      expect(() => orvalParseStandardSchema(asyncSchema, 1)).toThrow(TypeError);
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      process.off('unhandledRejection', unhandled);
    }

    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('emitted helper with a schema lacking ~standard', () => {
  it('throws a TypeError naming the Zod requirement', () => {
    expect(() => orvalParseStandardSchema({ parse: () => 1 }, 1)).toThrow(
      /Zod 3\.24/,
    );
  });
});

describe('generated fetch clients', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const respondWith = (body: unknown) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

  const goodItems = [{ id: 1, name: 'Rex' }];
  const badItems = [{ id: 'one', name: 'Rex' }];

  it('declares the helper once and no longer calls Zod parse', () => {
    const source = readFileSync(
      path.join(
        import.meta.dirname,
        'generated/runtime-validation/fetch-standard-schema/endpoints.ts',
      ),
      'utf8',
    );

    expect(source.match(/function orvalParseStandardSchema/g)).toHaveLength(1);
    expect(source).toContain(
      'orvalParseStandardSchema(zod.array(Item), parsedBody)',
    );
    expect(source).not.toContain('Item.parse(');
  });

  it('returns validated data for the throw strategy', async () => {
    respondWith(goodItems);

    const res = await throwing.listItems();

    expect(res.data).toEqual(goodItems);
  });

  it('rejects an invalid response with a StandardSchemaError', async () => {
    respondWith(badItems);

    const error = await throwing.listItems().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').toMatch(/^0\.id: /);
    expect(error).toHaveProperty('name', 'StandardSchemaError');
    expect(error).toHaveProperty('issues');
  });

  it('logs the error before re-throwing for the both strategy', async () => {
    respondWith(badItems);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(both.listItems()).rejects.toThrow(/^0\.id: /);
    expect(spy).toHaveBeenCalledWith(
      '[orval] listItems response validation failed',
      expect.objectContaining({ name: 'StandardSchemaError' }),
    );
  });

  it('returns validated data for the both strategy', async () => {
    respondWith(goodItems);

    const res = await both.listItems();

    expect(res.data).toEqual(goodItems);
  });
});
