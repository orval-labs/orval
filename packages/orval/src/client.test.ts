import type { ClientFooterBuilder, NormalizedOutputOptions } from '@orval/core';
import { describe, expect, it, vi } from 'vite-plus/test';

import { generateClientFooter } from './client';

describe('generateClientFooter', () => {
  it('passes the documented params object to a custom client footer', async () => {
    const footer = vi.fn<ClientFooterBuilder>(() => '// footer');

    const output = { override: {} } as NormalizedOutputOptions;

    const result = await generateClientFooter({
      outputClient: () => ({
        client: () => ({ implementation: '', imports: [] }),
        footer,
      }),
      operationNames: ['getTest1'],
      operations: [],
      hasMutator: false,
      hasAwaitedType: true,
      titles: { implementation: 'TestSpec', implementationMock: 'getMock' },
      output,
    });

    expect(footer).toHaveBeenCalledTimes(1);
    expect(footer).toHaveBeenCalledWith({
      operationNames: ['getTest1'],
      operations: [],
      title: 'TestSpec',
      hasMutator: false,
      hasAwaitedType: true,
      output,
    });
    expect(result.implementation).toBe('// footer');
  });
});
