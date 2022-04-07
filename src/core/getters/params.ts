import { ContextSpecs } from '../../types';
import { GetterParameters, GetterParams } from '../../types/getters';
import { camel } from '../../utils/case';
import { sanitize, stringify } from '../../utils/string';
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
  context,
}: {
  route: string;
  pathParams?: GetterParameters['query'];
  operationId: string;
  context: ContextSpecs;
}): Promise<GetterParams> => {
  const params = getParamsInPath(route);
  return Promise.all(
    params.map(async (p) => {
      const pathParam = pathParams.find(
        ({ parameter }) =>
          sanitize(camel(parameter.name), { es5keyword: true, underscore: true, dash: true }) ===
          p,
      );

      if (!pathParam) {
        throw new Error(
          `The path params ${p} can't be found in parameters (${operationId})`,
        );
      }

      const {
        name: nameWithoutSanitize,
        required = false,
        schema,
      } = pathParam.parameter;

      const name = sanitize(camel(nameWithoutSanitize), { es5keyword:true });

      if (!schema) {
        return {
          name,
          definition: `${name}${!required ? '?' : ''}: unknown`,
          implementation: `${name}${!required ? '?' : ''}: unknown`,
          default: false,
          required,
          imports: [],
        };
      }

      const resolvedValue = await resolveValue({
        schema,
        context: {
          ...context,
          ...(pathParam.imports.length
            ? {
                specKey: pathParam.imports[0].specKey,
              }
            : {}),
        },
      });

      const definition = `${name}${
        !required || resolvedValue.originalSchema!.default ? '?' : ''
      }: ${resolvedValue.value}`;

      const implementation = `${name}${
        !required && !resolvedValue.originalSchema!.default ? '?' : ''
      }${
        !resolvedValue.originalSchema!.default
          ? `: ${resolvedValue.value}`
          : `= ${stringify(resolvedValue.originalSchema!.default)}`
      }`;

      return {
        name,
        definition,
        implementation,
        default: resolvedValue.originalSchema!.default,
        required,
        imports: resolvedValue.imports,
      };
    }),
  );
};
