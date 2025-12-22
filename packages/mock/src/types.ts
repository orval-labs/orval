import type { GeneratorImport, OpenApiSchemaObject } from '@orval/core';

export interface MockDefinition {
  value: string;
  enums?: string[];
  imports: GeneratorImport[];
  name: string;
  overrided?: boolean;
  includedProperties?: string[];
}

export type MockSchemaObject = Omit<OpenApiSchemaObject, 'enum'> & {
  name: string;
  path?: string;
  isRef?: boolean;
  enum?: string[];
};
