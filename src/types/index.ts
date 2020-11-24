import { OpenAPIObject } from 'openapi3-ts';
import { GeneratorVerbOptions } from './generator';

export interface Options {
  output?: string | OutputOptions;
  input?: string | InputOptions;
}

export type OutputOptions = {
  target?: string;
  schemas?: string;
  mode?: OutputMode;
  mock?: boolean | 'old-version';
  override?: OverrideOutput;
  client?: OutputClient;
};

export type InputOptions = {
  target?: string;
  validation?: boolean;
  override?: OverrideInput;
};

export type OutputClient = 'axios' | 'angular' | 'react-query';

export const OutputClient = {
  ANGULAR: 'angular' as OutputClient,
  AXIOS: 'axios' as OutputClient,
  REACT_QUERY: 'react-query' as OutputClient,
};

export type OutputMode = 'single' | 'split' | 'tags' | 'tags-split';
export const OutputMode = {
  SINGLE: 'single' as OutputMode,
  SPLIT: 'split' as OutputMode,
  TAGS: 'tags' as OutputMode,
  TAGS_SPLIT: 'tags-split' as OutputMode,
};

export type MockOptions = {
  properties?: { [key: string]: unknown };
  operations?: { [key: string]: { [key: string]: any } };
};

export type MockProperties =
  | { [key: string]: unknown }
  | ((specs: OpenAPIObject) => { [key: string]: unknown });

export interface ExternalConfigFile {
  [backend: string]: Options;
}

type OuputTransformerFn = (verb: GeneratorVerbOptions) => GeneratorVerbOptions;

type OuputTransformer = string | OuputTransformerFn;

export type MutatorObject = {
  path: string;
  name: string;
  default?: boolean;
};

export type Mutator = string | MutatorObject;

export type OverrideOutput = {
  title?: (title: string) => string;
  transformer?: OuputTransformer;
  mutator?: Mutator;
  operations?: { [key: string]: OperationOptions };
  mock?: {
    properties?: MockProperties;
  };
};

type InputTransformerFn = (spec: OpenAPIObject) => OpenAPIObject;

type InputTransformer = string | InputTransformerFn;

export type OverrideInput = {
  transformer?: InputTransformer;
};

export type OperationOptions = {
  transformer?: OuputTransformer;
  mutator?: Mutator;
  mock?: {
    data?: MockProperties;
    properties?: MockProperties;
  };
};

export type Verbs = 'post' | 'put' | 'get' | 'patch' | 'delete';

export const Verbs = {
  POST: 'post' as Verbs,
  PUT: 'put' as Verbs,
  GET: 'get' as Verbs,
  PATCH: 'patch' as Verbs,
  DELETE: 'delete' as Verbs,
};

export type ImportOpenApi = {
  data: string | object;
  format: 'yaml' | 'json';
  input?: InputOptions;
  output?: OutputOptions;
  workspace: string;
};
