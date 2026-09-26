import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

import type {
  MutationInvalidatesConfig,
  OpenApiDocument,
  OrvalReporter,
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

// Regression tests for https://github.com/orval-labs/orval/issues/4166
//
// A `mutationInvalidates` reference that matches no operation is not an error
// anywhere downstream — the rule is simply never applied. Generation has to say
// so, or the configured invalidation is silently missing from the client.

const ok = {
  description: 'ok',
  content: {
    'application/json': {
      schema: { type: 'object' as const, properties: {} },
    },
  },
};

const spec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Notes', version: '1' },
  paths: {
    '/notes': {
      get: { operationId: 'GetNotes', responses: { 200: ok } },
      post: { operationId: 'PostNotes', responses: { 200: ok } },
    },
  },
};

describe('mutationInvalidates operation validation (#4166)', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(
      path.resolve(import.meta.dirname, '../../../tests/.orval-4166-'),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(workspace, { recursive: true, force: true });
  });

  const warningsFrom = async (
    mutationInvalidates: MutationInvalidatesConfig,
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
          client: 'react-query',
          httpClient: 'fetch',
          override: { header: false, query: { mutationInvalidates } },
        },
      },
      workspace,
    );

    await withReporter(reporter, () => generateSpec(workspace, options));

    return (
      warn.mock.calls
        // oxlint-disable-next-line typescript/no-unsafe-member-access
        .map(([event]) => String(event.message))
        .filter((message) => message.includes('mutationInvalidates'))
    );
  };

  // The raw operationId casing never matches the generated `operationName`, so
  // this rule generates nothing at all — which is what the issue reported.
  it('warns that an onMutations operationId does not match the generated name', async () => {
    const warnings = await warningsFrom([
      { onMutations: ['PostNotes'], invalidates: ['GetNotes'] },
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('onMutations');
    expect(warnings[0]).toContain("'PostNotes'");
    expect(warnings[0]).toContain("did you mean 'postNotes'?");
  });

  it('warns for an invalidates target that names no operation', async () => {
    const warnings = await warningsFrom([
      { onMutations: ['postNotes'], invalidates: ['getNote'] },
    ]);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('invalidates');
    expect(warnings[0]).toContain("'getNote'");
  });

  // `invalidates` resolves its target through the query key function name, so
  // the document's own casing is a working reference and must stay silent.
  it('stays silent on a config whose references all resolve', async () => {
    expect(
      await warningsFrom([
        { onMutations: ['postNotes'], invalidates: ['GetNotes'] },
      ]),
    ).toStrictEqual([]);
  });
});
