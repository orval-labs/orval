import SwaggerParser from '@apidevtools/swagger-parser';
import { InfoObject, OpenAPIObject, OperationObject } from 'openapi3-ts';
import swagger2openapi from 'swagger2openapi';
import {
  ClientGeneratorsBuilder,
  ClientMSWBuilder,
  GeneratorClients,
  GeneratorVerbOptions,
} from './generator';

export interface Options {
  output?: string | OutputOptions;
  input?: string | InputOptions;
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
};

export type NormalizedOverrideOutput = {
  title?: (title: string) => string;
  transformer?: OutputTransformer;
  mutator?: NormalizedMutator;
  operations: { [key: string]: NormalizedOperationOptions };
  tags: { [key: string]: NormalizedOperationOptions };
  mock?: {
    properties?: MockProperties;
    format?: { [key: string]: unknown };
    required?: boolean;
    baseUrl?: string;
  };
  header: false | ((info: InfoObject) => string[] | string);
  formData: boolean | NormalizedMutator;
  formUrlEncoded: boolean | NormalizedMutator;
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
  query: QueryOptions;
  angular: Omit<Required<AngularOptions>, 'provideInRoot'>;
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  requestOptions: Record<string, any> | boolean;
  useDates?: boolean;
  useTypeOverInterfaces?: boolean;
  trpc?: TrpcOptions;
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
  query?: QueryOptions;
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  formData: boolean | NormalizedMutator;
  formUrlEncoded: boolean | NormalizedMutator;
  requestOptions: object | boolean;
  trpc?: TrpcOptions;
};
export type NormalizedInputOptions = {
  target: string | OpenAPIObject;
  validation: boolean;
  override: OverrideInput;
  converterOptions: swagger2openapi.Options;
  parserOptions: SwaggerParserOptions;
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
};

export type SwaggerParserOptions = Omit<SwaggerParser.Options, 'validate'> & {
  validate?: boolean;
};

export type InputOptions = {
  target: string | OpenAPIObject;
  validation?: boolean;
  override?: OverrideInput;
  converterOptions?: swagger2openapi.Options;
  parserOptions?: SwaggerParserOptions;
};

export type OutputClient =
  | 'axios'
  | 'axios-functions'
  | 'angular'
  | 'react-query'
  | 'svelte-query'
  | 'vue-query'
  | 'swr'
  | 'trpc';

export const OutputClient = {
  ANGULAR: 'angular' as OutputClient,
  AXIOS: 'axios' as OutputClient,
  AXIOS_FUNCTIONS: 'axios-functions' as OutputClient,
  REACT_QUERY: 'react-query' as OutputClient,
  SVELTE_QUERY: 'svelte-query' as OutputClient,
  TRPC: 'trpc' as OutputClient,
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

export type OverrideOutput = {
  title?: (title: string) => string;
  transformer?: OutputTransformer;
  mutator?: Mutator;
  operations?: { [key: string]: OperationOptions };
  tags?: { [key: string]: OperationOptions };
  mock?: {
    properties?: MockProperties;
    format?: { [key: string]: unknown };
    required?: boolean;
    baseUrl?: string;
  };
  header?: boolean | ((info: InfoObject) => string[] | string);
  formData?: boolean | Mutator;
  formUrlEncoded?: boolean | Mutator;
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
  angular?: AngularOptions;
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  requestOptions?: Record<string, any> | boolean;
  useDates?: boolean;
  useTypeOverInterfaces?: boolean;
  trpc?: TrpcOptions;
};

type QueryOptions = {
  useQuery?: boolean;
  useInfinite?: boolean;
  useInfiniteQueryParam?: string;
  options?: any;
};

export type AngularOptions = {
  provideInRoot?: boolean;
  provideIn?: 'root' | 'any' | boolean;
};

export type TrpcOptions = {
  passRequestContextToCustomMutator?: boolean;
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
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  formData?: boolean | Mutator;
  formUrlEncoded?: boolean | Mutator;
  requestOptions?: object | boolean;
};

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
  data: Record<string, OpenAPIObject>;
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
}

export interface Tsconfig {
  baseUrl?: string;
  compilerOptions?: {
    esModuleInterop?: boolean;
    allowSyntheticDefaultImports?: boolean;
    paths?: Record<string, string[]>;
  };
}

export interface PackageJson {
  dependencies?: Record<string, string>;
}
