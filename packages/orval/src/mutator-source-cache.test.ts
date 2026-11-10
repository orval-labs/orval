import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { OpenApiDocument } from '@orval/core';
import { describe, expect, it, vi } from 'vite-plus/test';

import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils';

const spec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Mutator cache', version: '1.0.0' },
  paths: Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [
      `/items/${i}`,
      {
        get: {
          operationId: `getItem${i}`,
          responses: { '200': { description: 'OK' } },
        },
      },
    ]),
  ),
};

describe('generateSpec mutator source cache', () => {
  it('reads once per generation and sees a same-size, same-mtime edit with the same options', async () => {
    const workspace = fs.mkdtempSync(
      path.join(os.tmpdir(), 'orval-mutator-generation-'),
    );
    const mutator = path.join(workspace, 'mutator.ts');
    const output = path.join(workspace, 'endpoints.ts');
    const first =
      'export const customInstance = (config: unknown            ) => config;\n';
    const second =
      'export const customInstance = (config: unknown, b: unknown) => config;\n';
    const timestamp = new Date('2026-01-01T00:00:00Z');
    try {
      expect(first.length).toBe(second.length);
      fs.writeFileSync(mutator, first);
      fs.utimesSync(mutator, timestamp, timestamp);
      const before = fs.statSync(mutator);
      const options = await normalizeOptions(
        {
          input: { target: spec },
          output: {
            target: './endpoints.ts',
            client: 'fetch',
            override: { mutator: { path: mutator, name: 'customInstance' } },
          },
        },
        workspace,
      );
      const asyncRead = vi.spyOn(fs.promises, 'readFile');
      const syncRead = vi.spyOn(fs, 'readFileSync');
      const countReads = () => {
        expect(
          asyncRead.mock.calls.filter(([file]) => file === mutator),
        ).toHaveLength(1);
        expect(
          syncRead.mock.calls.filter(([file]) => file === mutator),
        ).toHaveLength(0);
      };
      await generateSpec(workspace, options);
      countReads();
      const original = await fs.promises.readFile(output, 'utf8');
      expect(original).toContain('options?: RequestInit');
      asyncRead.mockClear();
      syncRead.mockClear();
      await generateSpec(workspace, options);
      countReads();
      expect(await fs.promises.readFile(output, 'utf8')).toBe(original);
      fs.writeFileSync(mutator, second);
      fs.utimesSync(mutator, timestamp, timestamp);
      expect(fs.statSync(mutator)).toMatchObject({
        size: before.size,
        mtimeMs: before.mtimeMs,
      });
      asyncRead.mockClear();
      syncRead.mockClear();
      await generateSpec(workspace, options);
      countReads();
      expect(await fs.promises.readFile(output, 'utf8')).toContain(
        'Parameters<typeof customInstance>[1]',
      );
    } finally {
      vi.restoreAllMocks();
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
