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
import { describe, expect, it } from 'vitest';

import { generateSolidStart } from './index';

type SolidStartGeneratorOptions = Parameters<typeof generateSolidStart>[1];
type SolidStartGeneratorResult = Awaited<ReturnType<typeof generateSolidStart>>;
type OpenApiParameterLike = OpenApiParameterObject | OpenApiReferenceObject;

function makeOutput(useDates = false): ContextSpec['output'] {
  return {
    target: '',
    namingConvention: NamingConvention.CAMEL_CASE,
    fileExtension: '.ts',
    mode: OutputMode.SINGLE,
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
        schemas: { suffix: '', itemSuffix: '' },
        responses: { suffix: '' },
        parameters: { suffix: '' },
        requestBodies: { suffix: '' },
      },
      hono: { compositeRoute: '', validator: false, validatorOutputPath: '' },
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
        shouldExportQueryKey: false,
        shouldSplitQueryKey: false,
        useOperationIdAsQueryKey: false,
        signal: false,
        version: 5,
      },
      angular: {
        provideIn: 'root',
        client: 'httpClient',
        runtimeValidation: false,
      },
      swr: {},
      zod: {
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
        dateTimeOptions: {},
        timeOptions: { precision: 3 },
      },
      fetch: {
        includeHttpResponseReturnType: false,
        forceSuccessResponse: false,
        runtimeValidation: false,
      },
      useDates,
      enumGenerationType: EnumGeneration.UNION,
      jsDoc: {},
      requestOptions: true,
      splitByContentType: false,
      aliasCombinedTypes: false,
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
    } as GeneratorVerbOptions['override'],
    originalOperation: {} as GeneratorVerbOptions['originalOperation'],
    ...overrides,
  } as GeneratorVerbOptions;
}

function makeOptions(
  context: ContextSpec,
  overrides: Partial<GeneratorOptions> = {},
): SolidStartGeneratorOptions {
  return {
    route: '/pets',
    pathRoute: '/pets',
    override: {} as GeneratorOptions['override'],
    output: '',
    context,
    ...overrides,
  } as SolidStartGeneratorOptions;
}

function makeContextWithPathParams(
  pathParameters: OpenApiParameterLike[] = [],
  operationParameters: OpenApiParameterLike[] = [],
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
          parameters: pathParameters,
          get: { parameters: operationParameters },
        },
      },
    },
    output: makeOutput(useDates),
  };
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

async function generateImplementation(
  verbOptions: GeneratorVerbOptions,
  options: SolidStartGeneratorOptions,
): Promise<SolidStartGeneratorResult['implementation']> {
  const result = await generateSolidStart(
    verbOptions,
    options,
    OutputClient.SOLID_START,
  );

  return result.implementation;
}

describe('generateSolidStart — query string serialization', () => {
  it('uses a simple url template when there are no query params', async () => {
    const verbOptions = makeVerbOptions();
    const options = makeOptions(makeContext());

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const url = `/pets`');
    expect(implementation).not.toContain('URLSearchParams');
  });

  it('uses URLSearchParams without explode logic for non-array params', async () => {
    const parameters = [
      { name: 'limit', in: 'query', schema: { type: 'string' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('new URLSearchParams()');
    // no per-element forEach for a non-array param
    expect(implementation).not.toContain('const explodeParameters');
    // standard scalar append
    expect(implementation).toContain('normalizedParams.append(key');
  });

  it('generates per-element append for an array param with explode:true', async () => {
    const parameters = [
      {
        name: 'country',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('new URLSearchParams()');
    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain(
      'if (Array.isArray(value) && explodeParameters.includes(key))',
    );
    expect(implementation).toContain('value.forEach((v) => {');
    expect(implementation).toContain('normalizedParams.append(key,');
  });

  it('does NOT generate explode logic for an array param with explode:false', async () => {
    const parameters = [
      {
        name: 'country',
        in: 'query',
        explode: false,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
    // still has the regular append (which internally uses Array.isArray for comma-joining)
    expect(implementation).toContain('normalizedParams.append(key');
  });

  it('treats a query array param as exploded when style and explode are both omitted (OpenAPI default)', async () => {
    // Per OpenAPI spec: omitted style defaults to 'form', and 'form' defaults explode to true.
    const parameters = [
      {
        name: 'country',
        in: 'query',
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain('Array.isArray(value)');
  });

  it('handles multiple exploded array params', async () => {
    const parameters = [
      {
        name: 'country',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
      {
        name: 'status',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('"country"');
    expect(implementation).toContain('"status"');
    expect(implementation).toContain('Array.isArray(value)');
  });

  it('handles mixed exploded-array and scalar params', async () => {
    const parameters = [
      {
        name: 'country',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    // explode path for the array param
    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain('Array.isArray(value)');
    // scalar fallback still present (the ternary after the Array.isArray branch)
    expect(implementation).toContain(
      "value === null ? 'null' : value.toString()",
    );
  });

  it('generates per-element append for an array param declared via oneOf', async () => {
    const parameters = [
      {
        name: 'tag',
        in: 'query',
        explode: true,
        schema: {
          oneOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'null' },
          ],
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["tag"]');
    expect(implementation).toContain('Array.isArray(value)');
  });
});

describe('generateSolidStart — path-level parameter merging', () => {
  it('picks up an exploded array param defined at the path-item level', async () => {
    const context = makeContextWithPathParams([
      {
        name: 'country',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ]);
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(context);

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain('Array.isArray(value)');
  });

  it('operation-level parameter overrides path-level one with the same (in, name)', async () => {
    // path-item has explode:true; operation overrides to explode:false — explode logic must be absent
    const context = makeContextWithPathParams(
      [
        {
          name: 'status',
          in: 'query',
          explode: true,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ],
      [
        {
          name: 'status',
          in: 'query',
          explode: false,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ],
    );
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(context);

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
  });

  it('merges path-level and operation-level params without duplicating shared names', async () => {
    // path-item contributes 'country'; operation contributes 'status'; 'country' appears only once
    const context = makeContextWithPathParams(
      [
        {
          name: 'country',
          in: 'query',
          explode: true,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ],
      [
        {
          name: 'status',
          in: 'query',
          explode: true,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ],
    );
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(context);

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('"country"');
    expect(implementation).toContain('"status"');
    // 'country' must not appear twice in the explodeParameters array literal
    expect(implementation.split('"country"').length - 1).toBe(1);
  });
});

describe('generateSolidStart — date-time format on array items (useDates)', () => {
  it('generates toISOString() for an exploded array<date-time> param', async () => {
    const parameters = [
      {
        name: 'dates',
        in: 'query',
        explode: true,
        schema: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, true));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["dates"]');
    expect(implementation).toContain('v instanceof Date ? v.toISOString()');
  });

  it('does NOT generate toISOString() for exploded array<date-time> when useDates is false', async () => {
    const parameters = [
      {
        name: 'dates',
        in: 'query',
        explode: true,
        schema: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, false));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["dates"]');
    expect(implementation).not.toContain('v instanceof Date ? v.toISOString()');
  });

  it('generates toISOString() for a scalar date-time param (existing behaviour unchanged)', async () => {
    const parameters = [
      {
        name: 'since',
        in: 'query',
        schema: { type: 'string', format: 'date-time' },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, true));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain(
      'value instanceof Date ? value.toISOString()',
    );
    expect(implementation).not.toContain('const explodeParameters');
  });

  it('generates toISOString() inside the map callback for a non-exploded array<date-time> param when useDates is true', async () => {
    const parameters = [
      {
        name: 'dates',
        in: 'query',
        explode: false,
        schema: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, true));

    const implementation = await generateImplementation(verbOptions, options);

    // No explode path — array is comma-joined via the normal params implementation
    expect(implementation).not.toContain('const explodeParameters');
    // The map callback must use toISOString() for Date values
    expect(implementation).toContain('v instanceof Date ? v.toISOString()');
  });

  it('does NOT generate toISOString() in the map callback for a non-exploded array<date-time> param when useDates is false', async () => {
    const parameters = [
      {
        name: 'dates',
        in: 'query',
        explode: false,
        schema: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, false));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
    expect(implementation).not.toContain('v instanceof Date ? v.toISOString()');
  });
});
