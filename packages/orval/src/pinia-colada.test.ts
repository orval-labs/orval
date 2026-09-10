import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils/options';

describe('pinia-colada generation', () => {
  it.each(['fetch', 'axios'] as const)(
    'generates queries and mutations with %s',
    async (httpClient) => {
      const workspace = await mkdtemp(path.join(tmpdir(), 'orval-colada-'));
      try {
        const options = await normalizeOptions(
          {
            input: path.resolve(
              import.meta.dirname,
              '../../../samples/pinia-colada/openapi.json',
            ),
            output: {
              target: './client.ts',
              client: 'pinia-colada',
              httpClient,
            },
          },
          workspace,
        );
        await generateSpec(workspace, options);
        const source = await readFile(
          path.join(workspace, 'client.ts'),
          'utf8',
        );
        expect(source).toContain('getListPetsQueryKey');
        expect(source).toContain('toColadaValue(params)');
        expect(source).toContain('getCreatePetMutationOptions');
        expect(source).toContain('getDeletePetMutationOptions');
        expect(source).toContain('PingMutationVariables = void');
        expect(source).toContain('coladaVariables.petId');
        expect(source).toContain('signal: coladaSignal');
        expect(source).toContain('coladaOptions_');
        expect(source).not.toContain('staleTime: 60_000');
        if (httpClient === 'fetch') expect(source).toContain('!res.ok');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    },
  );
});
