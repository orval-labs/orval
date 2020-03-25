import {OpenAPIObject} from 'openapi3-ts';

export interface Options {
  output?: string;
  outputFile?: string;
  types?: string;
  workDir?: string;
  file?: string;
  github?: string;
  transformer?: string;
  validation?: boolean;
  mock?: boolean | MockOptions;
  override?: OverrideOptions;
}

export type MockProperties =
  | {[key: string]: unknown}
  | ((specs: OpenAPIObject) => {[key: string]: unknown});

export interface MockOptions<T = MockProperties> {
  properties?: T;
  responses?: {
    [operationId: string]: {
      properties?: T;
      data?: T;
    };
  };
}

export type AdvancedOptions = Options;

export interface ExternalConfigFile {
  [backend: string]: AdvancedOptions;
}

export type OverrideOptions = {
  operations?: {[key: string]: OperationOptions};
};

export type OperationOptions = {
  transformer?: string;
};

export type Verbs = 'post' | 'put' | 'get' | 'patch' | 'delete';

export const Verbs = {
  POST: 'post' as Verbs,
  PUT: 'put' as Verbs,
  GET: 'get' as Verbs,
  PATCH: 'patch' as Verbs,
  DELETE: 'delete' as Verbs
};
