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
  parseStandardSchema: (schema: unknown, value: unknown) => unknown;
  safeParseStandardSchema: (
    schema: unknown,
    value: unknown,
  ) => { success: boolean; data?: unknown; error?: Error };
}

const isHelpers = (value: unknown): value is StandardSchemaHelpers =>
  typeof value === 'object' &&
  value !== null &&
  'parseStandardSchema' in value &&
  typeof value.parseStandardSchema === 'function' &&
  'safeParseStandardSchema' in value &&
  typeof value.safeParseStandardSchema === 'function';

const loadHelpers = (): StandardSchemaHelpers => {
  const { outputText } = ts.transpileModule(
    getStandardSchemaHelper('parseStandardSchema(Schema, value)'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  );
  const loaded: unknown = vm.runInThisContext(
    `${outputText}\n({ parseStandardSchema, safeParseStandardSchema });`,
  );
  if (!isHelpers(loaded)) throw new Error('helpers were not declared');
  return loaded;
};

const { parseStandardSchema, safeParseStandardSchema } = loadHelpers();

const schemas = {
  zod: zod.array(zod.object({ id: zod.number() })),
  valibot: v.array(v.object({ id: v.number() })),
};

describe.each(Object.entries(schemas))(
  'emitted helper with %s',
  (_, schema) => {
    it('returns the parsed value on success', () => {
      expect(parseStandardSchema(schema, [{ id: 1 }])).toEqual([{ id: 1 }]);
      expect(safeParseStandardSchema(schema, [{ id: 1 }])).toEqual({
        success: true,
        data: [{ id: 1 }],
      });
    });

    it('throws a StandardSchemaError with a path message and issues', () => {
      const error = safeParseStandardSchema(schema, [{ id: 'one' }]).error;

      expect(error?.name).toBe('StandardSchemaError');
      expect(error?.message).toMatch(/^0\.id: /);
      expect(error).toHaveProperty('issues');
      expect(() => parseStandardSchema(schema, [{ id: 'one' }])).toThrow(
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

    expect(() => parseStandardSchema(asyncSchema, 1)).toThrow(TypeError);
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
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

  const goodPets = [{ id: 1, name: 'Rex', type: 'cat' }];
  const badPets = [{ id: 'one', name: 'Rex', type: 'cat' }];

  it('declares the helper once and no longer calls Zod parse', () => {
    const source = readFileSync(
      path.join(
        import.meta.dirname,
        'generated/runtime-validation/fetch-standard-schema/endpoints.ts',
      ),
      'utf8',
    );

    expect(source.match(/function parseStandardSchema/g)).toHaveLength(1);
    expect(source).toContain('parseStandardSchema(Pets, parsedBody)');
    expect(source).not.toContain('Pets.parse(');
  });

  it('returns validated data for the throw strategy', async () => {
    respondWith(goodPets);

    const res = await throwing.listPets({ limit: '10', sort: 'name' });

    expect(res.data).toEqual(goodPets);
  });

  it('rejects an invalid response with a StandardSchemaError', async () => {
    respondWith(badPets);

    const error = await throwing
      .listPets({ limit: '10', sort: 'name' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error instanceof Error ? error.message : '').toMatch(/^0\.id: /);
    expect(error).toHaveProperty('name', 'StandardSchemaError');
    expect(error).toHaveProperty('issues');
  });

  it('logs the error before re-throwing for the both strategy', async () => {
    respondWith(badPets);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(both.listPets({ limit: '10', sort: 'name' })).rejects.toThrow(
      /^0\.id: /,
    );
    expect(spy).toHaveBeenCalledWith(
      '[orval] listPets response validation failed',
      expect.objectContaining({ name: 'StandardSchemaError' }),
    );
  });

  it('returns validated data for the both strategy', async () => {
    respondWith(goodPets);

    const res = await both.listPets({ limit: '10', sort: 'name' });

    expect(res.data).toEqual(goodPets);
  });
});
