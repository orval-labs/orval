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
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils/options';

const spec: OpenApiDocument = {
  openapi: '3.0.3',
  info: { title: 'Models', version: '1' },
  paths: {
    '/first': {
      get: {
        tags: ['first'],
        operationId: 'getFirst',
        responses: {
          201: {
            description: 'Second',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Second' },
              },
            },
          },
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/First' },
              },
            },
          },
        },
      },
    },
    '/second': {
      get: {
        tags: ['second'],
        operationId: 'getSecond',
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Second' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      First: {
        type: 'object',
        description: 'First description',
        required: ['value'],
        properties: { value: { type: 'string' } },
      },
      Second: {
        type: 'object',
        description: 'Second description',
        required: ['value'],
        properties: { value: { type: 'string' } },
      },
      Optional: { type: 'object', properties: { value: { type: 'string' } } },
      Readonly: {
        type: 'object',
        required: ['value'],
        properties: { value: { type: 'string', readOnly: true } },
      },
      Documented: {
        type: 'object',
        required: ['value'],
        properties: {
          value: { type: 'string', description: 'Property documentation' },
        },
      },
      Node: {
        type: 'object',
        properties: { next: { $ref: '#/components/schemas/Node' } },
      },
    },
  },
};

function expectCompiles(paths: string[]) {
  const program = ts.createProgram(paths, {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
  });
  expect(
    ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
  ).toEqual([]);
}

describe('deduplicateModels generated output', () => {
  let workspace: string;
  beforeEach(async () => {
    workspace = await mkdtemp(
      path.resolve(import.meta.dirname, '../../../tests/.orval-deduplicate-'),
    );
  });
  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  async function generate(
    name: string,
    output: Partial<OutputOptions> = {},
    document: OpenApiDocument = spec,
  ) {
    const directory = path.join(workspace, name);
    await mkdir(directory);
    const options = await normalizeOptions(
      {
        input: { target: document },
        output: {
          target: './client.ts',
          client: 'fetch',
          ...output,
          override: {
            header: false,
            useTypeOverInterfaces: true,
            ...output.override,
          },
        },
      },
      directory,
    );
    await generateSpec(directory, options);
    async function files(dir: string): Promise<string[]> {
      const entries = await readdir(dir, { withFileTypes: true });
      return (
        await Promise.all(
          entries.map(async (entry) =>
            entry.isDirectory()
              ? files(path.join(dir, entry.name))
              : entry.name.endsWith('.ts')
                ? [path.join(dir, entry.name)]
                : [],
          ),
        )
      ).flat();
    }
    const paths = await files(directory);
    expectCompiles(paths);
    return Promise.all(
      paths.map(async (file) => ({ file, text: await readFile(file, 'utf8') })),
    );
  }

  it('is opt-in and preserves descriptions and distinct property definitions', async () => {
    const omitted = (await generate('omitted'))[0].text;
    const disabled = (
      await generate('disabled', { override: { deduplicateModels: false } })
    )[0].text;
    expect(disabled).toBe(omitted);
    expect(omitted).not.toMatch(/type Second\s*=\s*First\s*;/);
    const enabled = (
      await generate('enabled', { override: { deduplicateModels: true } })
    )[0].text;
    expect(enabled).toMatch(/First description[\s\S]*type First\s*=\s*\{/);
    expect(enabled).toMatch(
      /Second description[\s\S]*type Second\s*=\s*First\s*;/,
    );
    for (const name of ['Optional', 'Readonly', 'Documented', 'Node']) {
      expect(enabled).toMatch(new RegExp(`type ${name}\\s*=\\s*\\{`));
    }
    expect(enabled).toContain('Property documentation');
  });

  it.each([
    'single',
    'split',
    'tags',
    'tags-split',
    'tags-operations-split',
  ] as const)(
    'emits valid aliases for %s output with a single schemas module',
    async (mode) => {
      const files = await generate(mode, {
        mode,
        schemas: { path: './model', mode: 'single' },
        override: { deduplicateModels: true },
      });
      const model = files.find(({ text }) =>
        /type Second\s*=\s*First\s*;/.test(text),
      );
      expect(model).toBeDefined();
      expect(model?.text).toContain('Second description');
    },
  );

  it.each(['split', 'tags', 'tags-split', 'tags-operations-split'] as const)(
    'deduplicates within the generated %s module',
    async (mode) => {
      const files = await generate(`inline-${mode}`, {
        mode,
        override: { deduplicateModels: true },
      });
      expect(
        files.some(({ text }) => /type Second\s*=\s*First\s*;/.test(text)),
      ).toBe(true);
    },
  );

  it('does not alias across separate model files or generation runs', async () => {
    const separate = await generate('separate', {
      schemas: './model',
      override: { deduplicateModels: true },
    });
    expect(
      separate.every(({ text }) => !/type Second\s*=\s*First\s*;/.test(text)),
    ).toBe(true);
    const next = await generate('next', {
      override: { deduplicateModels: true },
    });
    expect(next[0].text).toMatch(/type First\s*=\s*\{/);
    expect(next[0].text).toMatch(/type Second\s*=\s*First\s*;/);
  });

  it('preserves unique-symbol property identity from custom format types', async () => {
    const schema = {
      type: 'object' as const,
      required: ['brand'],
      properties: {
        brand: { type: 'string' as const, format: 'custom', readOnly: true },
      },
    };
    const files = await generate(
      'nominal',
      {
        override: {
          deduplicateModels: true,
          formatType: { custom: { type: 'unique/**/symbol' } },
        },
      },
      { ...spec, components: { schemas: { First: schema, Second: schema } } },
    );
    const consumer = path.join(workspace, 'nominal/consumer.ts');
    await writeFile(
      consumer,
      `import type { First, Second } from './client';
declare const second: Second;
// @ts-expect-error Each model declares its own unique symbol.
const first: First = second;
`,
    );
    expectCompiles([...files.map(({ file }) => file), consumer]);
  });
});
