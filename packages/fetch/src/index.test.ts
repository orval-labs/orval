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
    mock: { indexMockFiles: false, inline: false, generators: [] },
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
        generateCompanionTypes: false,
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
      axios: {
        includeHttpResponseReturnType: false,
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

describe('generateRequestFunction — zod runtimeValidation response typing (#3938)', () => {
  const ZOD_RESPONSE = {
    definition: { success: 'Pets', errors: 'Error' },
    imports: [{ name: 'Pets', schemaName: 'Pets', values: true }],
    types: {
      success: [
        {
          key: '200',
          contentType: 'application/json',
          value: 'Pets',
          hasReadonlyProps: false,
          imports: [],
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
  } as unknown as GeneratorVerbOptions['response'];

  function makeZodValidationVerbOptions(
    overrides: Partial<GeneratorVerbOptions> = {},
  ): GeneratorVerbOptions {
    const base = makeVerbOptions({ response: ZOD_RESPONSE });
    return {
      ...base,
      typeName: 'listPets',
      override: {
        ...base.override,
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
          runtimeValidation: { enabled: true, strategy: 'throw' },
        },
      } as GeneratorVerbOptions['override'],
      ...overrides,
    } as GeneratorVerbOptions;
  }

  function makeZodContext(): ContextSpec {
    const context = makeContext();
    (context.output as { schemas: unknown }).schemas = {
      path: './model',
      type: 'zod',
    };
    return context;
  }

  it('declares the parsed response as the zod output alias', () => {
    const implementation = generateRequestFunction(
      makeZodValidationVerbOptions(),
      makeOptions(makeZodContext()),
    );

    expect(implementation).toContain('): Promise<PetsOutput> =>');
    expect(implementation).toContain('Pets.parse(parsedBody)');
    expect(implementation).not.toContain('Promise<Pets>');
  });

  it('uses the output alias for the data field with includeHttpResponseReturnType', () => {
    const verbOptions = makeZodValidationVerbOptions();
    (
      verbOptions.override.fetch as { includeHttpResponseReturnType: boolean }
    ).includeHttpResponseReturnType = true;

    const implementation = generateRequestFunction(
      verbOptions,
      makeOptions(makeZodContext()),
    );

    expect(implementation).toContain('data: PetsOutput');
    expect(implementation).toContain('): Promise<listPetsResponse> =>');
  });

  it('keeps the schema (input) type when a custom mutator owns the request', () => {
    const verbOptions = makeZodValidationVerbOptions({
      mutator: {
        name: 'customFetch',
        path: './mutator.ts',
        default: false,
      } as GeneratorVerbOptions['mutator'],
    });

    const implementation = generateRequestFunction(
      verbOptions,
      makeOptions(makeZodContext()),
    );

    expect(implementation).toContain('): Promise<Pets> =>');
    expect(implementation).not.toContain('PetsOutput');
  });

  it('keeps the Zod schema in the second argument alongside error metadata', () => {
    const operation = makeZodValidationVerbOptions({
      mutator: {
        name: 'customFetch',
        path: './mutator.ts',
        default: false,
        hasSecondArg: true,
        hasThirdArg: true,
      } as GeneratorVerbOptions['mutator'],
    });
    Object.assign(operation.override.fetch, {
      includeHttpResponseReturnType: true,
      forceSuccessResponse: true,
      includeErrorResponseInMutator: true,
    });
    const context = makeZodContext();
    context.output.override.includeZodSchemaInArguments = true;
    const implementation = generateRequestFunction(
      operation,
      makeOptions(context),
    );
    expect(implementation).toMatch(/schema: Pets\s*}\s*,/);
    expect(implementation).toContain(JSON.stringify({ errorResponses: [] }));
  });

  it('keeps the schema (input) type when the schemas output is not zod', () => {
    const implementation = generateRequestFunction(
      makeZodValidationVerbOptions(),
      makeOptions(makeContext()),
    );

    expect(implementation).toContain('): Promise<Pets> =>');
    expect(implementation).not.toContain('PetsOutput');
  });
});

describe('generateRequestFunction — inline array response validation (#4106)', () => {
  // An inline `type: array` response resolves to the definition `Item[]`, which
  // is never an import name, so the exact-name gate skipped validation entirely
  // while a `$ref` to a named array component validated normally.
  function makeArrayResponse(
    definition: string,
    imports: { name: string }[],
  ): GeneratorVerbOptions['response'] {
    return {
      definition: { success: definition, errors: 'Error' },
      imports,
      types: {
        success: [
          {
            key: '200',
            contentType: 'application/json',
            value: definition,
            hasReadonlyProps: false,
            imports: [],
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
    } as unknown as GeneratorVerbOptions['response'];
  }

  function makeArrayVerbOptions(
    definition: string,
    imports: { name: string }[],
  ): GeneratorVerbOptions {
    const base = makeVerbOptions({
      response: makeArrayResponse(definition, imports),
    });
    return {
      ...base,
      typeName: 'listPets',
      override: {
        ...base.override,
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
          runtimeValidation: { enabled: true, strategy: 'throw' },
        },
      } as GeneratorVerbOptions['override'],
    } as GeneratorVerbOptions;
  }

  function makeZodOptions() {
    const context = makeContext();
    (context.output as { schemas: unknown }).schemas = {
      path: './model',
      type: 'zod',
    };
    return makeOptions(context);
  }

  it('validates an inline array through its element schema', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('Pet[]', [{ name: 'Pet' }]),
      makeZodOptions(),
    );

    expect(implementation).toContain('zod.array(Pet).parse(parsedBody)');
    expect(implementation).toContain('): Promise<PetOutput[]> =>');
  });

  it('references the Error schema by its aliased binding', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('Error[]', [{ name: 'Error' }]),
      makeZodOptions(),
    );

    expect(implementation).toContain(
      'zod.array(ErrorSchema).parse(parsedBody)',
    );
  });

  it('leaves a primitive element array unvalidated', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('string[]', [{ name: 'Pet' }]),
      makeZodOptions(),
    );

    expect(implementation).not.toContain('zod.array(');
  });

  it('leaves a nested array unvalidated', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('Pet[][]', [{ name: 'Pet' }]),
      makeZodOptions(),
    );

    expect(implementation).not.toContain('zod.array(');
  });

  it('leaves an array whose element has no schema import unvalidated', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('Pet[]', []),
      makeZodOptions(),
    );

    expect(implementation).not.toContain('zod.array(');
  });
});

describe('generateRequestFunction — response status precedence', () => {
  it('excludes exact responses from matching wildcard responses', () => {
    const response = {
      definition: { success: 'Pet | void', errors: '' },
      imports: [],
      types: {
        success: [
          {
            key: '200',
            contentType: 'application/json',
            value: 'Pet',
          },
          { key: '2XX', contentType: '', value: 'void' },
        ],
        errors: [],
      },
      contentTypes: ['application/json'],
      schemas: [],
      isBlob: false,
    } as unknown as GeneratorVerbOptions['response'];
    const verbOptions = makeVerbOptions({ response });
    (
      verbOptions.override.fetch as { includeHttpResponseReturnType: boolean }
    ).includeHttpResponseReturnType = true;

    const implementation = generateRequestFunction(
      verbOptions,
      makeOptions(makeContext()),
    );

    expect(implementation).toContain('status: Exclude<HTTPStatusCode2xx, 200>');
  });

  // GHSA-rw75-cc5p-q7c9: the key lands in `status: <key>`, an unquoted type
  // position, so a key that closes the object early turns the rest into a
  // top-level statement. A type-stripping build (esbuild, Vite, tsx, swc) then
  // runs it at import time.
  it('refuses a response status key that is not a status code', () => {
    const injected =
      'number }; globalThis.__pwned = 1; type _Ignore = { _z: number';
    const response = {
      definition: { success: 'Pet', errors: '' },
      imports: [],
      types: {
        success: [
          { key: '200', contentType: 'application/json', value: 'Pet' },
          { key: injected, contentType: 'application/json', value: 'Pet' },
        ],
        errors: [],
      },
      contentTypes: ['application/json'],
      schemas: [],
      isBlob: false,
    } as unknown as GeneratorVerbOptions['response'];
    const verbOptions = makeVerbOptions({ response });
    (
      verbOptions.override.fetch as { includeHttpResponseReturnType: boolean }
    ).includeHttpResponseReturnType = true;

    expect(() =>
      generateRequestFunction(verbOptions, makeOptions(makeContext())),
    ).toThrow(/not a status code/);
  });
});

describe('generateRequestFunction — Content-Type header escaping', () => {
  it('escapes single quotes in the request body media type key', () => {
    const verbOptions = makeVerbOptions({
      verb: Verbs.POST,
      body: {
        definition: 'SubmitDataBody',
        implementation: 'submitDataBody: SubmitDataBody',
        imports: [],
        schemas: [],
        formData: undefined,
        formUrlEncoded: undefined,
        contentType: "application/json', 'X-Evil': 'injected",
        isOptional: false,
        originalSchema: {},
        isBlob: false,
      } as GeneratorVerbOptions['body'],
    });

    const implementation = generateImplementation(
      verbOptions,
      makeOptions(makeContext()),
    );

    expect(implementation).toContain(
      String.raw`'Content-Type': 'application/json\', \'X-Evil\': \'injected'`,
    );
    expect(implementation).not.toContain("'X-Evil': 'injected'");
  });
});

describe('generateRequestFunction — getHeaders helper (#4034)', () => {
  const verbOptionsWithHeaders = () =>
    makeVerbOptions({
      verb: Verbs.POST,
      override: { ...makeVerbOptions().override, requestOptions: true },
      body: {
        definition: 'CreatePetBody',
        implementation: 'createPetBody: CreatePetBody',
        imports: [],
        schemas: [],
        formData: undefined,
        formUrlEncoded: undefined,
        contentType: 'application/json',
        isOptional: false,
        originalSchema: {},
        isBlob: false,
      } as GeneratorVerbOptions['body'],
    });

  it('keeps static body headers without referencing disabled request options', () => {
    const verb = verbOptionsWithHeaders();
    verb.override.requestOptions = false;
    const implementation = generateImplementation(
      verb,
      makeOptions(makeContext()),
    );
    expect(implementation).toContain("'Content-Type': 'application/json'");
    expect(implementation).not.toContain('options?.headers');
    expect(implementation).not.toContain('const getHeaders');
  });

  it('narrows on iterability rather than array-ness', () => {
    const implementation = generateImplementation(
      verbOptionsWithHeaders(),
      makeOptions(makeContext()),
    );

    // `RequestInit['headers']` is declared per runtime. Outside the DOM its
    // non-record member need not be an array — `@cloudflare/workers-types`
    // uses `Iterable<Iterable<string>>` — so `Array.isArray` cannot narrow it
    // and the fall-through `return h` failed the declared return type.
    expect(implementation).toContain('if (Symbol.iterator in h)');
    expect(implementation).not.toContain('if (Array.isArray(h))');
  });

  it('materializes each entry before Object.fromEntries', () => {
    const implementation = generateImplementation(
      verbOptionsWithHeaders(),
      makeOptions(makeContext()),
    );

    // `Object.fromEntries` reads `[0]`/`[1]` off each entry rather than
    // iterating it, so a non-indexable entry — `new Set([new Set(['X-Trace',
    // '1'])])` satisfies the declared `Iterable<Iterable<string>>` — produced
    // a single `undefined` key and lost the real header.
    expect(implementation).toContain(
      'Array.from(h as Iterable<Iterable<string>>, (entry) => Array.from(entry) as [string, string])',
    );
    expect(implementation).not.toContain(
      'Object.fromEntries(h as Iterable<readonly [string, string]>)',
    );
  });

  it('still short-circuits empty input and unwraps a Headers instance', () => {
    const implementation = generateImplementation(
      verbOptionsWithHeaders(),
      makeOptions(makeContext()),
    );

    expect(implementation).toContain('if (!h) return {};');
    expect(implementation).toContain(
      'if (h instanceof Headers) return Object.fromEntries(h.entries());',
    );
  });

  it('builds the record branch entry by entry, skipping undefined values', () => {
    const implementation = generateImplementation(
      verbOptionsWithHeaders(),
      makeOptions(makeContext()),
    );

    // A record whose values include `undefined` — Hono's header record, for
    // one — is not assignable to the declared return type, so the result is
    // built rather than passed through (#4029). Names are copied verbatim, so
    // the override semantics of `{ ...literal, ...getHeaders(...) }` still
    // hold, and an `undefined` value is skipped instead of reaching the wire
    // as the literal text "undefined".
    expect(implementation).toContain(
      'const headers: Record<string, string | readonly string[]> = {};',
    );
    expect(implementation).toContain('if (value !== undefined)');
    expect(implementation).toContain('return headers;');
    expect(implementation).not.toContain('    return h;\n');
  });

  it('does not emit the helper when no headers are added', () => {
    const implementation = generateImplementation(
      makeVerbOptions(),
      makeOptions(makeContext()),
    );

    expect(implementation).not.toContain('const getHeaders');
  });
});

describe('includeErrorResponseInMutator', () => {
  function operation(enabled = true) {
    const operation = makeVerbOptions({
      typeName: 'ListPets',
      mutator: {
        name: 'customFetch',
        path: './mutator.ts',
        default: false,
        hasErrorType: true,
        errorTypeName: 'ErrorType',
        hasSecondArg: true,
        hasThirdArg: true,
        isHook: false,
      },
    });
    Object.assign(operation.override.fetch, {
      includeHttpResponseReturnType: true,
      forceSuccessResponse: true,
      includeErrorResponseInMutator: enabled,
    });
    operation.response.originalSchema = {
      200: { description: 'Success', content: { 'application/json': {} } },
      404: {
        description: 'Not found',
        content: { 'application/json': {} },
      },
      422: {
        description: 'Invalid',
        content: { 'application/json': {}, 'text/plain': {} },
      },
    };
    operation.response.types = {
      success: [
        { key: '200', contentType: 'application/json', value: 'Pet[]' },
      ],
      errors: [
        { key: '404', contentType: 'application/json', value: 'NotFound' },
        { key: '422', contentType: 'application/json', value: 'Invalid' },
        { key: '422', contentType: 'text/plain', value: 'string' },
      ],
    } as GeneratorVerbOptions['response']['types'];
    return operation;
  }

  it('passes declared statuses and media types separately from request options', () => {
    const result = generateImplementation(
      operation(),
      makeOptions(makeContext()),
    );
    expect(result).toContain(
      JSON.stringify({
        errorResponses: [
          { status: 404, contentType: 'application/json' },
          { status: 422, contentType: 'application/json' },
          { status: 422, contentType: 'text/plain' },
        ],
      }),
    );
    expect(result).toContain('customFetch<ListPetsResponseSuccess>');
  });

  it('respects the configured media type filter', () => {
    const options = operation();
    options.override.contentType = { include: ['application/json'] };
    options.response.types.errors = options.response.types.errors.filter(
      (entry) => entry.contentType === 'application/json',
    );
    const result = generateImplementation(options, makeOptions(makeContext()));
    expect(result).not.toContain('text/plain');
    expect(result).toContain(
      JSON.stringify({
        errorResponses: [
          { status: 404, contentType: 'application/json' },
          { status: 422, contentType: 'application/json' },
        ],
      }),
    );
  });

  it('keeps the existing call when disabled', () => {
    expect(
      generateImplementation(operation(false), makeOptions(makeContext())),
    ).not.toContain('errorResponses');
  });

  it('passes an empty list when no errors are declared', () => {
    const options = operation();
    options.response.types.errors = [];
    expect(
      generateImplementation(options, makeOptions(makeContext())),
    ).toContain(JSON.stringify({ errorResponses: [] }));
  });

  it.each(['default', '4XX'])('rejects unsupported error status %s', (key) => {
    const options = operation();
    options.response.types.errors[0]!.key = key;
    options.response.originalSchema![key] =
      options.response.originalSchema!['404']!;
    expect(() =>
      generateImplementation(options, makeOptions(makeContext())),
    ).toThrow(/includeErrorResponseInMutator.*explicit/i);
  });

  it.each(['includeHttpResponseReturnType', 'forceSuccessResponse'] as const)(
    'requires %s',
    (key) => {
      const options = operation();
      options.override.fetch[key] = false;
      expect(() =>
        generateImplementation(options, makeOptions(makeContext())),
      ).toThrow(/includeErrorResponseInMutator/);
    },
  );

  it('requires a three-argument non-hook mutator', () => {
    for (const mutator of [
      undefined,
      { ...operation().mutator!, hasThirdArg: false },
      { ...operation().mutator!, isHook: true },
    ]) {
      const options = operation();
      options.mutator = mutator;
      expect(() =>
        generateImplementation(options, makeOptions(makeContext())),
      ).toThrow(/includeErrorResponseInMutator/);
    }
  });
});
