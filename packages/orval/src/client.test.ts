import type {
  ClientFooterBuilder,
  ClientHeaderBuilder,
  NormalizedOutputOptions,
} from '@orval/core';
import { describe, expect, it, vi } from 'vite-plus/test';

import { generateClientFooter, generateClientHeader } from './client';

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

describe('generateClientHeader standard schema helper', () => {
  const output = { override: {} } as NormalizedOutputOptions;

  const header = (
    clientImplementation: string,
    builder: ClientHeaderBuilder = () => '// header\n',
  ) =>
    generateClientHeader({
      outputClient: () => ({
        client: () => ({ implementation: '', imports: [] }),
        header: builder,
      }),
      isRequestOptions: true,
      isGlobalMutator: false,
      isMutator: false,
      provideIn: 'root',
      hasAwaitedType: true,
      titles: { implementation: 'TestSpec', implementationMock: 'getMock' },
      output,
      verbOptions: {},
      clientImplementation,
    });

  it('declares each helper once ahead of the header when an operation calls it', async () => {
    const { implementation } = await header(
      'parseStandardSchema(Pets, parsedBody)',
    );

    expect(
      implementation.match(/function safeParseStandardSchema/g),
    ).toHaveLength(1);
    expect(implementation.match(/function parseStandardSchema/g)).toHaveLength(
      1,
    );
    expect(implementation.endsWith('// header\n')).toBe(true);
  });

  it('finds a call the header itself emitted', async () => {
    const { implementation } = await header(
      '',
      () => 'const x = safeParseStandardSchema(Pets, raw);',
    );

    expect(implementation).toContain('function safeParseStandardSchema');
    expect(implementation).not.toContain('function parseStandardSchema');
  });

  it('leaves the header untouched without a call', async () => {
    const { implementation } = await header('Pets.parse(parsedBody)');

    expect(implementation).toBe('// header\n');
  });
});
