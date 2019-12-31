import { OpenAPIObject } from 'openapi3-ts';

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
}

export type MockProperties = { [key: string]: unknown } | ((specs: OpenAPIObject) => { [key: string]: unknown });

export interface MockOptions<T = MockProperties> {
  properties?: T;
  responses?: {
    [operationId: string]: {
      properties?: T;
    };
  };
}

export type AdvancedOptions = Options;

export interface ExternalConfigFile {
  [backend: string]: AdvancedOptions;
}
