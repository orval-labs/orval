import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../types';
import { isReference } from '../utils';
import { resolveRef } from '../resolvers';
import mergeWith from 'lodash.mergewith';

const arrayConcat = (a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.concat(b);
  }
};

export const mergeAllOf = (
  _schema: SchemaObject | ReferenceObject,
  context: ContextSpecs,
): SchemaObject => {
  if (isReference(_schema)) {
    return resolveRef(_schema, context).schema as SchemaObject;
  }

  let schema = _schema as SchemaObject;

  if (schema.allOf) {
    let specKey = context.specKey;
    const mergedAllOf = schema.allOf.reduce((prev, current) => {
      if (isReference(current)) {
        const result = resolveRef<SchemaObject>(current, context);
        specKey = result.imports[0].specKey || specKey;
        current = result.schema;
      }
      return mergeWith({}, prev, current, arrayConcat);
    }, {});
    schema = mergeWith({}, mergedAllOf, schema, arrayConcat);
    (schema as SchemaObject).allOf = undefined;
    context.specKey = specKey;
    return mergeAllOf(schema, context);
  }

  if (schema?.properties) {
    Object.keys(schema?.properties).forEach((key) => {
      if (schema?.properties?.[key]) {
        schema.properties[key] = mergeAllOf(schema.properties[key], context);
      }
    });
  }

  if (schema?.items) {
    schema.items = mergeAllOf(schema.items, context);
  }

  return schema;
};
