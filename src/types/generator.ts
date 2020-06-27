import { OpenAPIObject } from 'openapi3-ts';
import {
  GetterBody,
  GetterParameters,
  GetterParams,
  GetterProps,
  GetterQueryParam,
  GetterResponse,
} from './getters';
import { OperationOptions, OverrideOutput, Verbs } from './index';

export type GeneratorSchema = {
  name: string;
  model: string;
  imports: string[];
};

export type GeneratorApiResponse = {
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
};

export type GeneratorOperations = {
  [operationId: string]: GeneratorOperation;
};

export type GeneratorTarget = {
  imports: string[];
  importsMocks: string[];
  definition: string;
  implementation: string;
  implementationMocks: string;
  implementationMSW: string;
};

export type GeneratorOperation = GeneratorTarget & {
  importsMocks: string[];
  tags: string[];
};

export type GeneratorVerbOptions = {
  verb: Verbs;
  summary?: string;
  tags: string[];
  operationId: string;
  definitionName: string;
  overrideOperation: OperationOptions | undefined;
  response: GetterResponse;
  body: GetterBody;
  parameters: GetterParameters;
  queryParams?: GetterQueryParam;
  params: GetterParams;
  props: GetterProps;
  mutator: string;
};

export type GeneratorVerbsOptions = GeneratorVerbOptions[];

export type GeneratorOptions = {
  route: string;
  pathRoute: string;
  specs: OpenAPIObject;
  override?: OverrideOutput;
};
