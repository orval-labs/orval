import { resolveValue } from '../resolvers';
import type {
  ContextSpec,
  GetterParameters,
  GetterParams,
  NormalizedOutputOptions,
} from '../types';
import { camel, sanitize, stringify } from '../utils';

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
export function getParamsInPath(path: string) {
  let n;
  const output = [];
  const templatePathRegex = /\{(.*?)\}/g;
  while ((n = templatePathRegex.exec(path)) !== null) {
    output.push(n[1]);
  }

  return output;
}

interface GetParamsOptions {
  route: string;
  pathParams?: GetterParameters['query'];
  operationId: string;
  context: ContextSpec;
  output: NormalizedOutputOptions;
}

export function getParams({
  route,
  pathParams = [],
  operationId,
  context,
  output,
}: GetParamsOptions): GetterParams {
  const params = getParamsInPath(route);
  return params.map((p) => {
    const pathParam = pathParams.find(
      ({ parameter }) =>
        sanitize(camel(parameter.name), {
          es5keyword: true,
          underscore: true,
          dash: true,
        }) === p,
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

    const name = sanitize(camel(nameWithoutSanitize), { es5keyword: true });

    if (!schema) {
      return {
        name,
        definition: `${name}${required ? '' : '?'}: unknown`,
        implementation: `${name}${required ? '' : '?'}: unknown`,
        default: false,
        required,
        imports: [],
      };
    }

    const resolvedValue = resolveValue({
      schema,
      context,
    });

    const originalSchema = resolvedValue.originalSchema;

    let paramType = resolvedValue.value;
    if (output.allParamsOptional) {
      paramType = `${paramType} | undefined | null`; // TODO: maybe check that `paramType` isn't already undefined or null
    }

    const definition = `${name}${
      !required || originalSchema?.default ? '?' : ''
    }: ${paramType}`;

    const implementation = `${name}${
      !required && !originalSchema?.default ? '?' : ''
    }${
      originalSchema?.default
        ? `: ${paramType} = ${stringify(originalSchema.default)}`
        : `: ${paramType}` // FIXME: in Vue if we have `version: MaybeRef<number | undefined | null> = 1` and we don't pass version, the unref(version) will be `undefined` and not `1`, so we need to handle default value somewhere in implementation and not in the definition
    }`;

    return {
      name,
      definition,
      implementation,
      default: originalSchema?.default,
      required,
      imports: resolvedValue.imports,
      originalSchema,
    };
  });
}
