import type {
  GeneratorOptions,
  GeneratorVerbOptions,
  NormalizedOverrideOutput,
} from '@orval/core';
import { OutputClient, OutputHttpClient } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils/context';
import { builder, generateQuery } from './index';

describe('throws when trying to use named parameters with vue-query client', () => {
  it('vue-query builder type', () => {
    expect(() =>
      builder({ type: 'vue-query' })().client(
        {} as GeneratorVerbOptions,
        {
          override: { useNamedParameters: true } as NormalizedOverrideOutput,
        } as GeneratorOptions,
        'axios',
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686]',
    );
  });
  it('vue-query output client', () => {
    expect(() =>
      builder()().client(
        {} as GeneratorVerbOptions,
        {
          override: { useNamedParameters: true } as NormalizedOverrideOutput,
        } as GeneratorOptions,
        'vue-query',
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686]',
    );
  });
});

describe('generateQuery — includeZodSchemaInArguments with a custom mutator', () => {
  const makeVerbOptions = (
    overrides: Partial<GeneratorVerbOptions> = {},
  ): GeneratorVerbOptions =>
    ({
      verb: 'get',
      route: '/pets',
      pathRoute: '/pets',
      operationId: 'listPets',
      operationName: 'listPets',
      typeName: 'listPets',
      doc: '',
      tags: [],
      response: {
        definition: { success: 'Pets', errors: 'Error' },
        imports: [{ name: 'Pets' }, { name: 'Error' }],
        types: {
          success: [
            {
              value: 'Pets',
              contentType: 'application/json',
              hasReadonlyProps: false,
              imports: [{ name: 'Pets' }],
              isEnum: false,
              isRef: true,
              schemas: [],
              type: 'object',
              dependencies: [],
            },
          ],
          errors: [],
        },
        contentTypes: ['application/json'],
        schemas: [],
        isBlob: false,
      },
      body: {
        definition: '',
        implementation: '',
        imports: [],
        schemas: [],
        formData: undefined,
        formUrlEncoded: undefined,
        contentType: '',
        isOptional: true,
        originalSchema: {},
        isBlob: false,
      },
      params: [],
      props: [],
      mutator: { name: 'customFetch', path: './mutator.ts', default: false },
      override: {
        formData: { disabled: false, arrayHandling: 'serialize' },
        formUrlEncoded: false,
        requestOptions: true,
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
          runtimeValidation: { enabled: true, strategy: 'throw' },
        },
        query: {
          useQuery: true,
          useMutation: false,
          useInfinite: false,
          useSuspenseQuery: false,
          useSuspenseInfiniteQuery: false,
          usePrefetch: false,
          useInvalidate: false,
          shouldExportKeys: true,
          shouldExportHttpClient: true,
          shouldExportMutatorHooks: true,
          signal: false,
          version: 5,
        },
      },
      originalOperation: {},
      ...overrides,
    }) as unknown as GeneratorVerbOptions;

  const makeOptions = (
    includeZodSchemaInArguments: boolean,
  ): GeneratorOptions =>
    ({
      route: '/pets',
      pathRoute: '/pets',
      override: { operations: {} },
      output: '',
      context: createTestContextSpec({
        output: {
          client: OutputClient.REACT_QUERY,
          httpClient: OutputHttpClient.FETCH,
          schemas: { path: './model', type: 'zod', splitByTags: false },
        },
        override: { includeZodSchemaInArguments },
      }),
    }) as unknown as GeneratorOptions;

  it('imports the response schema as a value when it is passed to the mutator', async () => {
    const { implementation, imports } = await generateQuery(
      makeVerbOptions(),
      makeOptions(true),
      'react-query',
    );

    expect(implementation).toContain('schema: Pets');
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'Pets', values: true }),
    );
  });

  it('keeps the schema import type-only when the option is off', async () => {
    const { implementation, imports } = await generateQuery(
      makeVerbOptions(),
      makeOptions(false),
      'react-query',
    );

    expect(implementation).not.toContain('schema: Pets');
    expect(imports).toContainEqual({ name: 'Pets' });
    expect(imports).not.toContainEqual(
      expect.objectContaining({ name: 'Pets', values: true }),
    );
  });
});
