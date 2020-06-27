import { AxiosRequestConfig } from 'axios';
import { OpenAPIObject } from 'openapi3-ts';

export interface Options {
  output?: string | OutputOptions;
  input?: string | InputOptions;
}

export type OutputOptions = {
  target?: string;
  schemas?: string;
  mode?: OutputMode;
  mock?: boolean | 'msw';
  override?: OverrideOutput;
  client?: OutputClient;
};

export type InputOptions = {
  target?: string;
  validation?: boolean;
  override?: OverrideInput;
};

export type OutputClient = 'axios' | 'angular';

export const OutputClient = {
  ANGULAR: 'angular' as OutputClient,
  AXIOS: 'axios' as OutputClient,
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

export type OverrideOutput = {
  transformer?: string;
  mutator?: string;
  operations?: { [key: string]: OperationOptions };
  mock?: {
    properties?: MockProperties;
  };
};

type TransformerFn = (spec: OpenAPIObject) => OpenAPIObject;

type Transformer = string | TransformerFn;

export type OverrideInput = {
  transformer?: Transformer;
};

type MutatorGet = (
  url: string,
  config: AxiosRequestConfig,
) => [string, AxiosRequestConfig];

type MutatorPost = (
  url: string,
  data: any,
  config: AxiosRequestConfig,
) => [string, AxiosRequestConfig];

export type Mutator = string | MutatorGet | MutatorPost;

export type OperationOptions = {
  transformer?: string;
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
  data: string;
  format: 'yaml' | 'json';
  input?: InputOptions;
  output?: OutputOptions;
  workspace: string;
};
