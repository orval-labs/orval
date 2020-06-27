import { ParameterObject } from 'openapi3-ts';
import { GeneratorSchema } from './generator';
import { ResolverValue } from './resolvers';

export type GetterResponse = {
  imports: string[];
  definition: string;
  isBlob: boolean;
  types: ResolverValue[];
  schemas: GeneratorSchema[];
};

export type GetterBody = {
  imports: string[];
  definition: string;
  implementation: string;
  isBlob: boolean;
  schemas: GeneratorSchema[];
};

export type GetterParameters = {
  query?: ParameterObject[];
  path?: ParameterObject[];
};

export type GetterParam = {
  name: string;
  definition: string;
  implementation: string;
  default: boolean;
  required: boolean;
};

export type GetterParams = GetterParam[];
export type GetterQueryParam = {
  schema: GeneratorSchema;
  deps: GeneratorSchema[];
};

export type GetterProps = { definition: string; implementation: string };
