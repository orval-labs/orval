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
              // `key` is required on `ResReqTypesValue` and always set by
              // `getResReqTypes`; the cast below is what let it be omitted.
              key: '200',
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

  it('imports the element schema and zod for an inline array response', async () => {
    const response = makeVerbOptions().response;
    const { implementation, imports } = await generateQuery(
      makeVerbOptions({
        response: {
          ...response,
          definition: { success: 'Pet[]', errors: 'Error' },
          imports: [{ name: 'Pet' }, { name: 'Error' }],
          types: {
            ...response.types,
            success: [
              {
                ...response.types.success[0],
                value: 'Pet[]',
                imports: [{ name: 'Pet' }],
                isRef: false,
                type: 'array',
              },
            ],
          },
        },
      }),
      makeOptions(true),
      'react-query',
    );

    expect(implementation).toContain('schema: zod.array(Pet)');
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'Pet', values: true }),
    );
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'zod', namespaceImport: true }),
    );
    expect(imports).not.toContainEqual(
      expect.objectContaining({ name: 'PetOutput' }),
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

describe('generateQuery — angular-query runtimeValidation of an inline array response', () => {
  const makeVerbOptions = (runtimeValidation: boolean): GeneratorVerbOptions =>
    ({
      verb: 'get',
      route: '/items',
      pathRoute: '/items',
      operationId: 'listItems',
      operationName: 'listItems',
      typeName: 'listItems',
      doc: '',
      tags: [],
      response: {
        definition: { success: 'Item[]', errors: '' },
        imports: [{ name: 'Item' }],
        types: {
          success: [
            {
              key: '200',
              value: 'Item[]',
              contentType: 'application/json',
              hasReadonlyProps: false,
              imports: [{ name: 'Item' }],
              isEnum: false,
              isRef: false,
              schemas: [],
              type: 'array',
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
      override: {
        formData: { disabled: false, arrayHandling: 'serialize' },
        formUrlEncoded: false,
        requestOptions: true,
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
          runtimeValidation: { enabled: false, strategy: 'throw' },
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
          runtimeValidation: { enabled: runtimeValidation, strategy: 'throw' },
        },
      },
      originalOperation: {},
    }) as unknown as GeneratorVerbOptions;

  const options = {
    route: '/items',
    pathRoute: '/items',
    override: { operations: {} },
    output: '',
    context: createTestContextSpec({
      output: {
        client: OutputClient.ANGULAR_QUERY,
        httpClient: OutputHttpClient.ANGULAR,
        schemas: { path: './model', type: 'zod', splitByTags: false },
      },
    }),
  } as unknown as GeneratorOptions;

  it('parses the response through zod.array and imports what that needs', async () => {
    const { implementation, imports } = await generateQuery(
      makeVerbOptions(true),
      options,
      'angular-query',
    );

    expect(implementation).toContain('zod.array(Item).parse(data)');
    expect(implementation).toContain('): Promise<ItemOutput[]> =>');
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'Item', values: true }),
    );
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'ItemOutput' }),
    );
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'zod', namespaceImport: true }),
    );
  });

  it('leaves the response unvalidated when runtimeValidation is off', async () => {
    const { implementation, imports } = await generateQuery(
      makeVerbOptions(false),
      options,
      'angular-query',
    );

    expect(implementation).not.toContain('zod.array(');
    expect(implementation).toContain('): Promise<Item[]> =>');
    expect(imports).not.toContainEqual(
      expect.objectContaining({ name: 'zod' }),
    );
  });
});
