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
  schemas?: string | NormalizedSchemaOptions;
  operationSchemas?: string;
  namingConvention: NamingConvention;
  fileExtension: string;
  /**
   * File extension for schema artifacts (TS types or Zod schemas) under
   * `schemas:`. Defaults to `.zod.ts` when the output is Zod schemas
   * (`schemas: { type: 'zod' }` or `client: 'zod'` + `generateReusableSchemas`),
   * otherwise `.ts`. A user-set `output.fileExtension` always wins.
   */
  schemaFileExtension: string;
  mode: OutputMode;
  // Always normalized to an object form; an empty `generators` array means
  // no mocks are emitted.
  mock: NormalizedMocksConfig;
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
  factoryMethods?: NormalizedFactoryMethodsOptions;
  tagsSplitDeduplication: boolean;
  commonTypesFileName: string;
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
  paramsFilter?: NormalizedMutator;
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
  effect: NormalizedEffectOptions;
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
  resolvedPath?: string;
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
  zod?: NormalizedOperationZodOptions;
  effect?: NormalizedEffectOptions;
  operationName?: (
    operation: OpenApiOperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  fetch?: FetchOptions;
  formData?: NormalizedFormDataType<NormalizedMutator>;
  formUrlEncoded?: boolean | NormalizedMutator;
  paramsSerializer?: NormalizedMutator;
  paramsFilter?: NormalizedMutator;
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

export type FactoryMethodsMode = 'single' | 'split' | 'single-split';

export interface FactoryMethodsOptions {
  functionNamePrefix?: string;
  mode?: FactoryMethodsMode;
  outputDirectory?: string;
  includeOptionalProperty?: boolean;
}

export interface NormalizedFactoryMethodsOptions {
  functionNamePrefix: string;
  mode: FactoryMethodsMode;
  outputDirectory: string;
  includeOptionalProperty: boolean;
}

export interface SchemaOptions {
  path: string;
  type?: SchemaGenerationType;
  importPath?: string;
  /**
   * When `true`, schemas are organized into per-tag subdirectories instead of
   * a single flat directory. Schemas referenced by multiple tags remain at the
   * root of the schema directory.
   *
   * @default false
   */
  splitByTags?: boolean;
}

export interface NormalizedSchemaOptions {
  path: string;
  type: SchemaGenerationType;
  importPath?: string;
  splitByTags: boolean;
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
  /**
   * Optional file extension applied only to schema artifacts (TS types or
   * Zod schemas) under `schemas:`. Takes precedence over `fileExtension`
   * for schema files. Defaults to `.zod.ts` when the output is Zod schemas
   * (`schemas: { type: 'zod' }` or `client: 'zod'` + `generateReusableSchemas`),
   * otherwise mirrors `fileExtension`.
   */
  schemaFileExtension?: string;
  mode?: OutputMode;
  // Mocks config. Accepts:
  // - `true` shorthand: emits both msw + faker with defaults
  // - OutputMocksConfig object with `generators` array and optional `indexMockFiles`
  // - ClientMockBuilder function for advanced custom generators
  mock?: OutputMocksOption;
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
  factoryMethods?: FactoryMethodsOptions;
  tagsSplitDeduplication?: boolean;
  commonTypesFileName?: string;
}

export interface InputFiltersOptions {
  mode?: 'include' | 'exclude';
  tags?: (string | RegExp)[];
  schemas?: (string | RegExp)[];
  /**
   * When `tags` is set, orval limits the output to only the schemas referenced
   * by the matching operations. Set this to `true` to keep every
   * `#/components/schemas` entry (including unreferenced ones) while still
   * filtering endpoints by `tags`. The other component sections (`responses`,
   * `parameters`, `requestBodies`) remain pruned to what the matching
   * operations use. Ignored when `schemas` is set.
   *
   * @default false
   */
  includeUnreferencedSchemas?: boolean;
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
  EFFECT: 'effect',
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
  FAKER: 'faker',
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

// Shared by every mock generator.
export interface CommonMockOptions {
  // Use OpenAPI examples to seed mock values where available
  useExamples?: boolean;
  // Generate response factories for every HTTP status defined in the spec
  generateEachHttpStatus?: boolean;
  // Faker locale (controls the `@faker-js/faker/locale/<x>` import path)
  locale?: keyof typeof allLocales;
  // Selects which response schema is mocked when multiple content types exist
  preferredContentType?: string;
  // Emit reusable mock factories for object-like array item schemas found in
  // operation responses (e.g. `getTenantResponseModelDtoMock` for
  // `value: TenantResponseModelDto[]`). Defaults to `false`.
  arrayItems?: boolean;
}

export interface MswMockOptions extends CommonMockOptions {
  type: typeof OutputMockType.MSW;
  // Base URL prefix for the generated MSW route matchers
  baseUrl?: string;
  // Response delay before MSW handlers resolve (false disables delay)
  delay?: false | number | (() => number);
  // Execute the `delay` function at runtime rather than build time
  delayFunctionLazyExecute?: boolean;
  // Custom output directory for MSW mock files. Overrides the shared
  // `OutputMocksConfig.path` when set. When provided in `single` or `tags`
  // modes, mock code is written to separate files instead of being inlined
  // into the implementation file.
  path?: string;
}

export interface FakerMockOptions extends CommonMockOptions {
  type: typeof OutputMockType.FAKER;
  // Emit a consolidated mock factory file for every entry under
  // `components/schemas` (one `get<SchemaName>Mock` per schema). Defaults to
  // `false` — schema factories are opt-in to preserve existing output.
  schemas?: boolean;
  // Package specifier for importing the schema-level faker factories (the
  // `get<SchemaName>Mock` functions emitted when `schemas: true`). When set,
  // it is used verbatim as the schema factory import path instead of appending
  // `/index.faker` to `schemas.importPath`. This lets consumers expose fakers
  // through a dedicated barrel separate from the production type barrel.
  // Requires `schemas.importPath` to also be set.
  schemasImportPath?: string;
  // Emit per-operation response mock factories (the historical behavior).
  // Defaults to `true`. Set to `false` together with `schemas: true` to get
  // only the consolidated schema factories.
  operationResponses?: boolean;
  // Custom output directory for faker mock files. Overrides the shared
  // `OutputMocksConfig.path` when set. When provided in `single` or `tags`
  // modes, mock code is written to separate files instead of being inlined
  // into the implementation file.
  path?: string;
}

export type GlobalMockOptions = MswMockOptions | FakerMockOptions;

// The top-level `mock` key on OutputOptions accepts this object form:
//   mock: {
//     indexMockFiles: true,
//     generators: [
//       { type: OutputMockType.MSW, ... },
//       { type: OutputMockType.FAKER, ... },
//     ],
//   }
export interface OutputMocksConfig {
  // When true, emits one root-level `index.<ext>.ts` per generator entry
  // (e.g. `index.msw.ts` and/or `index.faker.ts`) in `split` and `tags-split`
  // modes. In `tags-split` it re-exports each per-tag mock; in `split` it
  // re-exports the single mock file. Keeps mocks in a dedicated barrel so the
  // models/production barrels never pull them in.
  indexMockFiles?: boolean;
  // Shared output directory for all mock files. Individual generators can
  // override this with their own `path` property. When provided in `single`
  // or `tags` modes, mock code is written to separate files instead of being
  // inlined into the implementation file.
  path?: string;
  generators: (GlobalMockOptions | ClientMockBuilder)[];
}

// Accepts:
//   - boolean shorthand (`mock: true` => both msw + faker with defaults)
//   - OutputMocksConfig (full object form)
//   - ClientMockBuilder (single function-form for advanced users)
export type OutputMocksOption = boolean | OutputMocksConfig | ClientMockBuilder;

// Normalized result of resolving OutputMocksOption. Always an object so the
// rest of the pipeline can iterate `generators` without branching on shape.
export interface NormalizedMocksConfig {
  indexMockFiles: boolean;
  path?: string;
  generators: (GlobalMockOptions | ClientMockBuilder)[];
}

export type OverrideMockOptions = Partial<GlobalMockOptions> & {
  arrayMin?: number;
  arrayMax?: number;
  stringMin?: number;
  stringMax?: number;
  numberMin?: number;
  numberMax?: number;
  required?: boolean; // When true, all properties are required (and thus not optional) in mocks.
  nonNullable?: boolean; // When true, nullable mock values are never wrapped in `arrayElement([value, null])`.
  properties?: MockProperties;
  // Scope property overrides to a named schema (e.g. `components/schemas/Apple`),
  // so the same property name can mock differently per schema. Matching rules are
  // identical to `properties` (bare name, `/regex/`, exact `#.path`).
  schemas?: Record<string, { properties: MockProperties }>;
  format?: Record<string, unknown>;
  fractionDigits?: number;
};

export type MockOptions = Omit<
  OverrideMockOptions,
  'properties' | 'schemas'
> & {
  properties?: Record<string, unknown>;
  operations?: Record<string, { properties: Record<string, unknown> }>;
  tags?: Record<string, { properties: Record<string, unknown> }>;
  schemas?: Record<string, { properties: Record<string, unknown> }>;
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
  paramsFilter?: Mutator;
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
  effect?: EffectOptions;
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

/**
 * Strategy controlling how an existing hono handler file is treated on
 * regeneration.
 *
 * - `smart` (default): non-destructively reconcile orval-owned imports and
 *   `zValidator` arguments and append handlers for new operations, preserving
 *   all user-authored imports, middleware, bodies, and top-level code.
 * - `skip`: leave an existing handler file byte-for-byte unchanged.
 * - `full`: rebuild the preamble and validator chain from the spec, splicing
 *   back only the handler body. Drops custom imports/middleware/helpers.
 */
export type HonoHandlerStrategy = 'smart' | 'skip' | 'full';

export interface NormalizedHonoOptions {
  handlers?: string;
  handlerGenerationStrategy: HonoHandlerStrategy;
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

/**
 * Target Zod major version for generated output.
 *
 * - `4` — always emit Zod 4-style output (`z.strictObject`, `z.looseObject`,
 *   `z.iso.datetime()`, `.meta()`, …) regardless of the installed `zod` version.
 * - `3` — always emit Zod 3-compatible output (`.strict()`/`.passthrough()`,
 *   `z.string().datetime()`, …) regardless of the installed `zod` version.
 * - `'auto'` — infer the target from the `zod` version resolved in the output
 *   project's `package.json`; when no `zod` package can be detected, fall back
 *   to Zod 4 output.
 */
export type ZodVersionOption = 3 | 4 | 'auto';

export type ZodVariantOption = 'classic' | 'mini';

interface BaseZodOptions {
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
  /**
   * Mutator referencing a function called once per emitted validator at schema
   * construction time. It receives codegen-time context (operation, location,
   * schema name, field path, validator name) and returns a Zod `params` object
   * (e.g. `{ error: ... }`) that is appended as the trailing argument.
   *
   * The plural name follows Zod's own term for the validator's second argument
   * (`z.string(params)`) and is unrelated to the singular `param` key used by
   * `generate` / `coerce` / `preprocess` above, which refers to the path-parameter
   * location.
   */
  params?: Mutator;
  useBrandedTypes?: boolean;
}

export interface ZodOptions extends BaseZodOptions {
  /**
   * Select the generated Zod API style. `classic` imports from `zod`; `mini`
   * imports from `zod/mini` and emits the functional/check-based Zod Mini API.
   * Zod Mini requires a Zod 4 target.
   */
  variant?: ZodVariantOption;
  /**
   * Pin the Zod output target so generation is deterministic instead of
   * inferred from the installed `zod` version. Defaults to `'auto'`, which
   * infers from the detected package and otherwise falls back to Zod 4 output.
   * See {@link ZodVersionOption}.
   */
  version?: ZodVersionOption;
  dateTimeOptions?: ZodDateTimeOptions;
  timeOptions?: ZodTimeOptions;
  generateEachHttpStatus?: boolean;
  /**
   * When true, emits one reusable Zod schema per `#/components/schemas/*` `$ref`
   * (with `namingConvention` applied to the name) and references it everywhere
   * instead of inlining. Default `false`. See `docs/superpowers/specs/2026-05-26-reusable-zod-schemas-design.md`.
   */
  generateReusableSchemas?: boolean;
  /**
   * When true (zod v4 only), attaches registry metadata to generated
   * **component** schemas via `.meta({ id, description?, deprecated? })`: `id` is
   * the schema name, plus `description`/`deprecated` when the OpenAPI schema
   * provides them. On zod v3 (which has no `.meta()`) descriptions still emit
   * via `.describe()`. Default `false`.
   */
  generateMeta?: boolean;
}

/**
 * Per-operation/tag Zod overrides only include settings that are actually
 * merged into the operation-specific generator path. Output-wide target and
 * schema-layout settings belong on `override.zod`, not `override.operations.*`
 * / `override.tags.*`.
 */
export type OperationZodOptions = BaseZodOptions;

export interface EffectOptions {
  strict?: ZodOptions['strict'];
  generate?: ZodOptions['generate'];
  generateEachHttpStatus?: boolean;
  useBrandedTypes?: boolean;
}

export type ZodCoerceType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'date'
  // Not a real `z.coerce.array()` — opting 'array' into `coerce.<location>`
  // wraps array params in a single→array preprocess so a single repeated-key
  // query value (delivered as a scalar by the server framework) still parses.
  | 'array';

export interface NormalizedZodOptions {
  variant: ZodVariantOption;
  version: ZodVersionOption;
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
  params?: NormalizedMutator;
  generateEachHttpStatus: boolean;
  useBrandedTypes: boolean;
  generateReusableSchemas: boolean;
  generateMeta: boolean;
  dateTimeOptions: ZodDateTimeOptions;
  timeOptions: ZodTimeOptions;
}

export type NormalizedOperationZodOptions = Pick<
  NormalizedZodOptions,
  'strict' | 'generate' | 'coerce' | 'preprocess' | 'params' | 'useBrandedTypes'
>;

export interface NormalizedEffectOptions {
  strict: NormalizedZodOptions['strict'];
  generate: NormalizedZodOptions['generate'];
  generateEachHttpStatus: boolean;
  useBrandedTypes: boolean;
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
  handlerGenerationStrategy?: HonoHandlerStrategy;
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
  shouldFilterQueryKey?: boolean;
  queryKeyFilter?: string;
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
  shouldFilterQueryKey?: boolean;
  queryKeyFilter?: string;
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
  /**
   * Serialization format for array query parameters that do not have an explicit
   * `explode` setting in the OpenAPI spec.
   *
   * - `repeat` — repeat the key for each value: `foo=1&foo=2`
   * - `brackets` — append `[]` to the key: `foo[]=1&foo[]=2`
   * - `comma` — join values with a comma: `foo=1,2`
   */
  arrayFormat?: 'repeat' | 'brackets' | 'comma';
}

export interface FetchOptions {
  includeHttpResponseReturnType?: boolean;
  forceSuccessResponse?: boolean;
  jsonReviver?: Mutator;
  runtimeValidation?: boolean;
  useRuntimeFetcher?: boolean;
  /**
   * Serialization format for array query parameters that do not have an explicit
   * `explode` setting in the OpenAPI spec.
   *
   * - `repeat` — repeat the key for each value: `foo=1&foo=2`
   * - `brackets` — append `[]` to the key: `foo[]=1&foo[]=2`
   * - `comma` — join values with a comma: `foo=1,2`
   */
  arrayFormat?: 'repeat' | 'brackets' | 'comma';
}

export type InputTransformerFn = (
  spec: OpenApiDocument,
) => OpenApiDocument | Promise<OpenApiDocument>;

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
  zod?: OperationZodOptions;
  effect?: EffectOptions;
  operationName?: (
    operation: OpenApiOperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  fetch?: FetchOptions;
  formData?: boolean | Mutator | FormDataType<Mutator>;
  formUrlEncoded?: boolean | Mutator;
  paramsSerializer?: Mutator;
  paramsFilter?: Mutator;
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

export type Verbs =
  | 'get'
  | 'put'
  | 'post'
  | 'delete'
  | 'options'
  | 'head'
  | 'patch';

export const Verbs = {
  GET: 'get' as Verbs,
  PUT: 'put' as Verbs,
  POST: 'post' as Verbs,
  DELETE: 'delete' as Verbs,
  OPTIONS: 'options' as Verbs,
  HEAD: 'head' as Verbs,
  PATCH: 'patch' as Verbs,
};

/**
 * Canonical tag name used for the generated bucket that collects untagged operations.
 */
export const DefaultTag = 'default' as const;

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
  /**
   * Per-schema dynamic scope mapping `$dynamicAnchor` names to concrete schema
   * entries or generic parameter placeholders. Populated by `buildDynamicScope`.
   */
  dynamicScope?: Partial<Record<string, DynamicScopeEntry>>;
  /**
   * Lazily-built index of every `$dynamicAnchor` declared in
   * `components.schemas`, used by the `resolveDynamicRef` fallback when an
   * anchor is absent from {@link dynamicScope}. Memoized on first miss so the
   * O(numSchemas) scan runs once per spec instead of once per `$dynamicRef`.
   * Populated by `getDynamicAnchorIndex` in `resolvers/ref.ts`.
   */
  dynamicAnchorIndex?: Map<string, DynamicAnchorIndexEntry>;
  /**
   * Tracks array-item mock factory names already emitted per output file scope.
   * Populated by `@orval/mock` when `arrayItems: true` so shared `$ref` item
   * factories are not re-declared within the same file (single/split) or tag
   * bucket (tags/tags-split). Scope keys include the active mock generator
   * type so separate `.msw.ts` / `.faker.ts` files each get their own copy.
   */
  arrayItemMockFactories?: Map<string, Set<string>>;
  /**
   * Set by `@orval/mock` while generating per-operation mock output so
   * file-scoped helpers (e.g. array-item factory dedup) can distinguish
   * separate mock generator files.
   */
  activeMockOutputType?: OutputMockType;
}

/**
 * Maps a `$dynamicAnchor` name to its resolution target.
 *
 * Concrete entry (bound via `$ref`):
 *   - `name` — the generated TypeScript type name (e.g. `User`)
 *   - `schemaName` — the original key in `components.schemas` (e.g. `User`)
 *
 * Parameter entry (unbound `$defs` placeholder):
 *   - `isParameter` — `true`, signals this is a generic type parameter
 *   - `name` — the `$dynamicAnchor` name used as the type parameter (e.g. `itemType`)
 *   - `schemaName` — same as `name` for parameters
 *
 * Inline entry (anonymous subschema overriding an anchor without a `$ref`):
 *   - `inlineSchema` — the concrete schema object to resolve `$dynamicRef` against.
 *     Takes precedence over the component lookup in `resolveDynamicRef`, so an
 *     inline `$dynamicAnchor` (e.g. inside `allOf` / `items`) correctly shadows
 *     the outer/global anchor. `schemaName` is the anchor name itself.
 */
export interface DynamicScopeEntry {
  name: string;
  schemaName: string;
  isParameter?: boolean;
  inlineSchema?: OpenApiSchemaObject;
}

/**
 * Compact per-anchor result of the single `$dynamicAnchor` index scan.
 *
 * Reproduces the precedence in `resolveDynamicRef`'s fallback without storing
 * full match arrays:
 *   - {@link exactName} — a schema whose key equals the anchor name. Always
 *     wins when present (matches `matches.find(m => m === anchorName)`).
 *   - {@link firstName} / {@link count} — non-exact matches. Only the first is
 *     kept; `count` is capped at 2 because the resolution only distinguishes
 *     "exactly one" from "ambiguous". Recording stops once `count >= 2`, which
 *     is the safe form of "bail early when ambiguous" — a literal early-return
 *     at `count === 2` would regress the exact-name rule when the exact schema
 *     appears later in iteration order.
 */
export interface DynamicAnchorIndexEntry {
  exactName?: string;
  firstName?: string;
  count: number;
}

export interface GlobalOptions {
  watch?: boolean | string | string[];
  verbose?: boolean;
  clean?: boolean | string[];
  formatter?: SupportedFormatter;
  mock?: OutputMocksOption;
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
    module?: TsConfigModule;
    moduleResolution?: TsConfigModuleResolution;
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

/** Accepts both the canonical casing and the all-lowercase variant of a string literal. */
type CaseInsensitive<T extends string> = T | Lowercase<T>;

/**
 * Valid values for the TypeScript `compilerOptions.module` setting.
 *
 * Both title-case (e.g. `"NodeNext"`) and lower-case (e.g. `"nodenext"`) are
 * accepted, matching TypeScript's own case-insensitive parsing.
 *
 * @see {@link https://www.typescriptlang.org/tsconfig#module}
 */
export type TsConfigModule = CaseInsensitive<
  | 'None'
  | 'CommonJS'
  | 'AMD'
  | 'UMD'
  | 'System'
  | 'ES6'
  | 'ES2015'
  | 'ES2020'
  | 'ES2022'
  | 'ESNext'
  | 'Node16'
  | 'Node18'
  | 'Node20'
  | 'NodeNext'
  | 'Preserve'
>;

/**
 * Valid values for the TypeScript `compilerOptions.moduleResolution` setting.
 *
 * Both title-case (e.g. `"NodeNext"`) and lower-case (e.g. `"nodenext"`) are
 * accepted, matching TypeScript's own case-insensitive parsing.
 *
 * @see https://www.typescriptlang.org/tsconfig#moduleResolution
 */
export type TsConfigModuleResolution = CaseInsensitive<
  'Classic' | 'Node' | 'Node10' | 'Node16' | 'NodeNext' | 'Bundler'
>;

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
  factory?: string;
  factoryImports?: GeneratorImport[];
  factoryMode?: FactoryMethodsMode;
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
  // True when this import points at a generated schema-level faker factory
  // (e.g. `getPetMock`). The mock-file writer routes it to
  // `<schemas-dir>/index.faker` instead of `<schemas-dir>/<schemaName>`.
  readonly schemaFactory?: boolean;
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

// A single generator's accumulated mock output, keyed by the generator's
// `OutputMockType`. Writers iterate over `GeneratorTarget.mockOutputs` to
// emit one file per entry (e.g. `<file>.msw.ts` and `<file>.faker.ts`).
export type StrictMockSchemaKind = 'object' | 'alias' | 'binary';

export interface GeneratorMockOutput {
  type: OutputMockType;
  implementation: string;
  imports: GeneratorImport[];
  strictMockSchemaTypeNames?: string[];
  strictMockSchemaKinds?: Record<string, StrictMockSchemaKind>;
}

export interface GeneratorMockOutputFull {
  type: OutputMockType;
  implementation: {
    function: string;
    handler: string;
    handlerName: string;
  };
  imports: GeneratorImport[];
  strictMockSchemaTypeNames?: string[];
  strictMockSchemaKinds?: Record<string, StrictMockSchemaKind>;
}

export interface GeneratorTarget {
  imports: GeneratorImport[];
  implementation: string;
  mockOutputs: GeneratorMockOutput[];
  mutators?: GeneratorMutator[];
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator[];
  formUrlEncoded?: GeneratorMutator[];
  paramsSerializer?: GeneratorMutator[];
  paramsFilter?: GeneratorMutator[];
  fetchReviver?: GeneratorMutator[];
  sharedTypes?: SharedTypeDeclaration[];
}

export interface GeneratorTargetFull {
  imports: GeneratorImport[];
  implementation: string;
  mockOutputs: GeneratorMockOutputFull[];
  mutators?: GeneratorMutator[];
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator[];
  formUrlEncoded?: GeneratorMutator[];
  paramsSerializer?: GeneratorMutator[];
  paramsFilter?: GeneratorMutator[];
  fetchReviver?: GeneratorMutator[];
  sharedTypes?: SharedTypeDeclaration[];
}

export interface GeneratorOperation {
  imports: GeneratorImport[];
  implementation: string;
  mockOutputs: GeneratorMockOutputFull[];
  tags: string[];
  mutator?: GeneratorMutator;
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator;
  formUrlEncoded?: GeneratorMutator;
  paramsSerializer?: GeneratorMutator;
  paramsFilter?: GeneratorMutator;
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
  paramsFilter?: GeneratorMutator;
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

export interface SharedTypeDeclaration {
  name: string;
  exported: boolean;
  code: string;
}

export type HeaderResult = {
  implementation: string;
  sharedTypes?: SharedTypeDeclaration[];
};

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
  isDefaultTagBucket?: boolean;
  clientImplementation: string;
}) => string | HeaderResult;

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
  strictMockSchemaTypeNames?: string[];
  strictMockSchemaKinds?: Record<string, StrictMockSchemaKind>;
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
  paramNames?: string[];
  originalSchema?: OpenApiSchemaObject;
  requiredNullableKeys?: string[];
  /**
   * Names of query parameters whose declared schema is non-primitive
   * (object, array of objects, or untyped). Used by Angular generators to
   * preserve these values through the default `filterParams` helper instead
   * of silently dropping them — the user's `paramsSerializer`, `mutator`, or
   * `paramsFilter` is then responsible for handling them. See issue #3326.
   */
  nonPrimitiveKeys?: string[];
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

export interface FinalizeMockImplementationOptions {
  mockOptions?: Pick<MockOptions, 'required' | 'nonNullable'>;
  strictSchemaTypeNames?: readonly string[];
  strictMockSchemaKinds?: Readonly<Record<string, StrictMockSchemaKind>>;
}

export interface WriteSpecBuilder {
  operations: GeneratorOperations;
  verbOptions: Record<string, GeneratorVerbOptions>;
  schemas: GeneratorSchema[];
  title: GeneratorClientTitle;
  header: GeneratorClientHeader;
  footer: GeneratorClientFooter;
  imports: GeneratorClientImports;
  importsMock: GenerateMockImports;
  /** Hoists shared strict-mock type aliases once per aggregated mock file. */
  finalizeMockImplementation?: (
    implementation: string,
    options: FinalizeMockImplementationOptions,
  ) => string;
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
  // Schema-to-tag map computed by `writeSpecs` when `schemas.splitByTags` is
  // enabled. Mode writers forward it to `generateImportsForBuilder` so the
  // `indexFiles: false` branch can route each schema import into its tag
  // subdirectory instead of assuming a flat layout. `undefined` when
  // `splitByTags` is disabled, in which case routing falls back to the flat
  // layout. The `'.'` sentinel marks schemas referenced by 0 or 2+ tags
  // (shared, kept at the schemas root).
  schemaTagMap?: Map<string, string>;
}

export interface GeneratorApiOperations {
  verbOptions: Record<string, GeneratorVerbOptions>;
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
}

export interface GeneratorClientExtra {
  implementation: string;
  implementationMock: string;
  sharedTypes?: SharedTypeDeclaration[];
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
  isDefaultTagBucket?: boolean;
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
  /** Hoists shared strict-mock type aliases once per aggregated mock file. */
  finalizeMockImplementation?: (
    implementation: string,
    options: FinalizeMockImplementationOptions,
  ) => string;
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
