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
  // True when `value` already embeds its own null branch (e.g. the scalar
  // getter wrapped it via `getNullable`). The object property layer reads this
  // to avoid wrapping the value in a second `arrayElement([..., null])`.
  nullWrapped?: boolean;
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
