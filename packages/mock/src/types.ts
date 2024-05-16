import { GeneratorImport } from '@orval/core';
import { SchemaObject } from 'openapi3-ts/oas30';

export interface MockDefinition {
  value: string;
  enums?: string[];
  imports: GeneratorImport[];
  name: string;
  overrided?: boolean;
  includedProperties?: string[];
}

export type MockSchemaObject = SchemaObject & {
  name: string;
  path?: string;
  isRef?: boolean;
};
