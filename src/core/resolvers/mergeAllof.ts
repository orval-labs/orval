import { OpenAPIParser } from 'redoc';
import { OpenAPISchema } from 'redoc/typings/types';

export const mergeAllOf = (
  parser: OpenAPIParser,
  inputSchema: OpenAPISchema,
) => {
  let schema = { ...inputSchema };
  // test case [TopLevelAllOf]
  if (schema?.allOf) {
    schema = { ...schema, ...parser.mergeAllOf(schema) };
  }
  // test case [NestedAllOf]
  if (schema?.properties) {
    Object.keys(schema?.properties).forEach((key) => {
      if (schema?.properties?.[key]) {
        schema.properties[key] = {
          ...mergeAllOf(parser, schema.properties[key]),
        };
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
    schema.items = { ...mergeAllOf(parser, schema.items) };
  }
  return schema;
};
