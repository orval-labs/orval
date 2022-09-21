import { isReference } from './../../utils/is';
import { resolveRef } from './ref';
import { ContextSpecs } from '../../types';
import { MediaTypeObject, SchemaObject } from 'openapi3-ts';
import merge from 'lodash.merge';

export const mergeAllOf = (
  inputSchema: MediaTypeObject['schema'],
  context: ContextSpecs,
) => {
  if (isReference(inputSchema)) {
    return resolveRef(inputSchema, context).schema;
  }

  let schema = { ...inputSchema };

  // test case [TopLevelAllOf]
  if (schema?.allOf) {
    schema = {
      ...schema,
      ...(schema.allOf || [])
        .map((v) => {
          if (isReference(v)) {
            return resolveRef(v, context).schema as SchemaObject;
          }
          return v;
        })
        .reduce((prev, current) => {
          if (!prev) return current;

          if (current.allOf) {
            return mergeAllOf(current, context);
          }
          return merge(prev, current);
        }, {}),
    };
    schema.allOf = undefined;
  }
  // test case [NestedAllOf]
  if (schema?.properties) {
    Object.keys(schema?.properties).forEach((key) => {
      if (schema?.properties?.[key]) {
        schema.properties[key] = mergeAllOf(schema.properties[key], context);
      }
    });
  }
  // test case [ArrayTopLevelAllOf][ArrayNestedAllOf]
  if (
    schema?.items &&
    typeof schema.items === 'object' &&
    !Array.isArray(schema.items) &&
    schema.items
  ) {
    schema.items = mergeAllOf(schema.items, context);
  }

  return schema;
};
