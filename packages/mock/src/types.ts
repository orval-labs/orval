import type {
  GeneratorImport,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '@orval/core';

export interface MockDefinition {
  value: string;
  enums?: string[];
  imports: GeneratorImport[];
  name: string;
  overrided?: boolean;
  includedProperties?: string[];
}

type OpenApiObjectSchema = Extract<OpenApiSchemaObject, object>;

export type MockSchemaRef = OpenApiReferenceObject;

export type MockSchemaObject = Omit<OpenApiObjectSchema, 'enum'> & {
  name: string;
  path?: string;
  isRef?: boolean;
  enum?: string[];
};

export type MockSchema = MockSchemaObject | MockSchemaRef;
