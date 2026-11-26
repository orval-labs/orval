import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import type { OpenApiDocument, OutputOptions } from '@orval/core';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { typeCheck } from '../../core/src/test-utils/typescript';
import { generateContentMapperOutput } from './generate-content-mapper-output';
import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils/options';

const SPEC: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Petstore', version: '1.0.0' },
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        tags: ['pets'],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          {
            name: 'status',
            in: 'query',
            schema: { $ref: '#/components/schemas/PetStatus' },
          },
        ],
        responses: {
          '200': {
            description: 'A list of pets',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Pet' },
                },
              },
            },
          },
        },
      },
      post: {
        operationId: 'createPet',
        tags: ['pets'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NewPet' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' },
              },
            },
          },
        },
      },
    },
    '/owners/{ownerId}': {
      get: {
        operationId: 'showOwner',
        tags: ['owners'],
        parameters: [
          {
            name: 'ownerId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'An owner',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Owner' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      PetStatus: { type: 'string', enum: ['available', 'sold'] },
      NewPet: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          status: { $ref: '#/components/schemas/PetStatus' },
        },
      },
      Pet: {
        allOf: [
          { $ref: '#/components/schemas/NewPet' },
          {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'integer' } },
          },
        ],
      },
      Owner: {
        type: 'object',
        required: ['id', 'pets'],
        properties: {
          id: { type: 'string' },
          pets: { type: 'array', items: { $ref: '#/components/schemas/Pet' } },
        },
      },
    },
  },
};

const SPEC_FILE = 'specs/petstore.openapi.yaml';

/** Matches each specifier imported from, or re-exported from, the spec. */
const SPEC_IMPORT =
  /^(import|export)((?: type)?) [^;]*?from '([^']*petstore\.openapi\.yaml)';$/gm;

describe('output.contentMapper.schemas', () => {
  let workspace: string;
  // Where the spec lies, relative to the workspace.
  let specFile: string;

  const writeSpec = async (file: string) => {
    specFile = file;
    await mkdir(path.dirname(path.join(workspace, file)), { recursive: true });
    // JSON is YAML, so the spec keeps the extension the content mapper serves.
    await writeFile(path.join(workspace, file), JSON.stringify(SPEC));
  };

  beforeEach(async () => {
    // Under `tests/`, so the generated code resolves the client packages.
    workspace = await mkdtemp(
      path.resolve(
        import.meta.dirname,
        '../../../tests/.orval-content-mapper-',
      ),
    );
    await writeSpec(SPEC_FILE);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  const normalize = (output: OutputOptions) =>
    normalizeOptions(
      {
        input: `./${specFile}`,
        output: {
          target: './api/endpoints.ts',
          ...output,
          contentMapper: { schemas: true },
          override: { header: false, ...output.override },
        },
      },
      workspace,
    );

  /** Generates the project and returns its files below `api/`. */
  const generate = async (output: OutputOptions = {}) => {
    await generateSpec(workspace, await normalize(output));
    const names = (
      await readdir(path.join(workspace, 'api'), { recursive: true })
    ).filter((name) => name.endsWith('.ts'));
    return Object.fromEntries(
      await Promise.all(
        names.map(
          async (name) =>
            [
              upathJoin('api', name),
              await readFile(path.join(workspace, 'api', name), 'utf8'),
            ] as const,
        ),
      ),
    );
  };

  /**
   * Type checks the generated files as TypeScript would with the content
   * mapper: the spec module is the content mapper's output, which
   * `allowArbitraryExtensions` reads from `<spec>.d.yaml.ts`.
   */
  const diagnostics = async (
    files: Record<string, string>,
    output: OutputOptions = {},
  ) => {
    await writeFile(
      path.join(workspace, specFile.replace(/\.yaml$/, '.d.yaml.ts')),
      await generateContentMapperOutput(workspace, await normalize(output)),
    );
    return typeCheck(
      Object.fromEntries(Object.keys(files).map((name) => [name, undefined])),
      {
        cwd: workspace,
        compilerOptions: {
          strict: true,
          skipLibCheck: true,
          types: [],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          target: 'ES2022',
          jsx: 'react-jsx',
          allowArbitraryExtensions: true,
          experimentalDecorators: true,
        },
      },
    );
  };

  /** Each file's imports of the spec, resolved against the workspace. */
  const specImports = (files: Record<string, string>) =>
    Object.entries(files).flatMap(([name, content]) =>
      [...content.matchAll(SPEC_IMPORT)].map(
        ([, keyword, type, specifier]) => ({
          file: name,
          statement: `${keyword}${type}`,
          target: upathJoin(path.posix.dirname(name), specifier),
        }),
      ),
    );

  const expectModelsFromSpec = (files: Record<string, string>) => {
    // Model files: a sibling `<target>.schemas.ts` or a `model/` directory.
    expect(
      Object.keys(files).filter((name) =>
        /\.schemas\.ts$|\/model\//.test(name),
      ),
    ).toEqual([]);
    const imports = specImports(files);
    expect(imports.length).toBeGreaterThan(0);
    for (const { statement, target } of imports) {
      expect(statement).toMatch(/^(import|export) type$/);
      expect(target).toBe(specFile);
    }
  };

  it.each<[string, OutputOptions]>([
    ['single', { mode: 'single' }],
    ['split', { mode: 'split' }],
    ['tags', { mode: 'tags' }],
    ['tags-split', { mode: 'tags-split' }],
    ['tags-operations', { mode: 'tags-operations' }],
    ['tags-operations-split', { mode: 'tags-operations-split' }],
  ])('imports the models from the spec in %s mode', async (_mode, output) => {
    const files = await generate({ ...output, client: 'fetch' });

    expectModelsFromSpec(files);
    expect(await diagnostics(files, output)).toEqual([]);
  });

  it.each(['tags-operations', 'tags-operations-split'] as const)(
    'imports the models from each operation file in %s mode',
    async (mode) => {
      // A spec in a directory beside the tag directories must be reached
      // from each operation file, not from a sibling of them.
      await writeSpec('api/tag/petstore.openapi.yaml');
      const output: OutputOptions = { mode, client: 'fetch' };
      const files = await generate(output);

      expectModelsFromSpec(files);
      expect(await diagnostics(files, output)).toEqual([]);
    },
  );

  it('needs the content mapper to resolve the models', async () => {
    const files = await generate({ client: 'fetch' });

    expect(
      typeCheck(
        Object.fromEntries(Object.keys(files).map((name) => [name, undefined])),
        {
          cwd: workspace,
          compilerOptions: {
            strict: true,
            skipLibCheck: true,
            types: [],
            module: 'ESNext',
            moduleResolution: 'Bundler',
            target: 'ES2022',
          },
        },
      ),
    ).toEqual([
      expect.stringContaining(
        "Cannot find module '../specs/petstore.openapi.yaml'",
      ),
    ]);
  });

  it.each<[string, OutputOptions]>([
    [
      'react-query',
      { client: 'react-query', override: { query: { version: 5 } } },
    ],
    ['swr', { client: 'swr' }],
    ['axios', { client: 'axios' }],
    ['angular', { client: 'angular' }],
  ])('typechecks %s output', async (_client, output) => {
    const files = await generate({ mode: 'tags-split', ...output });

    expectModelsFromSpec(files);
    expect(await diagnostics(files, output)).toEqual([]);
  });

  it('imports the models in mock files, also in their own directory', async () => {
    const output: OutputOptions = {
      mode: 'tags-split',
      client: 'fetch',
      mock: { generators: [{ type: 'msw', path: './api/mocks' }] },
    };
    const files = await generate(output);

    expect(
      Object.keys(files).some((name) => name.startsWith('api/mocks/')),
    ).toBe(true);
    expectModelsFromSpec(files);
    expect(await diagnostics(files, output)).toEqual([]);
  });

  it('imports the models in the factories of faker `schemas: true`', async () => {
    const output: OutputOptions = {
      client: 'fetch',
      mock: { generators: [{ type: 'faker', schemas: true }] },
    };
    const files = await generate(output);

    expect(files['api/schemas.faker.ts']).toBeDefined();
    expectModelsFromSpec(
      Object.fromEntries(
        Object.entries(files).filter(
          ([name]) => name !== 'api/schemas.faker.ts',
        ),
      ),
    );
    expect(
      specImports({ 'api/schemas.faker.ts': files['api/schemas.faker.ts'] }),
    ).toEqual([
      {
        file: 'api/schemas.faker.ts',
        statement: 'import type',
        target: SPEC_FILE,
      },
    ]);
    expect(await diagnostics(files, output)).toEqual([]);
  });

  it('imports the models in the operation manifest', async () => {
    const output: OutputOptions = { client: 'fetch', operationManifest: true };
    const files = await generate(output);

    expect(files['api/endpoints.operations.ts']).toBeDefined();
    expectModelsFromSpec(files);
    expect(await diagnostics(files, output)).toEqual([]);
  });

  it('imports the models in Angular resource files', async () => {
    const output: OutputOptions = {
      client: 'angular',
      mode: 'tags-split',
      // `both` writes the resources to `*.resource.ts` files of their own.
      override: { angular: { retrievalClient: 'both' } },
    };
    const files = await generate(output);

    expect(
      Object.keys(files).some((name) => name.endsWith('.resource.ts')),
    ).toBe(true);
    expectModelsFromSpec(files);
    expect(await diagnostics(files, output)).toEqual([]);
  });

  it('imports the models in Hono context files', async () => {
    const files = await generate({ client: 'hono', mode: 'tags-split' });

    expect(
      Object.keys(files).some((name) => name.endsWith('.context.ts')),
    ).toBe(true);
    expectModelsFromSpec(files);
  });

  it('imports the models in MCP files', async () => {
    const output: OutputOptions = { client: 'mcp' };
    const files = await generate(output);

    expectModelsFromSpec(files);
    expect(await diagnostics(files, output)).toEqual([]);
  });

  it('re-exports the models type-only from the workspace barrel, once', async () => {
    const output: OutputOptions = {
      workspace: './api',
      target: './endpoints.ts',
    };
    await generate(output);
    const files = await generate(output);

    expect(
      files['api/index.ts']
        .split('\n')
        .filter((line) => line.includes('petstore.openapi.yaml')),
    ).toEqual(["export type * from '../specs/petstore.openapi.yaml';"]);
  });

  it('rewrites an earlier runtime re-export of the spec as type-only', async () => {
    await mkdir(path.join(workspace, 'api'));
    await writeFile(
      path.join(workspace, 'api/index.ts'),
      "export * from '../specs/petstore.openapi.yaml';\n",
    );
    const files = await generate({
      workspace: './api',
      target: './endpoints.ts',
    });

    expect(
      files['api/index.ts']
        .split('\n')
        .filter((line) => line.includes('petstore.openapi.yaml')),
    ).toEqual(["export type * from '../specs/petstore.openapi.yaml';"]);
  });
});

/** `path.posix.join` that keeps the result relative to the workspace. */
function upathJoin(...segments: string[]): string {
  return path.posix.normalize(
    path.posix.join(
      ...segments.map((segment) => segment.split(path.sep).join('/')),
    ),
  );
}
