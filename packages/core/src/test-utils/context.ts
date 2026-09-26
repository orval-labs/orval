import {
  type ContextSpec,
  type DynamicScopeEntry,
  EnumGeneration,
  FormDataArrayHandling,
  NamingConvention,
  type NormalizedOverrideOutput,
  type OpenApiDocument,
  OutputClient,
  OutputHttpClient,
  OutputMode,
  PropertySortOrder,
} from '../types';

export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends (infer U)[]
    ? DeepPartial<U>[]
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

export type TestOverride = DeepPartial<NormalizedOverrideOutput>;

export interface CreateTestContextSpecOptions {
  target?: ContextSpec['target'];
  workspace?: ContextSpec['workspace'];
  spec?: Partial<OpenApiDocument>;
  output?: Omit<Partial<ContextSpec['output']>, 'mock' | 'override'> & {
    mock?: DeepPartial<ContextSpec['output']['mock']>;
    override?: TestOverride;
  };
  override?: TestOverride;
  dynamicScope?: Partial<Record<string, DynamicScopeEntry>>;
}

const createBaseOverride = (): NormalizedOverrideOutput =>
  ({
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
      useSkipToken: false,
      shouldExportMutatorHooks: false,
      shouldExportHttpClient: false,
      shouldExportKeys: false,
      shouldFilterQueryKey: false,
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
    enumGenerationType: EnumGeneration.UNION,
    jsDoc: {},
    requestOptions: true,
    splitByContentType: false,
    aliasCombinedTypes: false,
    includeZodSchemaInArguments: false,
    mcp: {},
  }) satisfies NormalizedOverrideOutput;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function overlay<T>(base: T, partial: DeepPartial<T> | undefined): T {
  if (partial === undefined) {
    return base;
  }
  if (!isPlainObject(base) || !isPlainObject(partial)) {
    return partial as T;
  }

  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) {
      continue;
    }
    result[key] = overlay(result[key], value as never);
  }
  return result as T;
}

export function mergeTestOverride(
  base: NormalizedOverrideOutput,
  ...partials: (TestOverride | undefined)[]
): NormalizedOverrideOutput {
  let merged = base;
  for (const partial of partials) {
    merged = overlay<NormalizedOverrideOutput>(merged, partial);
  }
  return merged;
}

export function createTestContextSpec({
  target = 'typescript',
  workspace = '',
  spec,
  output,
  override,
  dynamicScope,
}: CreateTestContextSpecOptions = {}): ContextSpec {
  const baseOverride = createBaseOverride();
  const baseOutput = {
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
    propertySortOrder: PropertySortOrder.SPECIFICATION,
    factoryMethods: undefined,
    tagsSplitDeduplication: false,
    commonTypesFileName: 'common-types',
    override: baseOverride,
  } satisfies ContextSpec['output'];

  return {
    target,
    workspace,
    spec: {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
      ...spec,
    } as OpenApiDocument,
    output: {
      ...baseOutput,
      ...output,
      mock: overlay<ContextSpec['output']['mock']>(
        baseOutput.mock,
        output?.mock,
      ),
      override: mergeTestOverride(baseOverride, output?.override, override),
    },
    dynamicScope,
  } satisfies ContextSpec;
}
