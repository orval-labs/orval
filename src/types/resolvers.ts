import { SchemaObject } from 'openapi3-ts';
import { GeneratorImport, GeneratorSchema } from './generator';

export type ResolverValue = {
  value: string;
  isEnum: boolean;
  type: string;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  originalSchema?: SchemaObject;
  isRef: boolean;
};

export type ResReqTypesValue = ResolverValue & {
  formData?: string;
  formUrlEncoded?: string;
  isRef?: boolean;
  key: string;
  contentType: string;
};
