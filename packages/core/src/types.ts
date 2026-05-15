import type { allLocales } from '@faker-js/faker';
import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import type { TypeDocOptions } from 'typedoc';

export const SupportedFormatter = {
  PRETTIER: 'prettier',
  BIOME: 'biome',
  OXFMT: 'oxfmt',
} as const;

export type SupportedFormatter =
  (typeof SupportedFormatter)[keyof typeof SupportedFormatter];

export interface Options {
  output?: string | OutputOptions;
  input?: string | string[] | InputOptions;
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

export interface NormalizedOutputOptions {
  workspace?: string;
  target: string;
  schemas?: string | SchemaOptions;
  operationSchemas?: string;
  namingConvention: NamingConvention;
  fileExtension: string;
  mode: OutputMode;
  mock?: GlobalMockOptions | ClientMockBuilder;
  override: NormalizedOverrideOutput;
  client: OutputClient | OutputClientFunc;
  httpClient: OutputHttpClient;
  clean: boolean | string[];
  docs: boolean | OutputDocsOptions;
  formatter?: SupportedFormatter;
  tsconfig?: Tsconfig;
  packageJson?: PackageJson;
  headers: boolean;
  indexFiles: boolean;
  baseUrl?: string | BaseUrlFromSpec | BaseUrlFromConstant | BaseUrlRuntime;
  allParamsOptional: boolean;
  urlEncodeParameters: boolean;
  unionAddMissingProperties: boolean;
  optionsParamRequired: boolean;
  propertySortOrder: PropertySortOrder;
}

export interface NormalizedParamsSerializerOptions {
  qs?: Record<string, unknown>;
}

/**
 * Controls how readonly properties are treated when a schema is reused as a request body.
 *
 * Best practice:
 * - `strip` (default): recommended for most OpenAPI specs, because `readOnly`
 *   properties are response-oriented and generally should not constrain request
 *   payload authoring.
 * - `preserve`: use when your schema intentionally models immutable request DTOs
 *   and you want generated request-body types to keep readonly modifiers.
 *
 * Note: this applies to request bodies regardless of the generated client style
 * (`httpClient`, `httpResource`, etc.). `httpResource` still issues request
 * payloads, so the same OpenAPI guidance applies.
 *
 * If we later want a stricter OpenAPI-aligned mode that omits `readOnly`
 * properties from request bodies entirely, that should be introduced as a new
 * explicit mode rather than overloading `preserve`.
 */
export type ReadonlyRequestBodiesMode = 'strip' | 'preserve';

export interface NormalizedOverrideOutput {
  title?: (title: string) => string;
  transformer?: OutputTransformer;
  mutator?: NormalizedMutator;
  operations: Record<string, NormalizedOperationOptions | undefined>;
  tags: Record<string, NormalizedOperationOptions | undefined>;
  mock?: OverrideMockOptions;
  contentType?: OverrideOutputContentType;
  header: false | ((info: OpenApiInfoObject) => string[] | string);
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
  mcp: NormalizedMcpOptions;
  query: NormalizedQueryOptions;
  angular: NormalizedAngularOptions;
  swr: SwrOptions;
  zod: NormalizedZodOptions;
  fetch: NormalizedFetchOptions;
  operationName?: (
    operation: OpenApiOperationObject,
    route: string,
    verb: Verbs,
  ) => string;

  requestOptions: Record<string, unknown> | boolean;
  useDates?: boolean;
  useTypeOverInterfaces?: boolean;
  useDeprecatedOperations?: boolean;
  useBigInt?: boolean;
  useNamedParameters?: boolean;
  enumGenerationType: EnumGeneration;
  suppressReadonlyModifier?: boolean;
  /**
   * Controls how readonly properties are handled for generated request-body types.
   *
   * Prefer `strip` for most OpenAPI specs because `readOnly` fields are
   * response-oriented. Use `preserve` only when your request DTOs are
   * intentionally immutable and should remain readonly in generated types.
   */
  preserveReadonlyRequestBodies?: ReadonlyRequestBodiesMode;
  /**
   * When enabled, operations with multiple request body content-types
   * (e.g. both `multipart/form-data` and `application/json`) will generate
   * separate functions for each content type instead of a single function
   * with a union type parameter.
   *
   * @example
   * // With splitByContentType: true
   * updateProfileWithFormData(body: FormDataType) => { ... }
   * updateProfileWithJson(body: JsonType) => { ... }
   *
   * // With splitByContentType: false (default)
   * updateProfile(body: FormDataType | JsonType) => { ... }
   *
   * @default false
   */
  splitByContentType: boolean;
  jsDoc: NormalizedJsDocOptions;
  aliasCombinedTypes: boolean;
  /**
   * When enabled, optional properties will be typed as `T | null` instead of just `T`.
   * @default false
   */
  useNullForOptional?: boolean;
}

export interface NormalizedMutator {
  path: string;
  name?: string;
  default: boolean;
  alias?: Record<string, string>;
  external?: string[];
  extension?: string;
}

export interface NormalizedOperationOptions {
  transformer?: OutputTransformer;
  mutator?: NormalizedMutator;
  mock?: {
    data?: MockData;
    properties?: MockProperties;
  };
  contentType?: OverrideOutputContentType;
  query?: NormalizedQueryOptions;
  angular?: NormalizedAngularOptions;
  swr?: SwrOptions;
  zod?: NormalizedZodOptions;
  operationName?: (
    operation: OpenApiOperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  fetch?: FetchOptions;
  formData?: NormalizedFormDataType<NormalizedMutator>;
  formUrlEncoded?: boolean | NormalizedMutator;
  paramsSerializer?: NormalizedMutator;
  requestOptions?: object | boolean;
}

export interface NormalizedInputOptions {
  target: string | OpenApiDocument;
  override: OverrideInput;
  unsafeDisableValidation: boolean;
  filters?: InputFiltersOptions;
  parserOptions?: {
    headers?: {
      domains: string[];
      headers: Record<string, string>;
    }[];
  };
}

export type OutputClientFunc = (
  clients: GeneratorClients,
) => ClientGeneratorsBuilder;

export interface BaseUrlFromSpec {
  getBaseUrlFromSpecification: true;
  variables?: Record<string, string>;
  index?: number;
  baseUrl?: never;
}

export interface BaseUrlFromConstant {
  getBaseUrlFromSpecification: false;
  variables?: never;
  index?: never;
  baseUrl: string;
}

/**
 * Embed a runtime JavaScript expression into generated URL template literals
 * (e.g. `process.env.API_BASE_URL`) so the same build can target different hosts at runtime.
 */
export interface BaseUrlRuntime {
  runtime: string;
  /** Named imports for symbols used in `runtime` (e.g. `{ name: 'apiBase', importPath: '../config' }`). */
  imports?: GeneratorImport[];
  getBaseUrlFromSpecification?: never;
  baseUrl?: never;
}

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

export type SchemaGenerationType = 'typescript' | 'zod';

export interface SchemaOptions {
  path: string;
  type: SchemaGenerationType;
}

export interface NormalizedSchemaOptions {
  path: string;
  type: SchemaGenerationType;
}

export interface OutputOptions {
  workspace?: string;
  target: string;
  schemas?: string | SchemaOptions | false;
  /**
   * Separate path for operation-derived types (params, bodies, responses).
   * When set, types matching operation patterns (e.g., *Params, *Body) are written here
   * while regular schema types remain in the `schemas` path.
   */
  operationSchemas?: string;
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
  formatter?: SupportedFormatter;
  tsconfig?: string | Tsconfig;
  packageJson?: string;
  headers?: boolean;
  indexFiles?: boolean;
  baseUrl?: string | BaseUrlFromSpec | BaseUrlFromConstant | BaseUrlRuntime;
  allParamsOptional?: boolean;
  urlEncodeParameters?: boolean;
  unionAddMissingProperties?: boolean;
  optionsParamRequired?: boolean;
  propertySortOrder?: PropertySortOrder;
}

export interface InputFiltersOptions {
  mode?: 'include' | 'exclude';
  tags?: (string | RegExp)[];
  schemas?: (string | RegExp)[];
}

export interface InputOptions {
  target: string | string[] | Record<string, unknown> | OpenApiDocument;
  override?: OverrideInput;
  /**
   * Disable OpenAPI spec validation.
   *
   * **Use at your own risk** — code generation with invalid specs is not guaranteed
   * to work and may break in minor updates. Bug reports with validation disabled are
   * not accepted.
   *
   * @default false
   */
  unsafeDisableValidation?: boolean;
  filters?: InputFiltersOptions;
  parserOptions?: {
    headers?: {
      domains: string[];
      headers: Record<string, string>;
    }[];
  };
}

export const OutputClient = {
  ANGULAR: 'angular',
  ANGULAR_QUERY: 'angular-query',
  AXIOS: 'axios',
  AXIOS_FUNCTIONS: 'axios-functions',
  REACT_QUERY: 'react-query',
  SOLID_START: 'solid-start',
  SOLID_QUERY: 'solid-query',
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
  ANGULAR: 'angular',
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

export type PreferredContentType =
  | 'application/json'
  | 'application/xml'
  | 'text/plain'
  | 'text/html'
  | 'application/octet-stream'
  | (string & {});

export interface GlobalMockOptions {
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
  // Preferred response content type when multiple success content types exist
  preferredContentType?: string;
  indexMockFiles?: boolean;
}

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
  specs: OpenApiDocument,
) => MockPropertiesObject;

export type MockProperties = MockPropertiesObject | MockPropertiesObjectFn;

export type MockDataObject = Record<string, unknown>;

export type MockDataObjectFn = (specs: OpenApiDocument) => MockDataObject;

export type MockDataArray = unknown[];

export type MockDataArrayFn = (specs: OpenApiDocument) => MockDataArray;

export type MockData =
  | MockDataObject
  | MockDataObjectFn
  | MockDataArray
  | MockDataArrayFn;

type OutputTransformerFn = (verb: GeneratorVerbOptions) => GeneratorVerbOptions;

type OutputTransformer = string | OutputTransformerFn;

export interface MutatorObject {
  path: string;
  name?: string;
  default?: boolean;
  alias?: Record<string, string>;
  external?: string[];
  extension?: string;
}

export type Mutator = string | MutatorObject;

export interface ParamsSerializerOptions {
  qs?: Record<string, unknown>;
}

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

export interface OverrideOutput {
  title?: (title: string) => string;
  transformer?: OutputTransformer;
  mutator?: Mutator;
  operations?: Record<string, OperationOptions>;
  tags?: Record<string, OperationOptions>;
  mock?: OverrideMockOptions;
  contentType?: OverrideOutputContentType;
  header?: boolean | ((info: OpenApiInfoObject) => string[] | string);
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
  mcp?: McpOptions;
  query?: QueryOptions;
  swr?: SwrOptions;
  angular?: AngularOptions;
  zod?: ZodOptions;
  operationName?: (
    operation: OpenApiOperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  fetch?: FetchOptions;

  requestOptions?: Record<string, unknown> | boolean;
  useDates?: boolean;
  useTypeOverInterfaces?: boolean;
  useDeprecatedOperations?: boolean;
  useBigInt?: boolean;
  useNamedParameters?: boolean;
  enumGenerationType?: EnumGeneration;
  suppressReadonlyModifier?: boolean;
  /**
   * Controls how readonly properties are handled for generated request-body types.
   *
   * Prefer `strip` for most OpenAPI specs because `readOnly` fields are
   * response-oriented. Use `preserve` only when your request DTOs are
   * intentionally immutable and should remain readonly in generated types.
   */
  preserveReadonlyRequestBodies?: ReadonlyRequestBodiesMode;
  /**
   * When enabled, operations with multiple request body content-types
   * (e.g. both `multipart/form-data` and `application/json`) will generate
   * separate functions for each content type instead of a single function
   * with a union type parameter.
   *
   * @default false
   */
  splitByContentType?: boolean;
  jsDoc?: JsDocOptions;
  aliasCombinedTypes?: boolean;
  /**
   * When enabled, optional properties will be typed as `T | null` instead of just `T`.
   * @default false
   */
  useNullForOptional?: boolean;
}

export interface JsDocOptions {
  filter?: (
    schema: Record<string, unknown>,
  ) => { key: string; value: string }[];
}

export interface NormalizedJsDocOptions {
  filter?: (
    schema: Record<string, unknown>,
  ) => { key: string; value: string }[];
}

export interface OverrideOutputContentType {
  include?: string[];
  exclude?: string[];
}

export interface NormalizedHonoOptions {
  handlers?: string;
  compositeRoute: string;
  validator: boolean | 'hono';
  validatorOutputPath: string;
}

export interface ZodDateTimeOptions {
  offset?: boolean;
  local?: boolean;
  precision?: number;
}

export interface ZodTimeOptions {
  precision?: -1 | 0 | 1 | 2 | 3;
}

export interface ZodOptions {
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
  useBrandedTypes?: boolean;
}

export type ZodCoerceType = 'string' | 'number' | 'boolean' | 'bigint' | 'date';

export interface NormalizedZodOptions {
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
  useBrandedTypes: boolean;
  dateTimeOptions: ZodDateTimeOptions;
  timeOptions: ZodTimeOptions;
}

/**
 * A single parameter value for `mutationInvalidates` params.
 *
 * - `string` – treated as a variable reference, e.g. `"petId"` → `variables.petId`
 * - `{ literal: string }` – emitted as a string literal, e.g. `{ literal: "@me" }` → `"@me"`
 */
export type InvalidateTargetParam = string | { literal: string };

export type InvalidateTarget =
  | string
  | {
      query: string;
      params?: InvalidateTargetParam[] | Record<string, InvalidateTargetParam>;
      invalidateMode?: 'invalidate' | 'reset';
      file?: string;
    };

export interface MutationInvalidatesRule {
  onMutations: string[];
  invalidates: InvalidateTarget[];
}

export type MutationInvalidatesConfig = MutationInvalidatesRule[];

export interface HonoOptions {
  handlers?: string;
  compositeRoute?: string;
  validator?: boolean | 'hono';
  validatorOutputPath?: string;
}

export interface McpServerOptions {
  path: string;
  name?: string;
  default?: boolean;
}

export interface NormalizedMcpServerOptions {
  path: string;
  name?: string;
  default: boolean;
}

export interface McpOptions {
  server?: McpServerOptions;
}

export interface NormalizedMcpOptions {
  server?: NormalizedMcpServerOptions;
}

export interface NormalizedQueryOptions {
  useQuery?: boolean;
  useSuspenseQuery?: boolean;
  useMutation?: boolean;
  useInfinite?: boolean;
  useSuspenseInfiniteQuery?: boolean;
  useInfiniteQueryParam?: string;
  usePrefetch?: boolean;
  useInvalidate?: boolean;
  useSetQueryData?: boolean;
  useGetQueryData?: boolean;

  options?: Record<string, unknown>;
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
  mutationInvalidates?: MutationInvalidatesConfig;
  runtimeValidation?: boolean;
}

export interface QueryOptions {
  useQuery?: boolean;
  useSuspenseQuery?: boolean;
  useMutation?: boolean;
  useInfinite?: boolean;
  useSuspenseInfiniteQuery?: boolean;
  useInfiniteQueryParam?: string;
  usePrefetch?: boolean;
  useInvalidate?: boolean;
  useSetQueryData?: boolean;
  useGetQueryData?: boolean;

  options?: Record<string, unknown>;
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
  mutationInvalidates?: MutationInvalidatesConfig;
  runtimeValidation?: boolean;
}

export interface AngularOptions {
  provideIn?: 'root' | 'any' | boolean;
  /**
   * Preferred name for configuring how retrieval-style operations are emitted.
   *
   * - `httpClient`: keep retrievals as service methods
   * - `httpResource`: emit retrievals as Angular `httpResource` helpers
   * - `both`: emit retrieval helpers and keep service methods where needed
   *
   * Mutation-style operations still use generated `HttpClient` service methods
   * by default unless a per-operation override forces a different behavior.
   */
  retrievalClient?: 'httpClient' | 'httpResource' | 'both';
  /**
   * Backward-compatible alias for `retrievalClient`.
   *
   * Kept for compatibility with existing configs.
   */
  client?: 'httpClient' | 'httpResource' | 'both';
  runtimeValidation?: boolean;
  httpResource?: AngularHttpResourceOptions;
}

export interface NormalizedAngularOptions {
  provideIn: 'root' | 'any' | boolean;
  client: 'httpClient' | 'httpResource' | 'both';
  runtimeValidation: boolean;
  httpResource?: AngularHttpResourceOptions;
}

export interface AngularHttpResourceOptions {
  /**
   * Value to expose while the resource is idle/loading.
   *
   * Serialized as a literal into generated code.
   */
  defaultValue?: unknown;
  /**
   * Debug name shown in Angular DevTools.
   */
  debugName?: string;
  /**
   * Raw code expression for HttpResourceOptions.injector.
   * Example: `inject(Injector)`.
   */
  injector?: string;
  /**
   * Raw code expression for HttpResourceOptions.equal.
   * Example: `(a, b) => a.id === b.id`.
   */
  equal?: string;
}

export interface SwrOptions {
  useInfinite?: boolean;
  useSWRMutationForGet?: boolean;
  useSuspense?: boolean;
  generateErrorTypes?: boolean;
  swrOptions?: unknown;
  swrMutationOptions?: unknown;
  swrInfiniteOptions?: unknown;
}

export interface NormalizedFetchOptions {
  includeHttpResponseReturnType: boolean;
  forceSuccessResponse: boolean;
  jsonReviver?: Mutator;
  runtimeValidation: boolean;
  useRuntimeFetcher: boolean;
}

export interface FetchOptions {
  includeHttpResponseReturnType?: boolean;
  forceSuccessResponse?: boolean;
  jsonReviver?: Mutator;
  runtimeValidation?: boolean;
  useRuntimeFetcher?: boolean;
}

export type InputTransformerFn = (spec: OpenApiDocument) => OpenApiDocument;

type InputTransformer = string | InputTransformerFn;

export interface OverrideInput {
  transformer?: InputTransformer;
}

export interface OperationOptions {
  transformer?: OutputTransformer;
  mutator?: Mutator;
  mock?: {
    data?: MockData;
    properties?: MockProperties;
  };
  query?: QueryOptions;
  angular?: AngularOptions;
  swr?: SwrOptions;
  zod?: ZodOptions;
  operationName?: (
    operation: OpenApiOperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  fetch?: FetchOptions;
  formData?: boolean | Mutator | FormDataType<Mutator>;
  formUrlEncoded?: boolean | Mutator;
  paramsSerializer?: Mutator;
  requestOptions?: object | boolean;
}

export type Hook = 'afterAllFilesWrite';

export type HookFunction<TArgs extends unknown[] = unknown[]> = (
  ...args: TArgs
) => void | Promise<void>;

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

export interface ImportOpenApi {
  spec: OpenApiDocument;
  input: NormalizedInputOptions;
  output: NormalizedOutputOptions;
  target: string;
  workspace: string;
  projectName?: string;
}

export interface ContextSpec {
  projectName?: string;
  target: string;
  workspace: string;
  spec: OpenApiDocument;
  parents?: string[];
  output: NormalizedOutputOptions;
}

export interface GlobalOptions {
  watch?: boolean | string | string[];
  verbose?: boolean;
  clean?: boolean | string[];
  formatter?: SupportedFormatter;
  mock?: boolean | GlobalMockOptions;
  client?: OutputClient;
  httpClient?: OutputHttpClient;
  mode?: OutputMode;
  tsconfig?: string | Tsconfig;
  packageJson?: string;
  input?: string | string[];
  output?: string;
  failOnWarnings?: boolean;
}

export interface Tsconfig {
  baseUrl?: string;
  compilerOptions?: {
    esModuleInterop?: boolean;
    allowSyntheticDefaultImports?: boolean;
    exactOptionalPropertyTypes?: boolean;
    paths?: Record<string, string[]>;
    target?: TsConfigTarget;
    module?: string;
    moduleResolution?: string;
    allowImportingTsExtensions?: boolean;
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
  | 'es2023'
  | 'es2024'
  | 'es2025'
  | 'esnext'; // https://www.typescriptlang.org/tsconfig#target

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
  resolvedVersions?: Record<string, string>;
}

export interface GeneratorSchema {
  name: string;
  model: string;
  imports: GeneratorImport[];
  dependencies?: string[];
  schema?: OpenApiSchemaObject;
}

export interface GeneratorImport {
  readonly name: string;
  readonly schemaName?: string;
  readonly isZodSchema?: boolean;
  readonly isConstant?: boolean;
  readonly alias?: string;
  readonly default?: boolean;
  readonly values?: boolean;
  readonly syntheticDefaultImport?: boolean;
  readonly namespaceImport?: boolean;
  readonly importPath?: string;
}

export interface GeneratorDependency {
  readonly exports: readonly GeneratorImport[];
  readonly dependency: string;
}

export interface GeneratorApiResponse {
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
}

export type GeneratorOperations = Record<string, GeneratorOperation>;

export interface GeneratorTarget {
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
}

export interface GeneratorTargetFull {
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
}

export interface GeneratorOperation {
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
}

export interface GeneratorVerbOptions {
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
  originalOperation: OpenApiOperationObject;
}

export type GeneratorVerbsOptions = GeneratorVerbOptions[];

export interface GeneratorOptions {
  route: string;
  pathRoute: string;
  override: NormalizedOverrideOutput;
  context: ContextSpec;
  mock?: GlobalMockOptions | ClientMockBuilder;
  output: string;
}

export interface GeneratorClient {
  implementation: string;
  imports: GeneratorImport[];
  mutators?: GeneratorMutator[];
  /** When set, overrides the default verbOption.doc prepended to the implementation */
  docComment?: string;
}

export interface GeneratorMutatorParsingInfo {
  numberOfParams: number;
  returnNumberOfParams?: number;
}
export interface GeneratorMutator {
  name: string;
  path: string;
  default: boolean;
  hasErrorType: boolean;
  errorTypeName: string;
  hasSecondArg: boolean;
  hasThirdArg: boolean;
  isHook: boolean;
  bodyTypeName?: string;
}

export type ClientBuilder = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
  outputClient: OutputClient | OutputClientFunc,
  output?: NormalizedOutputOptions,
) => GeneratorClient | Promise<GeneratorClient>;

export interface ClientFileBuilder {
  path: string;
  content: string;
}
export type ClientExtraFilesBuilder = (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
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

export interface ClientMockGeneratorImplementation {
  function: string;
  handlerName: string;
  handler: string;
}

export interface ClientMockGeneratorBuilder {
  imports: GeneratorImport[];
  implementation: ClientMockGeneratorImplementation;
}

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

export interface GetterResponse {
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

  originalSchema?: OpenApiResponsesObject;
}

export interface GetterBody {
  originalSchema: OpenApiReferenceObject | OpenApiRequestBodyObject;
  imports: GeneratorImport[];
  definition: string;
  implementation: string;
  schemas: GeneratorSchema[];
  formData?: string;
  formUrlEncoded?: string;
  contentType: string;
  isOptional: boolean;
}

export interface GetterParameters {
  query: { parameter: OpenApiParameterObject; imports: GeneratorImport[] }[];
  path: { parameter: OpenApiParameterObject; imports: GeneratorImport[] }[];
  header: { parameter: OpenApiParameterObject; imports: GeneratorImport[] }[];
}

export interface GetterParam {
  name: string;
  definition: string;
  implementation: string;
  default: unknown;
  required: boolean;
  imports: GeneratorImport[];
}

export type GetterParams = GetterParam[];
export interface GetterQueryParam {
  schema: GeneratorSchema;
  deps: GeneratorSchema[];
  isOptional: boolean;
  originalSchema?: OpenApiSchemaObject;
  requiredNullableKeys?: string[];
}

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

interface GetterPropBase {
  name: string;
  definition: string;
  implementation: string;
  default: unknown;
  required: boolean;
}

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

export interface ScalarValue {
  value: string;
  useTypeAlias?: boolean;
  isEnum: boolean;
  hasReadonlyProps: boolean;
  type: SchemaType;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  isRef: boolean;
  dependencies: string[];
  example?: unknown;
  examples?: Record<string, unknown> | unknown[];
}

export type ResolverValue = ScalarValue & {
  originalSchema: OpenApiSchemaObject;
};

export type ResReqTypesValue = ScalarValue & {
  formData?: string;
  formUrlEncoded?: string;
  isRef?: boolean;
  hasReadonlyProps?: boolean;
  key: string;
  contentType: string;
  originalSchema?: OpenApiSchemaObject;
};

export interface WriteSpecBuilder {
  operations: GeneratorOperations;
  verbOptions: Record<string, GeneratorVerbOptions>;
  schemas: GeneratorSchema[];
  title: GeneratorClientTitle;
  header: GeneratorClientHeader;
  footer: GeneratorClientFooter;
  imports: GeneratorClientImports;
  importsMock: GenerateMockImports;
  extraFiles: ClientFileBuilder[];
  info: OpenApiInfoObject;
  target: string;
  spec: OpenApiDocument;
}

export interface WriteModeProps {
  builder: WriteSpecBuilder;
  output: NormalizedOutputOptions;
  workspace: string;
  projectName?: string;
  header: string;
  needSchema: boolean;
  generateSchemasInline?: () => string;
}

export interface GeneratorApiOperations {
  verbOptions: Record<string, GeneratorVerbOptions>;
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
}

export interface GeneratorClientExtra {
  implementation: string;
  implementationMock: string;
}

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
  imports: readonly GeneratorDependency[];
  projectName?: string;
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
  imports: readonly GeneratorDependency[];
  projectName?: string;
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

export class ErrorWithTag extends Error {
  tag: string;
  constructor(message: string, tag: string, options?: ErrorOptions) {
    super(message, options);
    this.tag = tag;
  }
}

export type OpenApiSchemaObjectType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'integer'
  | 'null'
  | 'array';

// OpenAPI type aliases. Intended to make it easy to swap to OpenAPI v3.2 in the future
export type OpenApiDocument = OpenAPIV3_1.Document;
export type OpenApiSchemaObject = OpenAPIV3_1.SchemaObject;
export type OpenApiSchemasObject = Record<string, OpenApiSchemaObject>;
export type OpenApiReferenceObject = OpenAPIV3_1.ReferenceObject & {
  // https://github.com/scalar/scalar/issues/7405
  $ref?: string;
};
export type OpenApiComponentsObject = OpenAPIV3_1.ComponentsObject;
export type OpenApiPathsObject = OpenAPIV3_1.PathsObject;
export type OpenApiPathItemObject = OpenAPIV3_1.PathItemObject;
export type OpenApiResponsesObject = OpenAPIV3_1.ResponsesObject;
export type OpenApiResponseObject = OpenAPIV3_1.ResponseObject;
export type OpenApiParameterObject = OpenAPIV3_1.ParameterObject;
export type OpenApiRequestBodyObject = OpenAPIV3_1.RequestBodyObject;
export type OpenApiInfoObject = OpenAPIV3_1.InfoObject;
export type OpenApiExampleObject = OpenAPIV3_1.ExampleObject;
export type OpenApiOperationObject = OpenAPIV3_1.OperationObject;
export type OpenApiMediaTypeObject = OpenAPIV3_1.MediaTypeObject;
export type OpenApiEncodingObject = OpenAPIV3_1.EncodingObject;
export type OpenApiServerObject = OpenAPIV3_1.ServerObject;
