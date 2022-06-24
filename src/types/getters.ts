import { ParameterObject } from 'openapi3-ts';
import { GeneratorImport, GeneratorSchema } from './generator';
import { ResReqTypesValue } from './resolvers';

export type GetterResponse = {
  imports: GeneratorImport[];
  definition: {
    success: string;
    errors: string;
  };
  isBlob: boolean;
  types: {
    success: ResReqTypesValue[];
    errors: ResReqTypesValue[];
  };
  contentTypes: string[];
  schemas: GeneratorSchema[];
};

export type GetterBody = {
  imports: GeneratorImport[];
  definition: string;
  implementation: string;
  schemas: GeneratorSchema[];
  formData?: string;
  formUrlEncoded?: string;
  contentType: string;
};

export type GetterParameters = {
  query: { parameter: ParameterObject; imports: GeneratorImport[] }[];
  path: { parameter: ParameterObject; imports: GeneratorImport[] }[];
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
  isOptional: boolean;
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
