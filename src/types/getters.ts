import { ParameterObject } from 'openapi3-ts';
import { GeneratorImport, GeneratorSchema } from './generator';
import { ResolverValue } from './resolvers';

export type GetterResponse = {
  imports: GeneratorImport[];
  definition: string;
  isBlob: boolean;
  types: ResolverValue[];
  schemas: GeneratorSchema[];
};

export type GetterBody = {
  imports: GeneratorImport[];
  definition: string;
  implementation: string;
  isBlob: boolean;
  schemas: GeneratorSchema[];
};

export type GetterParameters = {
  query: ParameterObject[];
  path: ParameterObject[];
};

export type GetterParam = {
  name: string;
  definition: string;
  implementation: string;
  default: boolean;
  required: boolean;
  imports: GeneratorImport[];
};

export type GetterParams = GetterParam[];
export type GetterQueryParam = {
  schema: GeneratorSchema;
  deps: GeneratorSchema[];
};

export type GetterPropType = 'param' | 'body' | 'queryParam';

export const GetterPropType = {
  PARAM: 'param' as GetterPropType,
  BODY: 'body' as GetterPropType,
  QUERY_PARAM: 'queryParam' as GetterPropType,
};

export type GetterProp = {
  name: string;
  definition: string;
  implementation: string;
  default: boolean;
  required: boolean;
  type: 'param' | 'body' | 'queryParam';
};

export type GetterProps = GetterProp[];
