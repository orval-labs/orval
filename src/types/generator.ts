import {OpenAPIObject} from 'openapi3-ts';
import {
  GetterBody,
  GetterParameters,
  GetterParams,
  GetterProps,
  GetterResponse
} from './getters';
import {OperationOptions, OverrideOutput, Verbs} from './index';

export type GeneratorSchema = {name: string; model: string; imports: string[]};

export type GeneratorApiResponse = {
  operations: GeneratorOperations;
  schemas: GeneratorSchema[];
};

export type GeneratorOperations = {
  [operationId: string]: GeneratorOperation;
};

export type GeneratorTarget = {
  imports: string[];
  definition: string;
  implementation: string;
  implementationMocks: string;
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
  queryParams?: GeneratorSchema;
  params: GetterParams;
  props: GetterProps;
  transformer: string;
};

export type GeneratorVerbsOptions = GeneratorVerbOptions[];

export type GeneratorOptions = {
  route: string;
  specs: OpenAPIObject;
  override?: OverrideOutput;
};
