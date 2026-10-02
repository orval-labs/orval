import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  dynamicImport,
  type OpenApiDocument,
  type OpenApiSchemaObject,
  type OutputOptions,
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

type TestOutputOptions = Omit<OutputOptions, 'target'>;

const scalarSpec = (
  schemas: Record<string, OpenApiSchemaObject>,
): OpenApiDocument => ({
  openapi: '3.1.0',
  info: { title: 'Primitive responses', version: '1' },
  paths: Object.fromEntries(
    Object.entries(schemas).map(
      ([operationId, schema]) =>
        [
          `/${operationId}`,
          {
            get: {
              operationId,
              responses: {
                200: {
                  description: 'Success',
                  content: { 'application/json': { schema } },
                },
                400: {
                  description: 'Error',
                  content: {
                    'application/json': { schema: { type: 'string' } },
                  },
                },
              },
            },
          },
        ] as const,
    ),
  ),
});

const clients: [string, TestOutputOptions][] = [
  [
    'fetch',
    { client: 'fetch', override: { fetch: { runtimeValidation: true } } },
  ],
  ...(
    ['react-query', 'vue-query', 'svelte-query', 'solid-query', 'swr'] as const
  ).map((client): [string, TestOutputOptions] => [
    client,
    {
      client,
      httpClient: 'fetch',
      override: { fetch: { runtimeValidation: true } },
    },
  ]),
  [
    'angular HttpClient',
    {
      client: 'angular',
      override: {
        angular: { retrievalClient: 'httpClient', runtimeValidation: true },
      },
    },
  ],
  [
    'angular httpResource',
    {
      client: 'angular',
      override: {
        angular: { retrievalClient: 'httpResource', runtimeValidation: true },
      },
    },
  ],
  [
    'angular-query',
    {
      client: 'angular-query',
      override: { query: { runtimeValidation: true } },
    },
  ],
];

describe('primitive response runtime validation (#4138)', () => {
  let workspace: string;

  beforeEach(async () => {
    // Resolve the actual Zod 4 and client dependencies installed for tests.
    workspace = await mkdtemp(
      path.resolve(import.meta.dirname, '../../../tests/.orval-primitives-'),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(workspace, { recursive: true, force: true });
  });

  async function generate(
    output: TestOutputOptions,
    spec = scalarSpec({ readValue: { type: 'boolean' } }),
  ) {
    const options = await normalizeOptions(
      {
        input: { target: spec },
        output: {
          target: './client.ts',
          schemas: { path: './model', type: 'zod' },
          ...output,
          override: {
            ...output.override,
            header: false,
            zod: { version: 4, ...output.override?.zod },
          },
        },
      },
      workspace,
    );
    await generateSpec(workspace, options);
    return readFile(path.join(workspace, 'client.ts'), 'utf8');
  }

  function diagnostics() {
    const program = ts.createProgram([path.join(workspace, 'client.ts')], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
    });
    return ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      );
  }

  it.each(clients)('wires and typechecks %s output', async (_name, output) => {
    const client = await generate(output);
    expect(client).toMatch(/ReadValue200\.parse(?:\(|[,\n])/);
    expect(client).toMatch(/import \{[^}]*\bReadValue200\b/);
    expect(client).toContain('ReadValue200Output');
    expect(client).not.toContain('ReadValue400.parse');
    expect(diagnostics()).toEqual([]);

    const schemaFiles = (await readdir(path.join(workspace, 'model'))).filter(
      (file) => file.endsWith('.zod.ts'),
    );
    expect(schemaFiles).toHaveLength(1);
    const schemaFile = schemaFiles.at(0);
    if (!schemaFile) throw new Error('Missing primitive response schema');
    const schema = await readFile(
      path.join(workspace, 'model', schemaFile),
      'utf8',
    );
    expect({
      schema,
      parse: client
        .split('\n')
        .filter((line) => line.includes('ReadValue200.parse')),
    }).toMatchSnapshot();
  });

  it('generated fetch rejects invalid scalars and preserves source constraints', async () => {
    const cases: [string, OpenApiSchemaObject, unknown[], unknown[]][] = [
      ['readString', { type: 'string', minLength: 2 }, ['ok'], ['', 1]],
      [
        'readNumber',
        { type: 'number', minimum: 0, maximum: 10 },
        [1.5],
        [-1, 11, '1'],
      ],
      ['readInteger', { type: 'integer' }, [2], [2.5, '2']],
      ['readInt64', { type: 'integer', format: 'int64' }, [42], [42.5, '42']],
      ['readBoolean', { type: 'boolean' }, [true, false], [1, 'true']],
      ['readNullable', { type: ['string', 'null'] }, [null, 'ok'], [1]],
      [
        'readEnum',
        { type: 'string', enum: ['ready', 'done'] },
        ['ready'],
        ['other', 1],
      ],
      [
        'readNullableEnum',
        { type: ['string', 'null'], enum: ['ready', null] },
        [null, 'ready'],
        ['other'],
      ],
      ['readBooleanEnum', { type: 'boolean', enum: [false] }, [false], [true]],
      ['readNumberEnum', { type: 'integer', enum: [1, 2] }, [1], [3]],
    ];
    await generate(
      { client: 'fetch', override: { fetch: { runtimeValidation: true } } },
      scalarSpec(
        Object.fromEntries(cases.map(([name, schema]) => [name, schema])),
      ),
    );
    expect(diagnostics()).toEqual([]);
    const client = await dynamicImport<
      Record<string, () => Promise<{ data: unknown }>>
    >('./client.ts', workspace, false);
    for (const [name, , valid, invalid] of cases) {
      for (const value of valid) {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            new Response(JSON.stringify(value), {
              headers: { 'content-type': 'application/json' },
            }),
          ),
        );
        await expect(client[name]()).resolves.toMatchObject({ data: value });
      }
      for (const value of invalid) {
        vi.stubGlobal(
          'fetch',
          vi.fn().mockResolvedValue(
            new Response(JSON.stringify(value), {
              headers: { 'content-type': 'application/json' },
            }),
          ),
        );
        await expect(client[name]()).rejects.toMatchObject({
          name: 'ZodError',
        });
      }
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('"error body"', {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(client.readInteger()).resolves.toMatchObject({
      status: 400,
      data: 'error body',
    });
  });

  it('rejects a malformed boolean success response', async () => {
    await generate({
      client: 'fetch',
      override: { fetch: { runtimeValidation: true } },
    });
    const client = await dynamicImport<{ readValue: () => Promise<unknown> }>(
      './client.ts',
      workspace,
      false,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('1', {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(client.readValue()).rejects.toMatchObject({
      name: 'ZodError',
    });
  });

  it('retains legacy nullability and the existing numeric Zod int64 mapping', async () => {
    const spec = scalarSpec({
      readValue: { type: 'integer', format: 'int64', nullable: true },
    });
    spec.openapi = '3.0.3';
    await generate(
      {
        client: 'fetch',
        override: { useBigInt: true, fetch: { runtimeValidation: true } },
      },
      spec,
    );
    expect(diagnostics()).toEqual([]);
    const client = await dynamicImport<{ readValue: () => Promise<unknown> }>(
      './client.ts',
      workspace,
      false,
    );
    for (const value of [42, null]) {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(value), {
            headers: { 'content-type': 'application/json' },
          }),
        ),
      );
      await expect(client.readValue()).resolves.toMatchObject({ data: value });
    }
  });

  it('supports consolidated schemas and the both strategy', async () => {
    const client = await generate({
      client: 'fetch',
      schemas: { path: './model', type: 'zod', mode: 'single' },
      override: { fetch: { runtimeValidation: { strategy: 'both' } } },
    });
    const schema = await readFile(
      path.join(workspace, 'model/index.zod.ts'),
      'utf8',
    );
    expect(schema).toContain('export const ReadValue200 = zod.boolean()');
    expect(client).toContain('ReadValue200.safeParse(parsedBody)');
    expect(diagnostics()).toEqual([]);
  });

  it('preserves inline enum routing and direct schema imports', async () => {
    const client = await generate(
      {
        client: 'fetch',
        indexFiles: false,
        schemas: {
          path: './model',
          type: 'zod',
          routes: { default: 'models', enum: 'enums' },
        },
        override: { fetch: { runtimeValidation: true } },
      },
      scalarSpec({ readValue: { type: 'string', enum: ['ready', 'done'] } }),
    );
    const schema = await readFile(
      path.join(workspace, 'model/enums/readValue200.zod.ts'),
      'utf8',
    );
    expect(schema).toContain("zod.enum(['ready', 'done'])");
    expect(client).toContain("from './model/enums/readValue200.zod'");
    expect(client).toContain('ReadValue200.parse(parsedBody)');
    expect(diagnostics()).toEqual([]);
  });

  it.each([3, 4] as const)(
    'uses existing Zod %s integer and nullable rules',
    async (version) => {
      await generate(
        {
          client: 'fetch',
          override: { zod: { version }, fetch: { runtimeValidation: true } },
        },
        scalarSpec({
          readValue: { type: ['integer', 'null'], format: 'int64' },
        }),
      );
      const schemas = await readdir(path.join(workspace, 'model'));
      const file = schemas.find((name) => name.endsWith('.zod.ts'));
      expect(file).toBeDefined();
      if (!file) throw new Error('Missing integer response schema');
      const schema = await readFile(
        path.join(workspace, 'model', file),
        'utf8',
      );
      expect(schema).toContain('nullable()');
      expect(schema).toContain(
        version === 4 ? 'zod.int()' : 'zod.number().int()',
      );
    },
  );

  it('uses Zod Mini schema generation', async () => {
    const client = await generate({
      client: 'fetch',
      override: {
        zod: { variant: 'mini' },
        fetch: { runtimeValidation: true },
      },
    });
    expect(client).toContain('ReadValue200.parse(parsedBody)');
    expect(diagnostics()).toEqual([]);
  });

  it.each([
    { client: 'fetch', override: { fetch: { runtimeValidation: false } } },
    {
      client: 'react-query',
      httpClient: 'fetch',
      override: { query: { runtimeValidation: true } },
    },
    {
      client: 'fetch',
      schemas: { path: './model', type: 'typescript' },
      override: { fetch: { runtimeValidation: true } },
    },
  ] satisfies TestOutputOptions[])(
    'does not enable primitive validation for a disabled or unsupported configuration: %j',
    async (output) => {
      const client = await generate(output);
      expect(client).not.toContain('ReadValue200');
      expect(client).not.toContain('.parse(parsedBody)');
      expect(client).toContain('boolean');
    },
  );

  it('leaves custom mutators unchanged, including includeZodSchemaInArguments', async () => {
    await writeFile(
      path.join(workspace, 'mutator.ts'),
      `
export const request = async <T>(url: string, options: RequestInit): Promise<T> => {
  const response = await fetch(url, options);
  return response.json() as Promise<T>;
};
`,
    );
    const client = await generate({
      client: 'fetch',
      override: {
        mutator: { path: './mutator.ts', name: 'request' },
        includeZodSchemaInArguments: true,
        fetch: { runtimeValidation: true },
      },
    });
    expect(client).not.toContain('ReadValue200');
    expect(client).not.toContain('schema:');
    expect(client).not.toContain('.parse(');
    expect(diagnostics()).toEqual([]);
  });
});
