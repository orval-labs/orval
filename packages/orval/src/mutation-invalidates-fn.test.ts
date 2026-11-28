import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type {
  MutationInvalidatesContext,
  MutationInvalidatesOption,
  OpenApiDocument,
  OrvalReporter,
  QueryOptions,
  Tsconfig,
} from '@orval/core';
import { withReporter } from '@orval/core';
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

const ok = {
  description: 'ok',
  content: {
    'application/json': {
      schema: { type: 'object' as const, properties: {} },
    },
  },
};

const idParam = {
  name: 'id',
  in: 'path' as const,
  required: true,
  schema: { type: 'string' as const },
};

const spec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Things', version: '1' },
  paths: {
    '/things': {
      get: {
        operationId: 'listThings',
        tags: ['things'],
        parameters: [
          {
            name: 'page',
            in: 'query' as const,
            schema: { type: 'integer' as const },
          },
        ],
        responses: { 200: ok },
      },
      post: {
        operationId: 'createThing',
        tags: ['things'],
        responses: { 200: ok },
      },
    },
    '/things/{id}': {
      parameters: [idParam],
      get: {
        operationId: 'getThing',
        tags: ['things'],
        responses: { 200: ok },
      },
      delete: {
        operationId: 'deleteThing',
        tags: ['things'],
        responses: { 200: ok },
      },
    },
    '/things/search': {
      post: {
        operationId: 'searchThings',
        tags: ['things'],
        parameters: [
          {
            name: 'page',
            in: 'query' as const,
            schema: { type: 'integer' as const },
          },
        ],
        responses: { 200: ok },
      },
    },
    '/stats': {
      get: {
        operationId: 'getStats',
        tags: ['stats'],
        responses: { 200: ok },
      },
    },
  },
};

// Same-collection queries, plus stats from another tag's file.
const byPath: MutationInvalidatesOption = ({ mutations, queries }) =>
  mutations.map((mutation) => ({
    onMutations: [mutation.operationName],
    invalidates: [
      ...queries
        .filter(
          (query) =>
            query.path.split('/')[1] === mutation.path.split('/')[1] &&
            query.pathParams.every((param) =>
              mutation.pathParams.includes(param),
            ),
        )
        .flatMap((query) =>
          query.queryKeys.map((name) => ({
            query: name,
            params: query.pathParams,
          })),
        ),
      'getStats',
    ],
  }));

describe('function-valued mutationInvalidates', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(
      path.join(os.tmpdir(), 'orval-mutation-invalidates-'),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(workspace, { recursive: true, force: true });
  });

  const generate = async (
    mutationInvalidates: MutationInvalidatesOption,
    {
      operations = {},
      tsconfig,
    }: {
      operations?: Record<string, { query: QueryOptions }>;
      tsconfig?: Tsconfig;
    } = {},
  ) => {
    const warn = vi.fn();
    const reporter: OrvalReporter = {
      info: vi.fn(),
      warn,
      error: vi.fn(),
      verbose: vi.fn(),
      debug: vi.fn(),
    };

    const options = await normalizeOptions(
      {
        input: { target: spec },
        output: {
          target: './client.ts',
          mode: 'tags-split',
          client: 'react-query',
          httpClient: 'fetch',
          tsconfig,
          override: {
            header: false,
            query: { mutationInvalidates },
            operations,
          },
        },
      },
      workspace,
    );

    await withReporter(reporter, () => generateSpec(workspace, options));

    return {
      things: await readFile(path.join(workspace, 'things/things.ts'), 'utf8'),
      warnings: warn.mock.calls
        // oxlint-disable-next-line typescript/no-unsafe-member-access
        .map(([event]) => String(event.message))
        .filter((message) => message.includes('mutationInvalidates')),
    };
  };

  it('passes every mutation and query of the output to the function', async () => {
    let context: MutationInvalidatesContext | undefined;
    await generate((received) => {
      context = received;
      return [];
    });

    expect(context?.mutations.map((m) => m.operationName)).toStrictEqual([
      'createThing',
      'deleteThing',
      'searchThings',
    ]);
    expect(context?.queries).toStrictEqual([
      expect.objectContaining({
        operationName: 'listThings',
        verb: 'get',
        path: '/things',
        pathParams: [],
        tags: ['things'],
      }),
      expect.objectContaining({
        operationName: 'getThing',
        path: '/things/{id}',
        pathParams: ['id'],
      }),
      expect.objectContaining({ operationName: 'getStats', tags: ['stats'] }),
    ]);
  });

  it('generates the returned rules and imports targets from other tags', async () => {
    const { things, warnings } = await generate(byPath);

    expect(warnings).toStrictEqual([]);
    expect(things).toMatch(
      /import\s*{\s*getGetStatsQueryKey\s*}\s*from\s*'\.\.\/stats\/stats'/,
    );
    expect(things).toContain('getGetThingQueryKey(variables.id)');
    expect(things).toContain('getListThingsQueryKey()');
  });

  it('combines a function with an operation override like two arrays', async () => {
    const { things } = await generate(
      () => [{ onMutations: ['createThing'], invalidates: ['listThings'] }],
      {
        operations: {
          createThing: {
            query: {
              mutationInvalidates: [
                { onMutations: ['createThing'], invalidates: ['getStats'] },
              ],
            },
          },
        },
      },
    );

    expect(things).toContain('getListThingsQueryKey()');
    expect(things).toContain('getGetStatsQueryKey()');
  });

  it('lists an operation by the hook it is generated as', async () => {
    let context: MutationInvalidatesContext | undefined;
    await generate(
      (received) => {
        context = received;
        return [];
      },
      {
        operations: {
          searchThings: {
            query: { useInfinite: true, useInfiniteQueryParam: 'page' },
          },
        },
      },
    );

    expect(context?.mutations.map((m) => m.operationName)).not.toContain(
      'searchThings',
    );
    expect(
      context?.queries.find((q) => q.operationName === 'searchThings')
        ?.queryKeys,
    ).toStrictEqual(['searchThingsInfinite']);
  });

  it('offers the infinite key of a query that also has one', async () => {
    const { things } = await generate(byPath, {
      operations: {
        listThings: {
          query: { useInfinite: true, useInfiniteQueryParam: 'page' },
        },
      },
    });

    expect(things).toContain('getListThingsQueryKey()');
    expect(things).toContain('getListThingsInfiniteQueryKey()');
  });

  it('imports another tag file with the NodeNext extension', async () => {
    const { things } = await generate(
      () => [{ onMutations: ['createThing'], invalidates: ['getStats'] }],
      {
        tsconfig: {
          compilerOptions: { module: 'nodenext', moduleResolution: 'nodenext' },
        },
      },
    );

    expect(things).toMatch(
      /import\s*{\s*getGetStatsQueryKey\s*}\s*from\s*'\.\.\/stats\/stats\.js'/,
    );
  });

  it('warns about unknown operations the function returns', async () => {
    const { warnings } = await generate(() => [
      { onMutations: ['createThing'], invalidates: ['getThings'] },
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("'getThings'");
  });
});
