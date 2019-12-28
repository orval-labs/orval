import { ParameterObject, SchemaObject } from 'openapi3-ts';
import { resolveValue } from '../resolvers/resolveValue';

export const getQueryParamsTypes = ({
  queryParams,
  type,
}: {
  queryParams: ParameterObject[];
  type?: 'definition' | 'implementation';
}) => {
  return queryParams.map(p => {
    const { name, required, schema } = p as {
      name: string;
      required: boolean;
      schema: SchemaObject;
    };

    if (type === 'definition') {
      return {
        name,
        definition: `${name}${!required || schema.default ? '?' : ''}: ${resolveValue(schema!).value}`,
        default: schema.default,
        required,
      };
    }

    return {
      name,
      definition: `${name}${!required && !schema.default ? '?' : ''}: ${resolveValue(schema!).value}${
        schema.default ? ` = ${schema.default}` : ''
      }`,
      default: schema.default,
      required,
    };
  });
};
