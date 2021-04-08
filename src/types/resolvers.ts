import { SchemaObject } from 'openapi3-ts';
import { GeneratorImport, GeneratorSchema } from './generator';

export type ResolverValue = {
  value: string;
  isEnum: boolean;
  type: string;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  ref?: SchemaObject;
};

export type ResReqTypesValue = ResolverValue & {
  formData?: string;
  isRef?: boolean;
};
