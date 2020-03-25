import {
  GetterBody,
  GetterParameters,
  GetterParams,
  GetterProps,
  GetterResponse
} from './getters';
import {OperationOptions, Verbs} from './index';

export type GeneratorSchema = {name: string; model: string; imports: string[]};

export type GeneratorApiResponse = {
  imports: string[];
  definition: string;
  implementation: string;
  implementationMocks: string;
  schemas: GeneratorSchema[];
};

export type GeneratorVerbOptions = {
  verb: Verbs;
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

export type GeneratorOptions = {route: string; summary?: string};
