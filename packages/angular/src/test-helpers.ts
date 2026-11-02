import type {
  GeneratorVerbOptions,
  NormalizedOutputOptions,
  NormalizedRuntimeValidation,
} from '@orval/core';

export interface AngularOverride {
  provideIn: 'root' | 'any' | boolean;
  client: 'httpClient' | 'httpResource' | 'both';
  runtimeValidation: NormalizedRuntimeValidation;
  httpResource?: {
    defaultValue?: unknown;
    debugName?: string;
    injector?: string;
    equal?: string;
  };
  queryObjectSerialization: 'spec' | 'legacy';
  observeOverloads: boolean;
}

export const angularOverride = (
  client: AngularOverride['client'],
  runtimeValidation = true,
  httpResource?: AngularOverride['httpResource'],
): AngularOverride => ({
  provideIn: 'root',
  client,
  runtimeValidation: { enabled: runtimeValidation, strategy: 'throw' },
  queryObjectSerialization: 'spec',
  observeOverloads: true,
  ...(httpResource ? { httpResource } : {}),
});

export const createAngularOutput = (
  overrides: Partial<NormalizedOutputOptions>,
  angular: AngularOverride,
): NormalizedOutputOptions => {
  const output = {
    target: '/tmp/pet.ts',
    schemas: '/tmp/schemas',
    operationSchemas: undefined,
    namingConvention: 'camelCase',
    fileExtension: '.ts',
    schemaFileExtension: '.ts',
    mode: 'single',
    mock: { indexMockFiles: false, inline: false, generators: [] },
    override: {
      operations: {},
      tags: {},
      query: {},
      jsDoc: {},
      header: false,
      hono: {
        handlerGenerationStrategy: 'smart',
        compositeRoute: '',
        validator: true,
        validatorOutputPath: '',
      },
      formData: { disabled: true, arrayHandling: 'serialize' },
      formUrlEncoded: true,
      paramsSerializerOptions: undefined,
      requestOptions: true,
      namingConvention: {},
      components: {
        schemas: {
          prefix: '',
          itemPrefix: '',
          suffix: 'Schema',
          itemSuffix: 'Item',
        },
        responses: { prefix: '', suffix: 'Response' },
        parameters: { prefix: '', suffix: 'Parameters' },
        requestBodies: { prefix: '', suffix: 'Body' },
      },
      angular,
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
          param: true,
          query: true,
          header: true,
          body: true,
          response: true,
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
        generateXor: false,
        exactOptional: false,
        generateCompanionTypes: false,
        dateTimeOptions: {},
        timeOptions: {},
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
          param: true,
          query: true,
          header: true,
          body: true,
          response: true,
        },
        generateEachHttpStatus: false,
        useBrandedTypes: false,
        exactOptional: false,
        version: 'auto',
      },
      valibot: {
        strict: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        generate: {
          param: true,
          query: true,
          header: true,
          body: true,
          response: true,
        },
        exactOptional: false,
      },
      axios: {
        includeHttpResponseReturnType: false,
      },
      fetch: {
        includeHttpResponseReturnType: true,
        forceSuccessResponse: false,
        serializeResponseHeaders: false,
        runtimeValidation: { enabled: false, strategy: 'throw' },
        useRuntimeFetcher: false,
        runtimeImplementationStyle: 'inline',
        runtimeOutputPath: '/test/runtime.ts',
        clientConfigOutputPath: '/test/client-config.ts',
      },
      enumGenerationType: 'const',
      splitByContentType: false,
      aliasCombinedTypes: false,
      includeZodSchemaInArguments: false,
      suppressReadonlyModifier: false,
      mcp: {},
    },
    client: 'angular',
    httpClient: 'angular',
    clean: false,
    docs: false,
    formatter: undefined,
    tsconfig: {},
    packageJson: {},
    headers: false,
    indexFiles: true,
    baseUrl: undefined,
    allParamsOptional: false,
    urlEncodeParameters: false,
    optionsParamRequired: false,
    unionAddMissingProperties: false,
    propertySortOrder: 'Specification',
    tagsSplitDeduplication: false,
    commonTypesFileName: 'common-types',
    factoryMethods: {
      functionNamePrefix: 'create',
      mode: 'single',
      outputDirectory: '',
      includeOptionalProperty: false,
    },
    ...overrides,
  } satisfies NormalizedOutputOptions;

  return output;
};

/**
 * Builds a minimal {@link GeneratorVerbOptions.queryParams} object for use in
 * unit tests. Only the fields required by the Angular generators are populated;
 * everything else can be overridden via the `overrides` argument.
 */
export const createQueryParams = (
  overrides: Partial<NonNullable<GeneratorVerbOptions['queryParams']>> = {},
): NonNullable<GeneratorVerbOptions['queryParams']> => ({
  schema: { name: 'GetPetByIdParams', model: '', imports: [] },
  deps: [],
  isOptional: true,
  originalSchema: { type: 'object' },
  requiredNullableKeys: [],
  ...overrides,
});
