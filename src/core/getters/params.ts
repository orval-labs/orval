import { ParameterObject, SchemaObject } from 'openapi3-ts';
import { InputTarget } from '../../types';
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
  operationId,
  target,
}: {
  route: string;
  pathParams?: ParameterObject[];
  operationId: string;
  target: InputTarget;
}): Promise<GetterParams> => {
  const params = getParamsInPath(route);
  return Promise.all(
    params.map(async (p) => {
      try {
        const { name: nameWithoutSanitize, required, schema } = pathParams.find(
          (i) => sanitize(i.name) === p,
        ) as {
          name: string;
          required: boolean;
          schema: SchemaObject;
        };

        const name = sanitize(nameWithoutSanitize);

        const resolvedValue = await resolveValue({ schema, target });

        const definition = `${name}${!required || schema.default ? '?' : ''}: ${
          resolvedValue.value
        }`;

        const implementation = `${name}${
          !required && !schema.default ? '?' : ''
        }: ${resolvedValue.value}${
          schema.default ? ` = ${schema.default}` : ''
        }`;

        return {
          name,
          definition,
          implementation,
          default: schema.default,
          required,
          imports: resolvedValue.imports,
        };
      } catch (err) {
        throw new Error(
          `The path params ${p} can't be found in parameters (${operationId})`,
        );
      }
    }),
  );
};