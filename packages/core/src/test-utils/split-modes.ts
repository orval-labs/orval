import path from 'node:path';

import {
  type GeneratorOperation,
  type NormalizedOutputOptions,
  type OpenApiDocument,
  OutputClient,
  OutputMockType,
  OutputMode,
  type WriteSpecBuilder,
} from '../types';
import { createTestContextSpec, mergeTestOverride } from './context';

export const createSplitModeOperation = (
  overrides: Partial<GeneratorOperation> = {},
): GeneratorOperation =>
  ({
    imports: [],
    implementation: '',
    mockOutputs: [
      {
        type: OutputMockType.MSW,
        implementation: {
          function: '',
          handler: '',
          handlerName: 'mockHandler',
        },
        imports: [],
      },
    ],
    tags: ['pets'],
    operationName: 'listPets',
    ...overrides,
  }) satisfies GeneratorOperation;

export const createSplitModeBuilder = (target: string): WriteSpecBuilder =>
  ({
    operations: { listPets: createSplitModeOperation() },
    verbOptions: {},
    schemas: [],
    title: async () => ({ implementation: '', implementationMock: '' }),
    header: async () => ({ implementation: '', implementationMock: '' }),
    footer: async () => ({ implementation: '', implementationMock: '' }),
    imports: async () => '',
    importsMock: () => '',
    extraFiles: [],
    info: { title: 'pet-store', version: '1.0.0' },
    target,
    spec: {
      openapi: '3.1.0',
      info: { title: 'pet-store', version: '1.0.0' },
      paths: {},
    } satisfies OpenApiDocument,
  }) satisfies WriteSpecBuilder;

export const createSplitModeOutput = (
  target: string,
  overrides: Partial<NormalizedOutputOptions> = {},
): NormalizedOutputOptions => {
  const base = createTestContextSpec({
    output: {
      target,
      mode: OutputMode.SPLIT,
      client: OutputClient.AXIOS,
      httpClient: 'axios',
      propertySortOrder: 'Alphabetical',
    },
  }).output;

  return {
    ...base,
    ...overrides,
    override: mergeTestOverride(base.override, overrides.override),
  } satisfies NormalizedOutputOptions;
};

export const createSplitModeProps = (target: string) => ({
  builder: createSplitModeBuilder(target),
  workspace: path.dirname(target),
  output: createSplitModeOutput(target),
  projectName: undefined,
  header: '',
});
