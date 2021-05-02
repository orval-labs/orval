import {
  GetterBody,
  GetterParams,
  GetterProps,
  GetterQueryParam,
  GetterResponse,
} from './getters';
import { ContextSpecs, OperationOptions, OverrideOutput, Verbs } from './index';

export type GeneratorSchema = {
  name: string;
  model: string;
  imports: GeneratorImport[];
};

export type GeneratorImport = {
  name: string;
  schemaName?: string;
  specKey?: string;
  default?: boolean;
  values?: boolean;
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
};

export type GeneratorOperation = {
  imports: GeneratorImport[];
  implementation: string;
  implementationMSW: { function: string; handler: string };
  importsMSW: GeneratorImport[];
  tags: string[];
  mutator?: GeneratorMutator;
};

export type GeneratorVerbOptions = {
  verb: Verbs;
  summary?: string;
  tags: string[];
  operationId: string;
  operationName: string;
  overrideOperation: OperationOptions | undefined;
  response: GetterResponse;
  body: GetterBody;
  queryParams?: GetterQueryParam;
  params: GetterParams;
  props: GetterProps;
  mutator?: GeneratorMutator;
};

export type GeneratorVerbsOptions = GeneratorVerbOptions[];

export type GeneratorOptions = {
  route: string;
  pathRoute: string;
  override?: OverrideOutput;
  context: ContextSpecs;
  mock: boolean;
};

export type GeneratorClient = {
  implementation: string;
  imports: GeneratorImport[];
};

export type GeneratorClientExtra = {
  implementation: string;
  implementationMSW: string;
};

export type GeneratorMutator = {
  name: string;
  path: string;
  default: boolean;
};
