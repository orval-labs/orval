import type { GeneratorImport } from '@orval/core';
import type { SchemaObject } from 'openapi3-ts/oas30';

export interface MockDefinition {
  value: string;
  enums?: string[];
  imports: GeneratorImport[];
  name: string;
  overrided?: boolean;
  includedProperties?: string[];
}

export type MockSchemaObject = Omit<SchemaObject, 'enum'> & {
  name: string;
  path?: string;
  isRef?: boolean;
  enum?: string[];
};
