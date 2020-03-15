import {OperationObject, ParameterObject, SchemaObject} from 'openapi3-ts';
import {resolveValue} from '../resolvers/resolveValue';

export const getParamsTypes = ({
  params,
  pathParams,
  operation,
  type = 'definition'
}: {
  params: string[];
  pathParams: ParameterObject[];
  operation: OperationObject;
  type?: 'definition' | 'implementation';
}) => {
  return params.map(p => {
    try {
      const {name, required, schema} = pathParams.find(i => i.name === p) as {
        name: string;
        required: boolean;
        schema: SchemaObject;
      };

      if (type === 'definition') {
        return {
          name,
          definition: `${name}${!required || schema.default ? '?' : ''}: ${
            resolveValue(schema).value
          }`,
          default: schema.default,
          required
        };
      }

      return {
        name,
        definition: `${name}${!required && !schema.default ? '?' : ''}: ${
          resolveValue(schema).value
        }${schema.default ? ` = ${schema.default}` : ''}`,
        default: schema.default,
        required
      };
    } catch (err) {
      throw new Error(
        `The path params ${p} can't be found in parameters (${operation.operationId})`
      );
    }
  });
};
