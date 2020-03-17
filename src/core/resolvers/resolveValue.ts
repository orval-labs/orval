import {SchemaObject} from 'openapi3-ts';
import {ResolverValue} from '../../types/resolvers';
import {isReference} from '../../utils/is';
import {getRef} from '../getters/getRef';
import {getScalar} from '../getters/getScalar';

/**
 * Resolve the value of a schema object to a proper type definition.
 * @param schema
 */
export const resolveValue = (
  schema: SchemaObject,
  name?: string
): ResolverValue => {
  if (isReference(schema)) {
    const value = getRef(schema.$ref);
    return {
      value,
      imports: [value],
      type: 'object',
      schemas: [],
      isEnum: false
    };
  }

  return getScalar(schema, name);
};
