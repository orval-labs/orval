import type { GeneratorOperation } from '@orval/core';
import { OutputClient } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import {
  getFactoryClosing,
  getFactoryOpening,
  hoistFactoryOperations,
  isFetchFactoryMode,
  markFactoryOperation,
} from './http-client-injection-factory';

describe('isFetchFactoryMode', () => {
  const output = (client: OutputClient, factory = true) =>
    createTestContextSpec({
      output: {
        client,
        override: {
          fetch: factory ? { httpClientInjection: 'factory' } : {},
        },
      },
    }).output;

  it('is on for the fetch client with httpClientInjection: factory', () => {
    expect(isFetchFactoryMode(output(OutputClient.FETCH))).toBe(true);
  });

  it('is off without the option or for clients built on fetch', () => {
    expect(isFetchFactoryMode(output(OutputClient.FETCH, false))).toBe(false);
    expect(isFetchFactoryMode(output(OutputClient.REACT_QUERY))).toBe(false);
    expect(isFetchFactoryMode(undefined)).toBe(false);
  });
});

describe('hoistFactoryOperations', () => {
  it('keeps unmarked code at module level and moves marked operations into the factory', () => {
    const source =
      'export type aResponse = unknown;\nexport const getAUrl = () => `/a`;\n' +
      markFactoryOperation('const a = () => execute();\n') +
      '\nconst aHelper = 1;\n' +
      'export const getBUrl = () => `/b`;\n' +
      markFactoryOperation('const b = () => execute();\n');

    expect(hoistFactoryOperations(source, 'getPetstore')).toBe(
      'export type aResponse = unknown;\nexport const getAUrl = () => `/a`;\n' +
        '\nconst aHelper = 1;\n' +
        'export const getBUrl = () => `/b`;\n' +
        '\n' +
        getFactoryOpening('getPetstore') +
        'const a = () => execute();\n\nconst b = () => execute();\n',
    );
  });
});

describe('getFactoryClosing', () => {
  it('returns hook names and URL helpers, then emits the response types', () => {
    expect(
      getFactoryClosing({
        operationNames: ['listPets', 'createPets'],
        operations: [
          {
            operationName: 'listPets',
            types: { result: () => 'export type listPetsResponse = unknown;' },
          },
          {
            operationName: 'createPets',
            mutator: { isHook: true },
          },
        ] as GeneratorOperation[],
        isSharedRuntime: false,
      }),
    ).toBe(
      'return { listPets, getListPetsUrl, useCreatePetsHook, getCreatePetsUrl };\n};\n' +
        '\nexport type listPetsResponse = unknown;\n',
    );
  });

  it('keeps hook mutator names plain with the shared runtime', () => {
    expect(
      getFactoryClosing({
        operationNames: ['listPets', 'createPets'],
        operations: [
          { operationName: 'listPets' },
          { operationName: 'createPets', mutator: { isHook: true } },
        ] as GeneratorOperation[],
        isSharedRuntime: true,
      }),
    ).toBe(
      'return { listPets, getListPetsUrl, createPets, getCreatePetsUrl };\n};\n',
    );
  });
});
