import SwaggerParser from '@apidevtools/swagger-parser';
import { OpenAPIObject, OperationObject } from 'openapi3-ts';
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

export interface NormalizedOptions {
  output: Omit<Required<OutputOptions>, 'schemas' | 'target'> & {
    target?: string;
    schemas?: string;
  };
  input: Required<InputOptions>;
}

export type OutputClientFunc = (
  clients: GeneratorClients,
) => ClientGeneratorsBuilder;

export type OutputOptions = {
  target?: string;
  schemas?: string;
  mode?: OutputMode;
  mock?: boolean | ClientMSWBuilder;
  override?: OverrideOutput;
  client?: OutputClient | OutputClientFunc;
};

export type InputOptions = {
  target: string | OpenAPIObject;
  validation?: boolean;
  override?: OverrideInput;
  converterOptions?: swagger2openapi.Options;
  parserOptions?: SwaggerParser.Options;
};

export type OutputClient =
  | 'axios'
  | 'axios-functions'
  | 'angular'
  | 'react-query'
  | 'svelte-query'
  | 'vue-query';

export const OutputClient = {
  ANGULAR: 'angular' as OutputClient,
  AXIOS: 'axios' as OutputClient,
  AXIOS_FUNCTIONS: 'axios-functions' as OutputClient,
  REACT_QUERY: 'react-query' as OutputClient,
  SVELTE_QUERY: 'svelte-query' as OutputClient,
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

export interface ExternalConfigFile {
  [backend: string]: Options;
}

type OutputTransformerFn = (verb: GeneratorVerbOptions) => GeneratorVerbOptions;

type OutputTransformer = string | OutputTransformerFn;

export type MutatorObject = {
  path: string;
  name: string;
  default?: boolean;
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
  formData?: boolean | Mutator;
  query?: QueryOptions;
  operationName?: (
    operation: OperationObject,
    route: string,
    verb: Verbs,
  ) => string;
  requestOptions?: object | boolean;
};

type QueryOptions = {
  useQuery?: boolean;
  useInfinite?: boolean;
  useInfiniteQueryParam?: string;
  options?: object;
};

type InputTransformerFn = (spec: OpenAPIObject) => OpenAPIObject;

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
  output: OutputOptions;
  path: string;
  workspace: string;
};

export interface ContextSpecs {
  specKey: string;
  workspace: string;
  specs: Record<string, OpenAPIObject>;
}
