import path from 'node:path';

import {
  type GeneratorOperation,
  NamingConvention,
  type NormalizedOutputOptions,
  OutputClient,
  OutputMockType,
  OutputMode,
  type WriteSpecBuilder,
} from '../types';

// Test fixtures for the split-style writers (writeSplitMode, writeTagsMode,
// writeSplitTagsMode). Construct minimal builder/output objects using `as
// unknown as` casts to avoid hand-typing every field of the large
// NormalizedOutputOptions / WriteSpecBuilder shapes.

export const createSplitModeOperation = (
  overrides: Partial<GeneratorOperation> = {},
): GeneratorOperation => ({
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
});

export const createSplitModeBuilder = (target: string): WriteSpecBuilder =>
  ({
    operations: { listPets: createSplitModeOperation() },
    verbOptions: {},
    schemas: [],
    title: () => ({ implementation: '', implementationMock: '' }),
    header: () => ({ implementation: '', implementationMock: '' }),
    footer: () => ({ implementation: '', implementationMock: '' }),
    imports: () => '',
    importsMock: () => '',
    extraFiles: [],
    info: { title: 'pet-store' },
    target,
    spec: {},
  }) as unknown as WriteSpecBuilder;

export const createSplitModeOutput = (
  target: string,
  overrides: Partial<NormalizedOutputOptions> = {},
): NormalizedOutputOptions =>
  ({
    target,
    fileExtension: '.ts',
    schemaFileExtension: '.ts',
    mode: OutputMode.SPLIT,
    namingConvention: NamingConvention.CAMEL_CASE,
    client: OutputClient.AXIOS,
    httpClient: 'axios',
    schemas: undefined,
    mock: { indexMockFiles: false, generators: [] },
    clean: false,
    docs: false,
    headers: false,
    indexFiles: false,
    allParamsOptional: false,
    urlEncodeParameters: false,
    unionAddMissingProperties: false,
    optionsParamRequired: false,
    propertySortOrder: 'Alphabetical',
    override: {
      tags: {},
      operations: {},
      mutator: undefined,
      paramsSerializerOptions: undefined,
      requestOptions: true,
      header: false,
      formData: { disabled: false, mutator: undefined },
      formUrlEncoded: false,
      components: {
        schemas: { suffix: '', itemSuffix: '' },
        responses: { suffix: '' },
        parameters: { suffix: '' },
        requestBodies: { suffix: '' },
      },
      namingConvention: {},
      hono: {},
      mcp: {},
      query: {},
      angular: { provideIn: false },
      swr: {},
      zod: {},
      fetch: {},
    },
    ...overrides,
  }) as unknown as NormalizedOutputOptions;

export const createSplitModeProps = (target: string) => ({
  builder: createSplitModeBuilder(target),
  workspace: path.dirname(target),
  output: createSplitModeOutput(target),
  projectName: undefined,
  header: '',
});
