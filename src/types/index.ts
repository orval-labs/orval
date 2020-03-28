import {OpenAPIObject} from 'openapi3-ts';

export interface Options {
  output?: string | OutputOptions;
  input?: string | InputOptions;
}

export type OutputOptions = {
  target?: string;
  schemas?: string;
  mode?: OutputMode;
  mock?: boolean;
  override?: OverrideOutput;
};

export type InputOptions = {
  target?: string;
  validation?: boolean;
  override?: OverrideInput;
};

export type OutputMode = 'single' | 'split';
export const OutputMode = {
  SINGLE: 'single' as OutputMode,
  SPLIT: 'split' as OutputMode
};

export type MockOptions = {
  properties?: {[key: string]: unknown};
  operations?: {[key: string]: {[key: string]: any}};
};

export type MockProperties =
  | {[key: string]: unknown}
  | ((specs: OpenAPIObject) => {[key: string]: unknown});

export interface ExternalConfigFile {
  [backend: string]: Options;
}

export type OverrideOutput = {
  operations?: {[key: string]: OperationOptions};
  mock?: {
    properties?: MockProperties;
  };
};

export type OverrideInput = {
  transformer?: string;
};

export type OperationOptions = {
  transformer?: string;
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
  DELETE: 'delete' as Verbs
};

export type ImportOpenApi = {
  data: string;
  format: 'yaml' | 'json';
  input?: InputOptions;
  output?: OutputOptions;
};
