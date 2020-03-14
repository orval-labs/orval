import {InfoObject} from 'openapi3-ts';

export type WriteSpecsImports = string[] | undefined;

export type WriteSpecsModel = {
  name: string;
  model: string;
  imports?: WriteSpecsImports;
};

export type WriteSpecsMock = {
  output: string;
  imports?: WriteSpecsImports;
};

export type WriteSpecsApi = {
  output: string;
  imports?: WriteSpecsImports;
  queryParamDefinitions?: WriteSpecsModel[];
};

export type WriteSpecsProps = {
  api: WriteSpecsApi;
  models: WriteSpecsModel[];
  mocks: WriteSpecsMock;
  info: InfoObject;
};
