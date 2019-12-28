import { SchemaObject } from 'openapi3-ts';
import { getRef } from '../getters/getRef';
import { getScalar } from '../getters/getScalar';
import { isReference } from '../isReference';

/**
 * Resolve the value of a schema object to a proper type definition.
 * @param schema
 */
export const resolveValue = (schema: SchemaObject) => {
  if (isReference(schema)) {
    const value = getRef(schema.$ref);
    return { value, imports: [value] };
  }

  return getScalar(schema);
};
