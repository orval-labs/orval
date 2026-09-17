import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import { getGeneratorClient } from './client';
import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils/options';

describe('pinia-colada generation', () => {
  it('reuses the same builder instance across operations of the same project', async () => {
    const workspace = await mkdtemp(
      path.join(import.meta.dirname, '.orval-generator-cache-'),
    );
    try {
      const options = await normalizeOptions(
        {
          input: path.resolve(
            import.meta.dirname,
            '../../../samples/pinia-colada/openapi.json',
          ),
          output: { target: './client.ts', client: 'axios' },
        },
        workspace,
      );

      const first = await getGeneratorClient(
        options.output.client,
        options.output,
      );
      const second = await getGeneratorClient(
        options.output.client,
        options.output,
      );

      expect(second).toBe(first);
    } finally {
      await rmdir(workspace);
    }
  });

  it('does not reuse output-specific generators across consecutive outputs', async () => {
    const fetchWorkspace = await mkdtemp(
      path.join(import.meta.dirname, '.orval-colada-fetch-'),
    );
    const axiosWorkspace = await mkdtemp(
      path.join(import.meta.dirname, '.orval-colada-axios-'),
    );
    const resourceWorkspace = await mkdtemp(
      path.join(import.meta.dirname, '.orval-angular-resource-'),
    );
    const clientWorkspace = await mkdtemp(
      path.join(import.meta.dirname, '.orval-angular-client-'),
    );

    try {
      const input = path.resolve(
        import.meta.dirname,
        '../../../samples/pinia-colada/openapi.json',
      );
      const fetchOptions = await normalizeOptions(
        {
          input,
          output: {
            target: './client.ts',
            client: 'pinia-colada',
            httpClient: 'fetch',
          },
        },
        fetchWorkspace,
      );
      const axiosOptions = await normalizeOptions(
        {
          input,
          output: {
            target: './client.ts',
            client: 'pinia-colada',
            httpClient: 'axios',
          },
        },
        axiosWorkspace,
      );

      await generateSpec(fetchWorkspace, fetchOptions);
      await generateSpec(axiosWorkspace, axiosOptions);

      const axiosSource = await readFile(
        path.join(axiosWorkspace, 'client.ts'),
        'utf8',
      );
      expect(axiosSource).toContain("import axios from 'axios'");
      expect(axiosSource).not.toContain('!res.ok');

      const resourceOptions = await normalizeOptions(
        {
          input,
          output: {
            target: './client.ts',
            client: 'angular',
            override: { angular: { client: 'httpResource' } },
          },
        },
        resourceWorkspace,
      );
      const clientOptions = await normalizeOptions(
        {
          input,
          output: { target: './client.ts', client: 'angular' },
        },
        clientWorkspace,
      );

      await generateSpec(resourceWorkspace, resourceOptions);
      await generateSpec(clientWorkspace, clientOptions);

      const clientSource = await readFile(
        path.join(clientWorkspace, 'client.ts'),
        'utf8',
      );
      expect(clientSource).toContain('HttpClient');
      expect(clientSource).not.toContain('httpResource');
    } finally {
      await Promise.all(
        [
          fetchWorkspace,
          axiosWorkspace,
          resourceWorkspace,
          clientWorkspace,
        ].map(async (workspace) => {
          await rm(path.join(workspace, 'client.ts'), { force: true });
          await rmdir(workspace);
        }),
      );
    }
  });

  it('does not restrict the HTTP client of other generators', async () => {
    const workspace = await mkdtemp(
      path.join(import.meta.dirname, '.orval-angular-'),
    );
    try {
      const options = await normalizeOptions(
        {
          input: path.resolve(
            import.meta.dirname,
            '../../../samples/pinia-colada/openapi.json',
          ),
          output: { target: './client.ts', client: 'angular' },
        },
        workspace,
      );
      await generateSpec(workspace, options);
      const source = await readFile(path.join(workspace, 'client.ts'), 'utf8');
      expect(source).toContain('HttpClient');
      expect(source).not.toContain('useColadaQuery');
    } finally {
      await rm(path.join(workspace, 'client.ts'), { force: true });
      await rmdir(workspace);
    }
  });

  it.each(['fetch', 'axios'] as const)(
    'generates queries and mutations with %s',
    async (httpClient) => {
      const workspace = await mkdtemp(
        path.join(import.meta.dirname, '.orval-colada-'),
      );
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
        await rm(path.join(workspace, 'client.ts'), { force: true });
        await rmdir(workspace);
      }
    },
  );
});
