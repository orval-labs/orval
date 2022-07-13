import { SchemaObject } from 'openapi3-ts';
import { GeneratorImport } from './generator';

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
  specKey?: string;
  isRef?: boolean;
};
