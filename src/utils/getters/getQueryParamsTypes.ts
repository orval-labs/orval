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

    const { value, imports } = resolveValue(schema!);

    if (type === 'definition') {
      return {
        name,
        definition: `${name}${!required || schema.default ? '?' : ''}: ${value}`,
        default: schema.default,
        required,
        imports,
      };
    }

    return {
      name,
      definition: `${name}${!required && !schema.default ? '?' : ''}: ${value}${
        schema.default ? ` = ${schema.default}` : ''
      }`,
      default: schema.default,
      required,
      imports,
    };
  });
};
