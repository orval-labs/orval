import { OpenAPIObject } from 'openapi3-ts';
import { GeneratorVerbOptions } from './generator';

export interface Options {
  output?: string | OutputOptions;
  input?: string | InputOptions;
  converterOptions?: ConverterOptions;
}

export type OutputOptions = {
  target?: string;
  schemas?: string;
  mode?: OutputMode;
  mock?: boolean;
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
  };
  query?: QueryOptions;
};

type QueryOptions = {
  useQuery?: boolean;
  useInfinite?: boolean;
  useInfiniteQueryParam?: string;
  config?: object;
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
};

export type Verbs = 'post' | 'put' | 'get' | 'patch' | 'delete';

export const Verbs = {
  POST: 'post' as Verbs,
  PUT: 'put' as Verbs,
  GET: 'get' as Verbs,
  PATCH: 'patch' as Verbs,
  DELETE: 'delete' as Verbs,
};

/**
 * Source: https://github.com/Mermade/oas-kit/tree/master/packages/swagger2openapi#a-command-line
 */
export type ConverterOptions = {
  /** mode to handle $ref's with sibling properties */
  refSiblings?: 'remove' | 'preserve' | 'allOf';
  /** resolve internal references also */
  resolveInternal?: boolean;
  /** Property name to use for warning extensions [default: "x-s2o-warning"] */
  warnProperty?: string;
  /** output information to unresolve a definition */
  components?: boolean;
  /** enable debug mode, adds specification-extensions */
  debug?: boolean;
  /** encoding for input/output files [default: "utf8"] */
  encoding?: string;
  /** make resolution errors fatal */
  fatal?: boolean;
  /** JSON indent to use, defaults to 4 spaces */
  indent?: string;
  /** the output file to write to  */
  outfile?: string;
  /** fix up small errors in the source definition */
  patch?: boolean;
  /** resolve external references */
  resolve?: boolean;
  /** override default target version of 3.0.0 */
  targetVersion?: string;
  /** url of original spec, creates x-origin entry */
  url?: string;
  /** Do not throw on non-patchable errors, add warning extensions */
  warnOnly?: boolean;
  /** write YAML, default JSON (overridden by outfile filepath extension */
  yaml?: boolean;
  /** Extension to use to preserve body parameter names in converted operations ("" == disabled) [default: ""] */
  rbname?: string;
};

export type ImportOpenApi = {
  data: string | object;
  format: 'yaml' | 'json';
  input?: InputOptions;
  output?: OutputOptions;
  workspace: string;
  converterOptions: ConverterOptions;
};
