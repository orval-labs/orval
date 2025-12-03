import type SwaggerParser from '@apidevtools/swagger-parser';
import type { allLocales } from '@faker-js/faker';
import type { JSONSchema6, JSONSchema7 } from 'json-schema';
import type {
  InfoObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponsesObject,
  SchemaObject,
} from 'openapi3-ts/oas30';
import type { ConvertInputOptions } from 'swagger2openapi';
import type { TypeDocOptions } from 'typedoc';

export interface Options {
  output?: string | OutputOptions;
  input?: string | InputOptions;
  hooks?: Partial<HooksOptions>;
}

export type OptionsFn = () => Options | Promise<Options>;
export type OptionsExport = Options | Promise<Options> | OptionsFn;

export type Config = Record<string, OptionsExport>;
export type ConfigFn = () => Config | Promise<Config>;

export type ConfigExternal = Config | Promise<Config> | ConfigFn;

export type NormalizedConfig = Record<string, NormalizedOptions | undefined>;

export interface NormalizedOptions {
  output: NormalizedOutputOptions;
  input: NormalizedInputOptions;
  hooks: NormalizedHookOptions;
}

export type NormalizedOutputOptions = {
  workspace?: string;
  target: string;
  schemas?: string;
  namingConvention: NamingConvention;
  fileExtension: string;
  mode: OutputMode;
  mock?: GlobalMockOptions | ClientMockBuilder;
  override: NormalizedOverrideOutput;
  client: OutputClient | OutputClientFunc;
  httpClient: OutputHttpClient;
  clean: boolean | string[];
  docs: boolean | OutputDocsOptions;
  prettier: boolean;
  biome: boolean;
  tsconfig?: Tsconfig;
  packageJson?: PackageJson;
  headers: boolean;
  indexFiles: boolean;
  baseUrl?: string | BaseUrlFromSpec | BaseUrlFromConstant;
  allParamsOptional: boolean;
  urlEncodeParameters: boolean;
  unionAddMissingProperties: boolean;
  optionsParamRequired: boolean;
  propertySortOrder: PropertySortOrder;
};

export type NormalizedParamsSerializerOptions = {
  qs?: Record<string, any>;
};

export type NormalizedOverrideOutput = {
  title?: (title: string) => string;
  transformer?: OutputTransformer;
  mutator?: NormalizedMutator;
  operations: Record<string, NormalizedOperationOptions | undefined>;
  tags: Record<string, NormalizedOperationOptions | undefined>;
  mock?: OverrideMockOptions;
  contentType?: OverrideOutputContentType;
  header: false | ((info: InfoObject) => string[] | string);
  formData: NormalizedFormDataType<NormalizedMutator>;
  formUrlEncoded: boolean | NormalizedMutator;
  paramsSerializer?: NormalizedMutator;
  paramsSerializerOptions?: NormalizedParamsSerializerOptions;
  namingConvention: {
    enum?: NamingConvention;
  };
  components: {
    schemas: {
      suffix: string;
      itemSuffix: string;
    };
    responses: {
      suffix: string;
    };
    parameters: {
      suffix: string;
    };
    requestBodies: {
      suffix: string;
    };
  };
  hono: NormalizedHonoOptions;
  query: NormalizedQueryOptions;
  angular: Required<AngularOptions>;
  swr: SwrOptions;
  zod: NormalizedZodOptions;
  mcp: NormalizedMcpOptions;
  fetch: NormalizedFetchOptions;
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  requestOptions: Record<string, any> | boolean;
  useDates?: boolean;
  useTypeOverInterfaces?: boolean;
  useDeprecatedOperations?: boolean;
  useBigInt?: boolean;
  useNamedParameters?: boolean;
  enumGenerationType: EnumGeneration;
  suppressReadonlyModifier?: boolean;
  jsDoc: NormalizedJsDocOptions;
};

export type NormalizedMutator = {
  path: string;
  name?: string;
  default: boolean;
  alias?: Record<string, string>;
  extension?: string;
};

export type NormalizedOperationOptions = {
  transformer?: OutputTransformer;
  mutator?: NormalizedMutator;
  mock?: {
    data?: MockData;
    properties?: MockProperties;
  };
  contentType?: OverrideOutputContentType;
  query?: NormalizedQueryOptions;
  angular?: Required<AngularOptions>;
  swr?: SwrOptions;
  zod?: NormalizedZodOptions;
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  fetch?: FetchOptions;
  formData?: NormalizedFormDataType<NormalizedMutator>;
  formUrlEncoded?: boolean | NormalizedMutator;
  paramsSerializer?: NormalizedMutator;
  requestOptions?: object | boolean;
};

export type NormalizedInputOptions = {
  target: string | Record<string, unknown> | OpenAPIObject;
  validation: boolean | object;
  override: OverrideInput;
  converterOptions: Partial<ConvertInputOptions>;
  parserOptions: SwaggerParserOptions;
  filters?: InputFiltersOption;
};

export type OutputClientFunc = (
  clients: GeneratorClients,
) => ClientGeneratorsBuilder;

export type BaseUrlFromSpec = {
  getBaseUrlFromSpecification: true;
  variables?: Record<string, string>;
  index?: number;
  baseUrl?: never;
};

export type BaseUrlFromConstant = {
  getBaseUrlFromSpecification: false;
  variables?: never;
  index?: never;
  baseUrl: string;
};

export const PropertySortOrder = {
  ALPHABETICAL: 'Alphabetical',
  SPECIFICATION: 'Specification',
} as const;

export type PropertySortOrder =
  (typeof PropertySortOrder)[keyof typeof PropertySortOrder];

export const NamingConvention = {
  CAMEL_CASE: 'camelCase',
  PASCAL_CASE: 'PascalCase',
  SNAKE_CASE: 'snake_case',
  KEBAB_CASE: 'kebab-case',
} as const;

export type NamingConvention =
  (typeof NamingConvention)[keyof typeof NamingConvention];

export const EnumGeneration = {
  CONST: 'const',
  ENUM: 'enum',
  UNION: 'union',
} as const;

export type EnumGeneration =
  (typeof EnumGeneration)[keyof typeof EnumGeneration];

export type OutputOptions = {
  workspace?: string;
  target: string;
  schemas?: string;
  namingConvention?: NamingConvention;
  fileExtension?: string;
  mode?: OutputMode;
  // If mock is a boolean, it will use the default mock options (type: msw)
  mock?: boolean | GlobalMockOptions | ClientMockBuilder;
  override?: OverrideOutput;
  client?: OutputClient | OutputClientFunc;
  httpClient?: OutputHttpClient;
  clean?: boolean | string[];
  docs?: boolean | OutputDocsOptions;
  prettier?: boolean;
  biome?: boolean;
  tsconfig?: string | Tsconfig;
  packageJson?: string;
  headers?: boolean;
  indexFiles?: boolean;
  baseUrl?: string | BaseUrlFromSpec | BaseUrlFromConstant;
  allParamsOptional?: boolean;
  urlEncodeParameters?: boolean;
  unionAddMissingProperties?: boolean;
  optionsParamRequired?: boolean;
  propertySortOrder?: PropertySortOrder;
};

export type SwaggerParserOptions = Omit<SwaggerParser.Options, 'validate'> & {
  validate?: boolean;
};

export type InputFiltersOption = {
  mode?: 'include' | 'exclude';
  tags?: (string | RegExp)[];
  schemas?: (string | RegExp)[];
};

export type InputOptions = {
  target: string | Record<string, unknown> | OpenAPIObject;
  validation?: boolean | object;
  override?: OverrideInput;
  converterOptions?: Partial<ConvertInputOptions>;
  parserOptions?: SwaggerParserOptions;
  filters?: InputFiltersOption;
};

export const OutputClient = {
  ANGULAR: 'angular',
  AXIOS: 'axios',
  AXIOS_FUNCTIONS: 'axios-functions',
  REACT_QUERY: 'react-query',
  SVELTE_QUERY: 'svelte-query',
  VUE_QUERY: 'vue-query',
  SWR: 'swr',
  ZOD: 'zod',
  HONO: 'hono',
  FETCH: 'fetch',
  MCP: 'mcp',
} as const;

export type OutputClient = (typeof OutputClient)[keyof typeof OutputClient];

export const OutputHttpClient = {
  AXIOS: 'axios',
  FETCH: 'fetch',
} as const;

export type OutputHttpClient =
  (typeof OutputHttpClient)[keyof typeof OutputHttpClient];

export const OutputMode = {
  SINGLE: 'single',
  SPLIT: 'split',
  TAGS: 'tags',
  TAGS_SPLIT: 'tags-split',
} as const;

export type OutputMode = (typeof OutputMode)[keyof typeof OutputMode];

export type OutputDocsOptions = {
  configPath?: string;
} & Partial<TypeDocOptions>;

// TODO: add support for other mock types (like cypress or playwright)
export const OutputMockType = {
  MSW: 'msw',
} as const;

export type OutputMockType =
  (typeof OutputMockType)[keyof typeof OutputMockType];

export type GlobalMockOptions = {
  // This is the type of the mock that will be generated
  type: OutputMockType;
  // This is the option to use the examples from the openapi specification where possible to generate mock data
  useExamples?: boolean;
  // This is used to generate mocks for all http responses defined in the OpenAPI specification
  generateEachHttpStatus?: boolean;
  // This is used to set the delay to your own custom value, or pass false to disable delay
  delay?: false | number | (() => number);
  // This is used to execute functions that are passed to the 'delay' argument
  // at runtime rather than build time.
  delayFunctionLazyExecute?: boolean;
  // This is used to set the base url to your own custom value
  baseUrl?: string;
  // This is used to set the locale of the faker library
  locale?: keyof typeof allLocales;
  indexMockFiles?: boolean;
};

export type OverrideMockOptions = Partial<GlobalMockOptions> & {
  arrayMin?: number;
  arrayMax?: number;
  stringMin?: number;
  stringMax?: number;
  numberMin?: number;
  numberMax?: number;
  required?: boolean;
  properties?: MockProperties;
  format?: Record<string, unknown>;
  fractionDigits?: number;
};

export type MockOptions = Omit<OverrideMockOptions, 'properties'> & {
  properties?: Record<string, unknown>;
  operations?: Record<string, { properties: Record<string, unknown> }>;
  tags?: Record<string, { properties: Record<string, unknown> }>;
};

export type MockPropertiesObject = Record<string, unknown>;
export type MockPropertiesObjectFn = (
  specs: OpenAPIObject,
) => MockPropertiesObject;

export type MockProperties = MockPropertiesObject | MockPropertiesObjectFn;

export type MockDataObject = Record<string, unknown>;

export type MockDataObjectFn = (specs: OpenAPIObject) => MockDataObject;

export type MockDataArray = unknown[];

export type MockDataArrayFn = (specs: OpenAPIObject) => MockDataArray;

export type MockData =
  | MockDataObject
  | MockDataObjectFn
  | MockDataArray
  | MockDataArrayFn;

type OutputTransformerFn = (verb: GeneratorVerbOptions) => GeneratorVerbOptions;

type OutputTransformer = string | OutputTransformerFn;

export type MutatorObject = {
  path: string;
  name?: string;
  default?: boolean;
  alias?: Record<string, string>;
  extension?: string;
};

export type Mutator = string | MutatorObject;

export type ParamsSerializerOptions = {
  qs?: Record<string, any>;
};

export const FormDataArrayHandling = {
  SERIALIZE: 'serialize',
  EXPLODE: 'explode',
  SERIALIZE_WITH_BRACKETS: 'serialize-with-brackets',
} as const;

export type FormDataArrayHandling =
  (typeof FormDataArrayHandling)[keyof typeof FormDataArrayHandling];

export type NormalizedFormDataType<TMutator> =
  | {
      disabled: true;
      mutator?: never;
      arrayHandling: FormDataArrayHandling;
    }
  | {
      disabled: false;
      mutator?: TMutator;
      arrayHandling: FormDataArrayHandling;
    };
export type FormDataType<TMutator> =
  | {
      mutator: TMutator;
      arrayHandling?: FormDataArrayHandling;
    }
  | {
      mutator?: TMutator;
      arrayHandling: FormDataArrayHandling;
    };

export type OverrideOutput = {
  title?: (title: string) => string;
  transformer?: OutputTransformer;
  mutator?: Mutator;
  operations?: Record<string, OperationOptions>;
  tags?: Record<string, OperationOptions>;
  mock?: OverrideMockOptions;
  contentType?: OverrideOutputContentType;
  header?: boolean | ((info: InfoObject) => string[] | string);
  formData?: boolean | Mutator | FormDataType<Mutator>;
  formUrlEncoded?: boolean | Mutator;
  paramsSerializer?: Mutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
  namingConvention?: {
    enum?: NamingConvention;
  };
  components?: {
    schemas?: {
      suffix?: string;
      itemSuffix?: string;
    };
    responses?: {
      suffix?: string;
    };
    parameters?: {
      suffix?: string;
    };
    requestBodies?: {
      suffix?: string;
    };
  };
  hono?: HonoOptions;
  query?: QueryOptions;
  swr?: SwrOptions;
  angular?: AngularOptions;
  mcp?: McpOptions;
  zod?: ZodOptions;
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  fetch?: FetchOptions;
  requestOptions?: Record<string, any> | boolean;
  useDates?: boolean;
  useTypeOverInterfaces?: boolean;
  useDeprecatedOperations?: boolean;
  useBigInt?: boolean;
  useNamedParameters?: boolean;
  enumGenerationType?: EnumGeneration;
  suppressReadonlyModifier?: boolean;
  jsDoc?: JsDocOptions;
};

export type JsDocOptions = {
  filter?: (schema: Record<string, any>) => { key: string; value: string }[];
};

export type NormalizedJsDocOptions = {
  filter?: (schema: Record<string, any>) => { key: string; value: string }[];
};

export type OverrideOutputContentType = {
  include?: string[];
  exclude?: string[];
};

export type NormalizedHonoOptions = {
  handlers?: string;
  compositeRoute: string;
  validator: boolean | 'hono';
  validatorOutputPath: string;
};

export type McpOptions = {
  transport?: 'stdio' | 'http';
};

export type ZodDateTimeOptions = {
  offset?: boolean;
  local?: boolean;
  precision?: number;
};

export type ZodTimeOptions = {
  precision?: -1 | 0 | 1 | 2 | 3;
};

export type ZodOptions = {
  strict?: {
    param?: boolean;
    query?: boolean;
    header?: boolean;
    body?: boolean;
    response?: boolean;
  };
  generate?: {
    param?: boolean;
    query?: boolean;
    header?: boolean;
    body?: boolean;
    response?: boolean;
  };
  coerce?: {
    param?: boolean | ZodCoerceType[];
    query?: boolean | ZodCoerceType[];
    header?: boolean | ZodCoerceType[];
    body?: boolean | ZodCoerceType[];
    response?: boolean | ZodCoerceType[];
  };
  preprocess?: {
    param?: Mutator;
    query?: Mutator;
    header?: Mutator;
    body?: Mutator;
    response?: Mutator;
  };
  dateTimeOptions?: ZodDateTimeOptions;
  timeOptions?: ZodTimeOptions;
  generateEachHttpStatus?: boolean;
};

export type ZodCoerceType = 'string' | 'number' | 'boolean' | 'bigint' | 'date';

export type NormalizedZodOptions = {
  strict: {
    param: boolean;
    query: boolean;
    header: boolean;
    body: boolean;
    response: boolean;
  };
  generate: {
    param: boolean;
    query: boolean;
    header: boolean;
    body: boolean;
    response: boolean;
  };
  coerce: {
    param: boolean | ZodCoerceType[];
    query: boolean | ZodCoerceType[];
    header: boolean | ZodCoerceType[];
    body: boolean | ZodCoerceType[];
    response: boolean | ZodCoerceType[];
  };
  preprocess?: {
    param?: NormalizedMutator;
    query?: NormalizedMutator;
    header?: NormalizedMutator;
    body?: NormalizedMutator;
    response?: NormalizedMutator;
  };
  generateEachHttpStatus: boolean;
  dateTimeOptions: ZodDateTimeOptions;
  timeOptions: ZodTimeOptions;
};

export type NormalizedMcpOptions = {
  transport: 'stdio' | 'http';
};

export type HonoOptions = {
  handlers?: string;
  compositeRoute?: string;
  validator?: boolean | 'hono';
  validatorOutputPath?: string;
};

export type NormalizedQueryOptions = {
  useQuery?: boolean;
  useSuspenseQuery?: boolean;
  useMutation?: boolean;
  useInfinite?: boolean;
  useSuspenseInfiniteQuery?: boolean;
  useInfiniteQueryParam?: string;
  usePrefetch?: boolean;
  useInvalidate?: boolean;
  options?: any;
  queryKey?: NormalizedMutator;
  queryOptions?: NormalizedMutator;
  mutationOptions?: NormalizedMutator;
  shouldExportMutatorHooks?: boolean;
  shouldExportHttpClient?: boolean;
  shouldExportQueryKey?: boolean;
  shouldSplitQueryKey?: boolean;
  useOperationIdAsQueryKey?: boolean;
  signal?: boolean;
  version?: 3 | 4 | 5;
};

export type QueryOptions = {
  useQuery?: boolean;
  useSuspenseQuery?: boolean;
  useMutation?: boolean;
  useInfinite?: boolean;
  useSuspenseInfiniteQuery?: boolean;
  useInfiniteQueryParam?: string;
  usePrefetch?: boolean;
  useInvalidate?: boolean;
  options?: any;
  queryKey?: Mutator;
  queryOptions?: Mutator;
  mutationOptions?: Mutator;
  shouldExportMutatorHooks?: boolean;
  shouldExportHttpClient?: boolean;
  shouldExportQueryKey?: boolean;
  shouldSplitQueryKey?: boolean;
  useOperationIdAsQueryKey?: boolean;
  signal?: boolean;
  version?: 3 | 4 | 5;
};

export type AngularOptions = {
  provideIn?: 'root' | 'any' | boolean;
};

export type SwrOptions = {
  useInfinite?: boolean;
  useSWRMutationForGet?: boolean;
  swrOptions?: unknown;
  swrMutationOptions?: unknown;
  swrInfiniteOptions?: unknown;
};

export type NormalizedFetchOptions = {
  includeHttpResponseReturnType: boolean;
  forceSuccessResponse: boolean;
  jsonReviver?: Mutator;
};

export type FetchOptions = {
  includeHttpResponseReturnType?: boolean;
  forceSuccessResponse?: boolean;
  jsonReviver?: Mutator;
};

export type InputTransformerFn = (spec: OpenAPIObject) => OpenAPIObject;

type InputTransformer = string | InputTransformerFn;

export type OverrideInput = {
  transformer?: InputTransformer;
};

export type OperationOptions = {
  transformer?: OutputTransformer;
  mutator?: Mutator;
  mock?: {
    data?: MockData;
    properties?: MockProperties;
  };
  query?: QueryOptions;
  angular?: Required<AngularOptions>;
  swr?: SwrOptions;
  zod?: ZodOptions;
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  fetch?: FetchOptions;
  formData?: boolean | Mutator | FormDataType<Mutator>;
  formUrlEncoded?: boolean | Mutator;
  paramsSerializer?: Mutator;
  requestOptions?: object | boolean;
};

export type Hook = 'afterAllFilesWrite';

export type HookFunction = (...args: any[]) => void | Promise<void>;

export interface HookOption {
  command: string | HookFunction;
  injectGeneratedDirsAndFiles?: boolean;
}

export type HookCommand =
  | string
  | HookFunction
  | HookOption
  | (string | HookFunction | HookOption)[];

export type NormalizedHookCommand = HookCommand[];

export type HooksOptions<T = HookCommand | NormalizedHookCommand> = Partial<
  Record<Hook, T>
>;

export type NormalizedHookOptions = HooksOptions<NormalizedHookCommand>;

export type Verbs = 'post' | 'put' | 'get' | 'patch' | 'delete' | 'head';

export const Verbs = {
  POST: 'post' as Verbs,
  PUT: 'put' as Verbs,
  GET: 'get' as Verbs,
  PATCH: 'patch' as Verbs,
  DELETE: 'delete' as Verbs,
  HEAD: 'head' as Verbs,
};

export type ImportOpenApi = {
  data: JSONSchema6 | JSONSchema7 | Record<string, unknown | OpenAPIObject>;
  input: NormalizedInputOptions;
  output: NormalizedOutputOptions;
  target: string;
  workspace: string;
};

export interface ContextSpecs {
  specKey: string;
  target: string;
  workspace: string;
  specs: Record<string, OpenAPIObject>;
  parents?: string[];
  output: NormalizedOutputOptions;
}

export interface GlobalOptions {
  watch?: boolean | string | string[];
  clean?: boolean | string[];
  prettier?: boolean;
  biome?: boolean;
  mock?: boolean | GlobalMockOptions;
  client?: OutputClient;
  httpClient?: OutputHttpClient;
  mode?: OutputMode;
  tsconfig?: string | Tsconfig;
  packageJson?: string;
  input?: string;
  output?: string;
}

export interface Tsconfig {
  baseUrl?: string;
  compilerOptions?: {
    esModuleInterop?: boolean;
    allowSyntheticDefaultImports?: boolean;
    exactOptionalPropertyTypes?: boolean;
    paths?: Record<string, string[]>;
    target?: TsConfigTarget;
  };
}

export type TsConfigTarget =
  | 'es3'
  | 'es5'
  | 'es6'
  | 'es2015'
  | 'es2016'
  | 'es2017'
  | 'es2018'
  | 'es2019'
  | 'es2020'
  | 'es2021'
  | 'es2022'
  | 'esnext'; // https://www.typescriptlang.org/tsconfig#target

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export type GeneratorSchema = {
  name: string;
  model: string;
  imports: GeneratorImport[];
  dependencies?: string[];
};

export type GeneratorImport = {
  name: string;
  schemaName?: string;
  isConstant?: boolean;
  alias?: string;
  specKey?: string;
  default?: boolean;
  values?: boolean;
  syntheticDefaultImport?: boolean;
  namespaceImport?: boolean;
};

export type GeneratorDependency = {
  exports: GeneratorImport[];
  dependency: string;
};

export type GeneratorApiResponse = {
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
};

export type GeneratorOperations = Record<string, GeneratorOperation>;

export type GeneratorTarget = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMock: string;
  importsMock: GeneratorImport[];
  mutators?: GeneratorMutator[];
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator[];
  formUrlEncoded?: GeneratorMutator[];
  paramsSerializer?: GeneratorMutator[];
  fetchReviver?: GeneratorMutator[];
};

export type GeneratorTargetFull = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMock: {
    function: string;
    handler: string;
    handlerName: string;
  };
  importsMock: GeneratorImport[];
  mutators?: GeneratorMutator[];
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator[];
  formUrlEncoded?: GeneratorMutator[];
  paramsSerializer?: GeneratorMutator[];
  fetchReviver?: GeneratorMutator[];
};

export type GeneratorOperation = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMock: {
    function: string;
    handler: string;
    handlerName: string;
  };
  importsMock: GeneratorImport[];
  tags: string[];
  mutator?: GeneratorMutator;
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator;
  formUrlEncoded?: GeneratorMutator;
  paramsSerializer?: GeneratorMutator;
  fetchReviver?: GeneratorMutator;
  operationName: string;
  types?: {
    result: (title?: string) => string;
  };
};

export type GeneratorVerbOptions = {
  verb: Verbs;
  route: string;
  pathRoute: string;
  summary?: string;
  doc: string;
  tags: string[];
  operationId: string;
  operationName: string;
  response: GetterResponse;
  body: GetterBody;
  headers?: GetterQueryParam;
  queryParams?: GetterQueryParam;
  params: GetterParams;
  props: GetterProps;
  mutator?: GeneratorMutator;
  formData?: GeneratorMutator;
  formUrlEncoded?: GeneratorMutator;
  paramsSerializer?: GeneratorMutator;
  fetchReviver?: GeneratorMutator;
  override: NormalizedOverrideOutput;
  deprecated?: boolean;
  originalOperation: OperationObject;
};

export type GeneratorVerbsOptions = GeneratorVerbOptions[];

export type GeneratorOptions = {
  route: string;
  pathRoute: string;
  override: NormalizedOverrideOutput;
  context: ContextSpecs;
  mock?: GlobalMockOptions | ClientMockBuilder;
  output: string;
};

export type GeneratorClient = {
  implementation: string;
  imports: GeneratorImport[];
  mutators?: GeneratorMutator[];
};

export type GeneratorMutatorParsingInfo = {
  numberOfParams: number;
  returnNumberOfParams?: number;
};
export type GeneratorMutator = {
  name: string;
  path: string;
  default: boolean;
  hasErrorType: boolean;
  errorTypeName: string;
  hasSecondArg: boolean;
  hasThirdArg: boolean;
  isHook: boolean;
  bodyTypeName?: string;
};

export type ClientBuilder = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
  outputClient: OutputClient | OutputClientFunc,
  output?: NormalizedOutputOptions,
) => GeneratorClient | Promise<GeneratorClient>;

export type ClientFileBuilder = {
  path: string;
  content: string;
};
export type ClientExtraFilesBuilder = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpecs,
) => Promise<ClientFileBuilder[]>;

export type ClientHeaderBuilder = (params: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  noFunction?: boolean;
  isGlobalMutator: boolean;
  provideIn: boolean | 'root' | 'any';
  hasAwaitedType: boolean;
  output: NormalizedOutputOptions;
  verbOptions: Record<string, GeneratorVerbOptions>;
  tag?: string;
  clientImplementation: string;
}) => string;

export type ClientFooterBuilder = (params: {
  noFunction?: boolean | undefined;
  operationNames: string[];
  title?: string;
  hasAwaitedType: boolean;
  hasMutator: boolean;
}) => string;

export type ClientTitleBuilder = (title: string) => string;

export type ClientDependenciesBuilder = (
  hasGlobalMutator: boolean,
  hasParamsSerializerOptions: boolean,
  packageJson?: PackageJson,
  httpClient?: OutputHttpClient,
  hasTagsMutator?: boolean,
  override?: NormalizedOverrideOutput,
) => GeneratorDependency[];

export type ClientMockGeneratorImplementation = {
  function: string;
  handlerName: string;
  handler: string;
};

export type ClientMockGeneratorBuilder = {
  imports: GeneratorImport[];
  implementation: ClientMockGeneratorImplementation;
};

export type ClientMockBuilder = (
  verbOptions: GeneratorVerbOptions,
  generatorOptions: GeneratorOptions,
) => ClientMockGeneratorBuilder;

export interface ClientGeneratorsBuilder {
  client: ClientBuilder;
  header?: ClientHeaderBuilder;
  dependencies?: ClientDependenciesBuilder;
  footer?: ClientFooterBuilder;
  title?: ClientTitleBuilder;
  extraFiles?: ClientExtraFilesBuilder;
}

export type GeneratorClients = Record<OutputClient, ClientGeneratorsBuilder>;

export type GetterResponse = {
  imports: GeneratorImport[];
  definition: {
    success: string;
    errors: string;
  };
  isBlob: boolean;
  types: {
    success: ResReqTypesValue[];
    errors: ResReqTypesValue[];
  };
  contentTypes: string[];
  schemas: GeneratorSchema[];

  originalSchema?: ResponsesObject;
};

export type GetterBody = {
  originalSchema: ReferenceObject | RequestBodyObject;
  imports: GeneratorImport[];
  definition: string;
  implementation: string;
  schemas: GeneratorSchema[];
  formData?: string;
  formUrlEncoded?: string;
  contentType: string;
  isOptional: boolean;
};

export type GetterParameters = {
  query: { parameter: ParameterObject; imports: GeneratorImport[] }[];
  path: { parameter: ParameterObject; imports: GeneratorImport[] }[];
  header: { parameter: ParameterObject; imports: GeneratorImport[] }[];
};

export type GetterParam = {
  name: string;
  definition: string;
  implementation: string;
  default: boolean;
  required: boolean;
  imports: GeneratorImport[];
};

export type GetterParams = GetterParam[];
export type GetterQueryParam = {
  schema: GeneratorSchema;
  deps: GeneratorSchema[];
  isOptional: boolean;
  originalSchema?: SchemaObject;
};

export type GetterPropType =
  | 'param'
  | 'body'
  | 'queryParam'
  | 'header'
  | 'namedPathParams';

export const GetterPropType = {
  PARAM: 'param',
  NAMED_PATH_PARAMS: 'namedPathParams',
  BODY: 'body',
  QUERY_PARAM: 'queryParam',
  HEADER: 'header',
} as const;

type GetterPropBase = {
  name: string;
  definition: string;
  implementation: string;
  default: boolean;
  required: boolean;
};

export type GetterProp = GetterPropBase &
  (
    | { type: 'namedPathParams'; destructured: string; schema: GeneratorSchema }
    | { type: Exclude<GetterPropType, 'namedPathParams'> }
  );

export type GetterProps = GetterProp[];

export type SchemaType =
  | 'integer'
  | 'number'
  | 'string'
  | 'boolean'
  | 'object'
  | 'null'
  | 'array'
  | 'enum'
  | 'unknown';

export const SchemaType = {
  integer: 'integer',
  number: 'number',
  string: 'string',
  boolean: 'boolean',
  object: 'object',
  null: 'null',
  array: 'array',
  enum: 'enum',
  unknown: 'unknown',
};

export type ScalarValue = {
  value: string;
  isEnum: boolean;
  hasReadonlyProps: boolean;
  type: SchemaType;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  isRef: boolean;
  dependencies: string[];
  example?: any;
  examples?: Record<string, any>;
};

export type ResolverValue = ScalarValue & {
  originalSchema: SchemaObject;
};

export type ResReqTypesValue = ScalarValue & {
  formData?: string;
  formUrlEncoded?: string;
  isRef?: boolean;
  hasReadonlyProps?: boolean;
  key: string;
  contentType: string;
  originalSchema?: SchemaObject;
};

export type WriteSpecsBuilder = {
  operations: GeneratorOperations;
  schemas: Record<string, GeneratorSchema[]>;
  verbOptions: Record<string, GeneratorVerbOptions>;
  title: GeneratorClientTitle;
  header: GeneratorClientHeader;
  footer: GeneratorClientFooter;
  imports: GeneratorClientImports;
  importsMock: GenerateMockImports;
  extraFiles: ClientFileBuilder[];
  info: InfoObject;
  target: string;
};

export type WriteModeProps = {
  builder: WriteSpecsBuilder;
  output: NormalizedOutputOptions;
  workspace: string;
  specsName: Record<string, string>;
  header: string;
  needSchema: boolean;
};

export type GeneratorApiOperations = {
  verbOptions: Record<string, GeneratorVerbOptions>;
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
};

export type GeneratorClientExtra = {
  implementation: string;
  implementationMock: string;
};

export type GeneratorClientTitle = (data: {
  outputClient?: OutputClient | OutputClientFunc;
  title: string;
  customTitleFunc?: (title: string) => string;
  output: NormalizedOutputOptions;
}) => GeneratorClientExtra;

export type GeneratorClientHeader = (data: {
  outputClient?: OutputClient | OutputClientFunc;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator: boolean;
  provideIn: boolean | 'root' | 'any';
  hasAwaitedType: boolean;
  titles: GeneratorClientExtra;
  output: NormalizedOutputOptions;
  verbOptions: Record<string, GeneratorVerbOptions>;
  tag?: string;
  clientImplementation: string;
}) => GeneratorClientExtra;

export type GeneratorClientFooter = (data: {
  outputClient: OutputClient | OutputClientFunc;
  operationNames: string[];
  hasMutator: boolean;
  hasAwaitedType: boolean;
  titles: GeneratorClientExtra;
  output: NormalizedOutputOptions;
}) => GeneratorClientExtra;

export type GeneratorClientImports = (data: {
  client: OutputClient | OutputClientFunc;
  implementation: string;
  imports: {
    exports: GeneratorImport[];
    dependency: string;
  }[];
  specsName: Record<string, string>;
  hasSchemaDir: boolean;
  isAllowSyntheticDefaultImports: boolean;
  hasGlobalMutator: boolean;
  hasTagsMutator: boolean;
  hasParamsSerializerOptions: boolean;
  packageJson?: PackageJson;
  output: NormalizedOutputOptions;
}) => string;

export type GenerateMockImports = (data: {
  implementation: string;
  imports: {
    exports: GeneratorImport[];
    dependency: string;
  }[];
  specsName: Record<string, string>;
  hasSchemaDir: boolean;
  isAllowSyntheticDefaultImports: boolean;
  options?: GlobalMockOptions;
}) => string;

export type GeneratorApiBuilder = GeneratorApiOperations & {
  title: GeneratorClientTitle;
  header: GeneratorClientHeader;
  footer: GeneratorClientFooter;
  imports: GeneratorClientImports;
  importsMock: GenerateMockImports;
  extraFiles: ClientFileBuilder[];
};

export interface SchemaWithConst extends SchemaObject {
  const: string;
}

export class ErrorWithTag extends Error {
  tag: string;
  constructor(message: string, tag: string, options?: ErrorOptions) {
    super(message, options);
    this.tag = tag;
  }
}
