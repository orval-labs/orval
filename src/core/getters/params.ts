import { OperationObject, ParameterObject, SchemaObject } from 'openapi3-ts';
import { GetterParams } from '../../types/getters';
import { sanitize } from '../../utils/string';
import { resolveValue } from '../resolvers/value';

/**
 * Return every params in a path
 *
 * @example
 * ```
 * getParamsInPath("/pet/{category}/{name}/");
 * // => ["category", "name"]
 * ```
 * @param path
 */
export const getParamsInPath = (path: string) => {
  let n;
  const output = [];
  const templatePathRegex = /\{(.*?)\}/g;
  // tslint:disable-next-line:no-conditional-assignment
  while ((n = templatePathRegex.exec(path)) !== null) {
    output.push(n[1]);
  }

  return output;
};

export const getParams = ({
  route,
  pathParams = [],
  operation,
}: {
  route: string;
  pathParams?: ParameterObject[];
  operation: OperationObject;
}): GetterParams => {
  const params = getParamsInPath(route);
  return params.map((p) => {
    try {
      const { name: nameWithoutSanitize, required, schema } = pathParams.find(
        (i) => sanitize(i.name) === p,
      ) as {
        name: string;
        required: boolean;
        schema: SchemaObject;
      };

      const name = sanitize(nameWithoutSanitize);

      const resolvedValue = resolveValue(schema);

      const definition = `${name}${!required || schema.default ? '?' : ''}: ${
        resolvedValue.value
      }`;

      const implementation = `${name}${
        !required && !schema.default ? '?' : ''
      }: ${resolvedValue.value}${schema.default ? ` = ${schema.default}` : ''}`;

      return {
        name,
        definition,
        implementation,
        default: schema.default,
        required,
      };
    } catch (err) {
      throw new Error(
        `The path params ${p} can't be found in parameters (${operation.operationId})`,
      );
    }
  });
};
