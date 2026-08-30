import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiParameterObject,
  OpenApiReferenceObject,
} from '@orval/core';
import {
  EnumGeneration,
  FormDataArrayHandling,
  NamingConvention,
  OutputClient,
  OutputHttpClient,
  OutputMode,
  PropertySortOrder,
  Verbs,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { generateRequestFunction } from './index';

type OpenApiParameterLike = OpenApiParameterObject | OpenApiReferenceObject;

function makeOutput(useDates = false): ContextSpec['output'] {
  return {
    target: '',
    namingConvention: NamingConvention.CAMEL_CASE,
    fileExtension: '.ts',
    schemaFileExtension: '.ts',
    mode: OutputMode.SINGLE,
    mock: { indexMockFiles: false, generators: [] },
    client: OutputClient.FETCH,
    httpClient: OutputHttpClient.FETCH,
    clean: false,
    docs: false,
    formatter: undefined,
    headers: false,
    indexFiles: false,
    allParamsOptional: false,
    urlEncodeParameters: false,
    unionAddMissingProperties: false,
    optionsParamRequired: false,
    propertySortOrder: PropertySortOrder.ALPHABETICAL,
    tagsSplitDeduplication: false,
    commonTypesFileName: 'common-types',
    factoryMethods: {
      functionNamePrefix: 'create',
      mode: 'single',
      outputDirectory: '',
      includeOptionalProperty: false,
    },
    override: {
      title: undefined,
      transformer: undefined,
      mutator: undefined,
      operations: {},
      tags: {},
      mock: undefined,
      contentType: undefined,
      header: false,
      formData: {
        disabled: false,
        arrayHandling: FormDataArrayHandling.SERIALIZE,
      },
      formUrlEncoded: false,
      paramsSerializer: undefined,
      paramsSerializerOptions: undefined,
      namingConvention: {},
      components: {
        schemas: { prefix: '', suffix: '', itemPrefix: '', itemSuffix: '' },
        responses: { prefix: '', suffix: '' },
        parameters: { prefix: '', suffix: '' },
        requestBodies: { prefix: '', suffix: '' },
      },
      hono: {
        handlerGenerationStrategy: 'smart',
        compositeRoute: '',
        validator: false,
        validatorOutputPath: '',
      },
      query: {
        useQuery: false,
        useSuspenseQuery: false,
        useMutation: false,
        useInfinite: false,
        useSuspenseInfiniteQuery: false,
        useInfiniteQueryParam: '',
        usePrefetch: false,
        useInvalidate: false,
        useSetQueryData: false,
        useGetQueryData: false,
        shouldExportMutatorHooks: false,
        shouldExportHttpClient: false,
        shouldExportKeys: false,
        shouldSplitQueryKey: false,
        useOperationIdAsQueryKey: false,
        signal: false,
        version: 5,
      },
      angular: {
        provideIn: 'root',
        client: 'httpClient',
        runtimeValidation: { enabled: false, strategy: 'throw' },
        queryObjectSerialization: 'spec',
      },
      swr: {},
      zod: {
        version: 'auto',
        variant: 'classic',
        strict: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        generate: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        coerce: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        generateEachHttpStatus: false,
        useBrandedTypes: false,
        generateReusableSchemas: false,
        generateMeta: false,
        generateDiscriminatedUnion: false,
        exactOptional: false,
        dateTimeOptions: {},
        timeOptions: { precision: 3 },
      },
      effect: {
        strict: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        generate: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        generateEachHttpStatus: false,
        useBrandedTypes: false,
        exactOptional: false,
      },
      fetch: {
        includeHttpResponseReturnType: false,
        forceSuccessResponse: false,
        serializeResponseHeaders: false,
        runtimeValidation: { enabled: false, strategy: 'throw' },
        useRuntimeFetcher: false,
      },
      useDates,
      enumGenerationType: EnumGeneration.UNION,
      jsDoc: {},
      requestOptions: true,
      splitByContentType: false,
      aliasCombinedTypes: false,
      includeZodSchemaInArguments: false,
      mcp: {},
    },
  };
}

function makeContext(
  parameters: OpenApiParameterLike[] = [],
  useDates = false,
): ContextSpec {
  return {
    target: '',
    workspace: '',
    spec: {
      openapi: '3.1.0',
      info: { title: 'Test' },
      paths: {
        '/pets': {
          get: { parameters },
        },
      },
    },
    output: makeOutput(useDates),
  };
}

function makeVerbOptions(
  overrides: Partial<GeneratorVerbOptions> = {},
): GeneratorVerbOptions {
  return {
    verb: Verbs.GET,
    route: '/pets',
    pathRoute: '/pets',
    operationId: 'listPets',
    operationName: 'listPets',
    doc: '',
    tags: [],
    response: {
      definition: { success: 'Pet[]', errors: '' },
      imports: [],
      types: { success: [], errors: [] },
      contentTypes: ['application/json'],
      schemas: [],
      isBlob: false,
    } as GeneratorVerbOptions['response'],
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
    } as GeneratorVerbOptions['body'],
    params: [],
    props: [],
    override: {
      formData: {
        disabled: false,
        arrayHandling: FormDataArrayHandling.SERIALIZE,
      },
      formUrlEncoded: false,
      requestOptions: false,
      fetch: {
        includeHttpResponseReturnType: false,
        forceSuccessResponse: false,
        runtimeValidation: { enabled: false, strategy: 'throw' },
      },
    } as GeneratorVerbOptions['override'],
    originalOperation: {} as GeneratorVerbOptions['originalOperation'],
    ...overrides,
  } as GeneratorVerbOptions;
}

function makeOptions(
  context: ContextSpec,
  overrides: Partial<GeneratorOptions> = {},
): GeneratorOptions {
  return {
    route: '/pets',
    pathRoute: '/pets',
    override: {} as GeneratorOptions['override'],
    output: '',
    context,
    ...overrides,
  } as GeneratorOptions;
}

const STUB_QUERY_PARAMS: GeneratorVerbOptions['queryParams'] = {
  schema: {
    name: 'ListPetsParams',
    model: 'export type ListPetsParams = { limit?: string }',
    imports: [],
  },
  deps: [],
  isOptional: true,
} as GeneratorVerbOptions['queryParams'];

function generateImplementation(
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): string {
  return generateRequestFunction(verbOptions, options);
}

describe('generateRequestFunction — deepObject query parameters', () => {
  it('generates bracket notation for a style:deepObject query param', () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: {
            call_id: { type: 'string' },
          },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).toContain(
      "typeof value === 'object' && value !== null && !Array.isArray(value) && deepObjectParameters.includes(key)",
    );
    expect(implementation).toContain(
      'Object.entries(value).forEach(([subKey, subValue])',
    );
    expect(implementation).toContain('deepObjectEntries.push(');
    expect(implementation).toContain('encodeURIComponent(key)');
    expect(implementation).toContain('encodeURIComponent(subKey)');
    expect(implementation).toContain(
      "[normalizedParams.toString(), deepObjectEntries.join('&')].filter(Boolean).join('&')",
    );
  });

  it('does NOT decode brackets when there are no deepObject params', () => {
    const parameters = [
      { name: 'limit', in: 'query', schema: { type: 'string' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('deepObjectEntries');
  });

  it('does NOT generate deepObject logic for a plain object param without style:deepObject', () => {
    const parameters = [
      {
        name: 'filter',
        in: 'query',
        schema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('deepObjectParameters');
    expect(implementation).toContain('normalizedParams.append(key');
  });

  it('handles mixed deepObject and scalar params', () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { call_id: { type: 'string' } },
        },
      },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).toContain('deepObjectEntries.push(');
    // scalar fallback still present for `limit`
    expect(implementation).toContain("value === null ? 'null' : String(value)");
  });

  it('handles mixed deepObject and exploded array params', () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { call_id: { type: 'string' } },
        },
      },
      {
        name: 'tags',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["tags"]');
    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    // both explode and deepObject are the only params, so no scalar fallback
    expect(implementation).not.toContain(
      "value === null ? 'null' : String(value)",
    );
  });

  it('omits scalar fallback when all params are deepObject', () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { call_id: { type: 'string' } },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).not.toContain(
      "value === null ? 'null' : String(value)",
    );
  });

  it('generates toISOString() for deepObject properties with date-time format when useDates is true', () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: {
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, true));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).toContain(
      'subValue instanceof Date ? subValue.toISOString()',
    );
  });

  it('does NOT generate toISOString() for deepObject when useDates is false', () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: {
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, false));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).not.toContain(
      'subValue instanceof Date ? subValue.toISOString()',
    );
  });

  it('handles multiple deepObject params', () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { call_id: { type: 'string' } },
        },
      },
      {
        name: 'filter',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { status: { type: 'string' } },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('"scope"');
    expect(implementation).toContain('"filter"');
    expect(implementation).toContain('deepObjectEntries.push(');
  });
});
