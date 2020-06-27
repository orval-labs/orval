import { SchemaObject } from 'openapi3-ts';
import { MockOptions } from '../../types';
import { MockDefinition } from '../../types/mocks';
import { isReference } from '../../utils/is';
import { getRef } from '../getters/ref';
import { getMockScalar } from '../getters/scalar.mock';

export const resolveMockValue = ({
  schema,
  schemas,
  allOf,
  mockOptions,
  operationId,
}: {
  schema: SchemaObject & { name: string; parents?: string[] };
  schemas: { [key: string]: SchemaObject };
  operationId: string;
  allOf?: boolean;
  mockOptions?: MockOptions;
}): MockDefinition => {
  if (isReference(schema)) {
    const value = getRef(schema.$ref);
    const newSchema = {
      ...schemas[value],
      name: value,
      parents: schema.parents
        ? [...schema.parents, schema.name]
        : [schema.name],
      isRef: true,
    };

    if (!newSchema) {
      return { value: 'undefined', imports: [], name: value };
    }

    return getMockScalar({
      item: newSchema,
      schemas,
      allOf,
      mockOptions,
      operationId,
    });
  }

  return getMockScalar({
    item: schema,
    schemas,
    allOf,
    mockOptions,
    operationId,
  });
};
