import {
  type ContextSpec,
  EnumGeneration,
  FormDataArrayHandling,
  NamingConvention,
  OutputClient,
  OutputHttpClient,
  OutputMode,
  PropertySortOrder,
} from '../types';

interface CreateTestContextSpecOptions {
  target?: ContextSpec['target'];
  workspace?: ContextSpec['workspace'];
  spec?: Partial<ContextSpec['spec']>;
  output?: Partial<ContextSpec['output']>;
  override?: Partial<ContextSpec['output']['override']>;
}

export function createTestContextSpec({
  target = 'typescript',
  workspace = '',
  spec,
  output,
  override,
}: CreateTestContextSpecOptions = {}): ContextSpec {
  const baseOutput: ContextSpec['output'] = {
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
    propertySortOrder: PropertySortOrder.SPECIFICATION,
    factoryMethods: {
      generate: false,
      functionNamePrefix: 'create',
      mode: 'separate-file',
      outputDirectory: '',
      optionalPropertyStrategy: 'include',
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
        useRuntimeFetcher: false,
      },
      enumGenerationType: EnumGeneration.UNION,
      jsDoc: {},
      requestOptions: true,
      splitByContentType: false,
      aliasCombinedTypes: false,
      mcp: {},
    },
  };

  return {
    target,
    workspace,
    spec: {
      openapi: '3.1.0',
      info: { title: 'Test' },
      paths: {},
      ...spec,
    },
    output: {
      ...baseOutput,
      ...output,
      override: {
        ...baseOutput.override,
        ...output?.override,
        ...override,
      },
    },
  };
}
