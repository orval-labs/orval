import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  OpenApiDocument,
  OpenApiSchemaObject,
  OutputOptions,
} from '@orval/core';
import ts from 'typescript';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils/options';

const spec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Readonly arrays', version: '1' },
  paths: {
    '/draft': {
      post: {
        operationId: 'saveDraft',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Draft' },
            },
          },
        },
        responses: { 204: { description: 'Saved' } },
      },
    },
    '/items': {
      post: {
        operationId: 'saveItems',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Item' },
              },
            },
          },
        },
        responses: { 204: { description: 'Saved' } },
      },
    },
  },
  components: {
    schemas: {
      Item: {
        type: 'object',
        required: ['name', 'tags'],
        properties: {
          name: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      Draft: {
        type: 'object',
        required: ['id', 'items', 'pair', 'optionalItems'],
        properties: {
          id: { type: 'string', readOnly: true },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/Item' },
          },
          pair: {
            type: 'array',
            prefixItems: [{ type: 'string' }, { type: 'number' }],
            items: false,
          },
          optionalItems: { type: ['array', 'null'], items: { type: 'string' } },
        },
      },
    },
  },
};

const immutableConsumer = (preserve: boolean, checkReadonly = true) => `
import { saveDraft, saveItems } from './client';
const draft = {
  ${preserve ? "id: 'id'," : ''}
  items: [{ name: 'one', tags: ['a', 'b'] }],
  pair: ['x', 1],
  optionalItems: ['optional'],
} as const;
const items = [{ name: 'one', tags: ['a'] }] as const;
void saveDraft(draft);
void saveItems(items);
type Body = Parameters<typeof saveDraft>[0];
declare const body: Body;
${
  checkReadonly
    ? `// @ts-expect-error Generated array types must not expose mutable methods.
body.items.push({ name: 'two', tags: [] });`
    : ''
}
// @ts-expect-error Nested array element types must remain checked.
void saveItems([{ name: 'one', tags: [1] }]);
${
  preserve
    ? `// @ts-expect-error Preserve mode still requires the readOnly id.
void saveDraft({ items: [], pair: ['x', 1], optionalItems: null });`
    : `// @ts-expect-error Strip mode omits the response-only id.
void body.id;`
}
`;

const mutableConsumer = (preserve = false) => `
import { saveDraft, saveItems } from './client';
const draft = {
  ${preserve ? "id: 'id'," : ''}
  items: [{ name: 'one', tags: ['a'] }],
  pair: ['x', 1] as [string, number],
  optionalItems: null,
};
void saveDraft(draft);
void saveItems(draft.items);
`;

describe('readonly schema arrays in generated clients', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(
      path.resolve(
        import.meta.dirname,
        '../../../tests/.orval-readonly-arrays-',
      ),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(workspace, { recursive: true, force: true });
  });

  async function generate(
    override: NonNullable<OutputOptions['override']> = {},
    input = spec,
  ) {
    const options = await normalizeOptions(
      {
        input: { target: input },
        output: {
          target: './client.ts',
          client: 'fetch',
          override: { header: false, ...override },
        },
      },
      workspace,
    );
    await generateSpec(workspace, options);
    return readFile(path.join(workspace, 'client.ts'), 'utf8');
  }

  async function diagnostics(consumer: string) {
    const entry = path.join(workspace, 'consumer.ts');
    await writeFile(entry, consumer);
    const program = ts.createProgram([entry], {
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
    });
    return ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      );
  }

  it('keeps default output identical to false and rejects immutable arrays', async () => {
    const override = { preserveReadonlyRequestBodies: 'preserve' } as const;
    const baseline = await generate(override);
    expect(await diagnostics(mutableConsumer(true))).toEqual([]);
    const errors = await diagnostics(immutableConsumer(true, false));
    expect(errors).toHaveLength(2);
    expect(errors.every((error) => error.includes('readonly'))).toBe(true);
    expect(await generate({ ...override, useReadonlyArrays: false })).toBe(
      baseline,
    );
    expect(await diagnostics(immutableConsumer(true, false))).toEqual(errors);
  });

  it.each(['strip', 'preserve'] as const)(
    'accepts immutable arrays and tuples with request readOnly mode %s',
    async (mode) => {
      await generate({
        useReadonlyArrays: true,
        preserveReadonlyRequestBodies: mode,
      });
      expect(await diagnostics(immutableConsumer(mode === 'preserve'))).toEqual(
        [],
      );
      expect(await diagnostics(mutableConsumer(mode === 'preserve'))).toEqual(
        [],
      );
    },
  );

  it('transforms dates in readonly root and nested response arrays', async () => {
    const dateSpec: OpenApiDocument = {
      openapi: '3.1.0',
      info: { title: 'Date arrays', version: '1' },
      paths: Object.fromEntries(
        Object.entries({
          rootDates: {
            type: 'array',
            items: { type: 'string', format: 'date-time' },
          },
          nestedDates: {
            type: 'object',
            required: ['dates'],
            properties: {
              dates: {
                type: 'array',
                items: { type: 'string', format: 'date-time' },
              },
            },
          },
        } satisfies Record<string, OpenApiSchemaObject>).map(
          ([operationId, schema]) => [
            `/${operationId}`,
            {
              get: {
                operationId,
                responses: {
                  200: {
                    description: 'Success',
                    content: { 'application/json': { schema } },
                  },
                },
              },
            },
          ],
        ),
      ),
    };
    await generate(
      { useReadonlyArrays: true, useDatesTransform: true },
      dateSpec,
    );
    expect(
      await diagnostics(`
import { rootDates, nestedDates } from './client';
async function read() {
  const root = await rootDates();
  const nested = await nestedDates();
  const dates: readonly Date[] = root.data;
  const inner: readonly Date[] = nested.data.dates;
  return [dates, inner];
}
void read;
`),
    ).toEqual([]);
    const client = (await import(
      /* @vite-ignore */ path.join(workspace, 'client.ts')
    )) as {
      rootDates: () => Promise<{ data: Date[] }>;
      nestedDates: () => Promise<{ data: { dates: Date[] } }>;
    };
    const value = '2026-01-01T00:00:00.000Z';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify([value]), {
            headers: { 'content-type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ dates: [value] }), {
            headers: { 'content-type': 'application/json' },
          }),
        ),
    );
    expect((await client.rootDates()).data[0]).toEqual(new Date(value));
    expect((await client.nestedDates()).data.dates[0]).toEqual(new Date(value));
  });

  it('serializes deeply frozen request data without mutating it', async () => {
    await generate({ useReadonlyArrays: true });
    const client = (await import(
      /* @vite-ignore */ path.join(workspace, 'client.ts')
    )) as {
      saveDraft: (body: unknown) => Promise<unknown>;
    };
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const draft = Object.freeze({
      items: Object.freeze([
        Object.freeze({ name: 'one', tags: Object.freeze(['a', 'b']) }),
      ]),
      pair: Object.freeze(['x', 1]),
      optionalItems: Object.freeze(['optional']),
    });
    const before = JSON.stringify(draft);
    await client.saveDraft(draft);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(before);
    expect(JSON.stringify(draft)).toBe(before);
  });
});
