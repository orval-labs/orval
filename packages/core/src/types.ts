import SwaggerParser from '@apidevtools/swagger-parser';
import {
  InfoObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponsesObject,
  SchemaObject,
} from 'openapi3-ts';
import swagger2openapi from 'swagger2openapi';

export interface Options {
  output?: string | OutputOptions;
  input?: string | InputOptions;
  hooks?: Partial<HooksOptions>;
}

export type OptionsFn = () => Options | Promise<Options>;
export type OptionsExport = Options | Promise<Options> | OptionsFn;

export type Config = {
  [project: string]: OptionsExport;
};
export type ConfigFn = () => Config | Promise<Config>;

export type ConfigExternal = Config | Promise<Config> | ConfigFn;

export type NormizaledConfig = {
  [project: string]: NormalizedOptions;
};

export interface NormalizedOptions {
  output: NormalizedOutputOptions;
  input: NormalizedInputOptions;
  hooks: NormalizedHookOptions;
}

export type NormalizedOutputOptions = {
  workspace?: string;
  target?: string;
  schemas?: string;
  mode: OutputMode;
  mock: boolean | ClientMSWBuilder;
  override: NormalizedOverrideOutput;
  client: OutputClient | OutputClientFunc;
  clean: boolean | string[];
  prettier: boolean;
  tslint: boolean;
  tsconfig?: Tsconfig;
  packageJson?: PackageJson;
  headers: boolean;
  indexFiles: boolean;
  baseUrl?: string;
};

export type NormalizedParamsSerializerOptions = {
  qs?: Record<string, any>;
};

export type NormalizedOverrideOutput = {
  title?: (title: string) => string;
  transformer?: OutputTransformer;
  mutator?: NormalizedMutator;
  operations: { [key: string]: NormalizedOperationOptions };
  tags: { [key: string]: NormalizedOperationOptions };
  mock?: {
    arrayMin?: number;
    arrayMax?: number;
    properties?: MockProperties;
    format?: { [key: string]: unknown };
    required?: boolean;
    baseUrl?: string;
    delay?: number | (() => number);
  };
  contentType?: OverrideOutputContentType;
  header: false | ((info: InfoObject) => string[] | string);
  formData: boolean | NormalizedMutator;
  formUrlEncoded: boolean | NormalizedMutator;
  paramsSerializer?: NormalizedMutator;
  paramsSerializerOptions?: NormalizedParamsSerializerOptions;
  components: {
    schemas: {
      suffix: string;
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
  query: NormalizedQueryOptions;
  angular: Required<AngularOptions>;
  swr: {
    options?: any;
  };
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
};

export type NormalizedMutator = {
  path: string;
  name?: string;
  default: boolean;
  alias?: Record<string, string>;
};

export type NormalizedOperationOptions = {
  transformer?: OutputTransformer;
  mutator?: NormalizedMutator;
  mock?: {
    data?: MockProperties;
    properties?: MockProperties;
  };
  contentType?: OverrideOutputContentType;
  query?: NormalizedQueryOptions;
  angular?: Required<AngularOptions>;
  swr?: {
    options?: any;
  };
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  formData?: boolean | NormalizedMutator;
  formUrlEncoded?: boolean | NormalizedMutator;
  paramsSerializer?: NormalizedMutator;
  requestOptions?: object | boolean;
};

export type NormalizedInputOptions = {
  target: string | Record<string, unknown> | OpenAPIObject;
  validation: boolean;
  override: OverrideInput;
  converterOptions: swagger2openapi.Options;
  parserOptions: SwaggerParserOptions;
  filters?: {
    tags?: (string | RegExp)[];
  };
};

export type OutputClientFunc = (
  clients: GeneratorClients,
) => ClientGeneratorsBuilder;

export type OutputOptions = {
  workspace?: string;
  target?: string;
  schemas?: string;
  mode?: OutputMode;
  mock?: boolean | ClientMSWBuilder;
  override?: OverrideOutput;
  client?: OutputClient | OutputClientFunc;
  clean?: boolean | string[];
  prettier?: boolean;
  tslint?: boolean;
  tsconfig?: string | Tsconfig;
  packageJson?: string;
  headers?: boolean;
  indexFiles?: boolean;
  baseUrl?: string;
};

export type SwaggerParserOptions = Omit<SwaggerParser.Options, 'validate'> & {
  validate?: boolean;
};

export type InputOptions = {
  target: string | Record<string, unknown> | OpenAPIObject;
  validation?: boolean;
  override?: OverrideInput;
  converterOptions?: swagger2openapi.Options;
  parserOptions?: SwaggerParserOptions;
  filters?: {
    tags?: string[];
  };
};

export type OutputClient =
  | 'axios'
  | 'axios-functions'
  | 'angular'
  | 'react-query'
  | 'svelte-query'
  | 'vue-query'
  | 'swr'
  | 'zod';

export const OutputClient = {
  ANGULAR: 'angular' as OutputClient,
  AXIOS: 'axios' as OutputClient,
  AXIOS_FUNCTIONS: 'axios-functions' as OutputClient,
  REACT_QUERY: 'react-query' as OutputClient,
  SVELTE_QUERY: 'svelte-query' as OutputClient,
  VUE_QUERY: 'vue-query' as OutputClient,
};

export type OutputMode = 'single' | 'split' | 'tags' | 'tags-split';
export const OutputMode = {
  SINGLE: 'single' as OutputMode,
  SPLIT: 'split' as OutputMode,
  TAGS: 'tags' as OutputMode,
  TAGS_SPLIT: 'tags-split' as OutputMode,
};

export type MockOptions = {
  arrayMin?: number;
  arrayMax?: number;
  required?: boolean;
  properties?: Record<string, string>;
  operations?: Record<string, { properties: Record<string, string> }>;
  format?: Record<string, string>;
  tags?: Record<string, { properties: Record<string, string> }>;
};

export type MockProperties =
  | { [key: string]: unknown }
  | ((specs: OpenAPIObject) => { [key: string]: unknown });

type OutputTransformerFn = (verb: GeneratorVerbOptions) => GeneratorVerbOptions;

type OutputTransformer = string | OutputTransformerFn;

export type MutatorObject = {
  path: string;
  name?: string;
  default?: boolean;
  alias?: Record<string, string>;
};

export type Mutator = string | MutatorObject;

export type ParamsSerializerOptions = {
  qs?: Record<string, any>;
};

export type OverrideOutput = {
  title?: (title: string) => string;
  transformer?: OutputTransformer;
  mutator?: Mutator;
  operations?: { [key: string]: OperationOptions };
  tags?: { [key: string]: OperationOptions };
  mock?: {
    arrayMin?: number;
    arrayMax?: number;
    properties?: MockProperties;
    format?: { [key: string]: unknown };
    required?: boolean;
    baseUrl?: string;
    delay?: number;
  };
  contentType?: OverrideOutputContentType;
  header?: boolean | ((info: InfoObject) => string[] | string);
  formData?: boolean | Mutator;
  formUrlEncoded?: boolean | Mutator;
  paramsSerializer?: Mutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
  components?: {
    schemas?: {
      suffix?: string;
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
  query?: QueryOptions;
  swr?: {
    options?: any;
  };
  angular?: AngularOptions;
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  requestOptions?: Record<string, any> | boolean;
  useDates?: boolean;
  useTypeOverInterfaces?: boolean;
  useDeprecatedOperations?: boolean;
  useBigInt?: boolean;
  useNamedParameters?: boolean;
};

export type OverrideOutputContentType = {
  include?: string[];
  exclude?: string[];
};

export type NormalizedQueryOptions = {
  useQuery?: boolean;
  useSuspenseQuery?: boolean;
  useMutation?: boolean;
  useInfinite?: boolean;
  useSuspenseInfiniteQuery?: boolean;
  useInfiniteQueryParam?: string;
  options?: any;
  queryKey?: NormalizedMutator;
  queryOptions?: NormalizedMutator;
  mutationOptions?: NormalizedMutator;
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
  options?: any;
  queryKey?: Mutator;
  queryOptions?: Mutator;
  mutationOptions?: Mutator;
  signal?: boolean;
  version?: 3 | 4 | 5;
};

export type AngularOptions = {
  provideIn?: 'root' | 'any' | boolean;
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
    data?: MockProperties;
    properties?: MockProperties;
  };
  query?: QueryOptions;
  angular?: Required<AngularOptions>;
  swr?: {
    options?: any;
  };
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  formData?: boolean | Mutator;
  formUrlEncoded?: boolean | Mutator;
  paramsSerializer?: Mutator;
  requestOptions?: object | boolean;
};

export type Hook = 'afterAllFilesWrite';

export type HookFunction = (...args: any[]) => void | Promise<void>;

export type HookCommand = string | HookFunction | (string | HookFunction)[];

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
  data: Record<string, unknown | OpenAPIObject>;
  input: InputOptions;
  output: NormalizedOutputOptions;
  target: string;
  workspace: string;
};

export interface ContextSpecs {
  specKey: string;
  target: string;
  workspace: string;
  tslint: boolean;
  specs: Record<string, OpenAPIObject>;
  override: NormalizedOverrideOutput;
  tsconfig?: Tsconfig;
  packageJson?: PackageJson;
  parents?: string[];
}

export interface GlobalOptions {
  projectName?: string;
  watch?: boolean | string | (string | boolean)[];
  clean?: boolean | string[];
  prettier?: boolean;
  tslint?: boolean;
  mock?: boolean;
  client?: OutputClient;
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
}

export type GeneratorSchema = {
  name: string;
  model: string;
  imports: GeneratorImport[];
};

export type GeneratorImport = {
  name: string;
  schemaName?: string;
  alias?: string;
  specKey?: string;
  default?: boolean;
  values?: boolean;
  syntheticDefaultImport?: boolean;
};

export type GeneratorDependency = {
  exports: GeneratorImport[];
  dependency: string;
};

export type GeneratorApiResponse = {
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
};

export type GeneratorOperations = {
  [operationId: string]: GeneratorOperation;
};

export type GeneratorTarget = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMSW: string;
  importsMSW: GeneratorImport[];
  mutators?: GeneratorMutator[];
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator[];
  formUrlEncoded?: GeneratorMutator[];
  paramsSerializer?: GeneratorMutator[];
};

export type GeneratorTargetFull = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMSW: {
    function: string;
    handler: string;
  };
  importsMSW: GeneratorImport[];
  mutators?: GeneratorMutator[];
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator[];
  formUrlEncoded?: GeneratorMutator[];
  paramsSerializer?: GeneratorMutator[];
};

export type GeneratorOperation = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMSW: { function: string; handler: string };
  importsMSW: GeneratorImport[];
  tags: string[];
  mutator?: GeneratorMutator;
  clientMutators?: GeneratorMutator[];
  formData?: GeneratorMutator;
  formUrlEncoded?: GeneratorMutator;
  paramsSerializer?: GeneratorMutator;
  operationName: string;
  types?: {
    result: (title?: string) => string;
  };
};

export type GeneratorVerbOptions = {
  verb: Verbs;
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
  mock: boolean;
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
) => GeneratorClient | Promise<GeneratorClient>;

export type ClientHeaderBuilder = (params: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  noFunction?: boolean;
  isGlobalMutator: boolean;
  provideIn: boolean | 'root' | 'any';
  hasAwaitedType: boolean;
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
) => GeneratorDependency[];

export type ClientMSWBuilder = (
  verbOptions: GeneratorVerbOptions,
  generatorOptions: GeneratorOptions,
) => {
  imports: string[];
  implementation: string;
};

export interface ClientGeneratorsBuilder {
  client: ClientBuilder;
  header?: ClientHeaderBuilder;
  dependencies?: ClientDependenciesBuilder;
  footer?: ClientFooterBuilder;
  title?: ClientTitleBuilder;
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
  title: GeneratorClientTitle;
  header: GeneratorClientHeader;
  footer: GeneratorClientFooter;
  imports: GeneratorClientImports;
  importsMock: GenerateMockImports;
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
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
};

export type GeneratorClientExtra = {
  implementation: string;
  implementationMSW: string;
};

export type GeneratorClientTitle = (data: {
  outputClient?: OutputClient | OutputClientFunc;
  title: string;
  customTitleFunc?: (title: string) => string;
}) => GeneratorClientExtra;

export type GeneratorClientHeader = (data: {
  outputClient?: OutputClient | OutputClientFunc;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator: boolean;
  provideIn: boolean | 'root' | 'any';
  hasAwaitedType: boolean;
  titles: GeneratorClientExtra;
}) => GeneratorClientExtra;

export type GeneratorClientFooter = (data: {
  outputClient: OutputClient | OutputClientFunc;
  operationNames: string[];
  hasMutator: boolean;
  hasAwaitedType: boolean;
  titles: GeneratorClientExtra;
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
  hasParamsSerializerOptions: boolean;
  packageJson?: PackageJson;
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
}) => string;

export type GeneratorApiBuilder = GeneratorApiOperations & {
  title: GeneratorClientTitle;
  header: GeneratorClientHeader;
  footer: GeneratorClientFooter;
  imports: GeneratorClientImports;
  importsMock: GenerateMockImports;
};
