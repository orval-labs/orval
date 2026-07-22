import { resolveValue } from '../resolvers';
import type {
  ContextSpec,
  GetterParameters,
  GetterParams,
  NormalizedOutputOptions,
} from '../types';
import { stringify } from '../utils';
import { camelPathParamName } from './route';

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

/**
 * Resolves a route placeholder to its single matching spec path parameter.
 * `identifier` already is the generated JS identifier (it comes from the
 * processed route), so we re-derive the same identifier from each spec name via
 * `camelPathParamName` to match. Throws when two spec names collapse onto the
 * same identifier, or when none match.
 */
function resolvePathParam(
  identifier: string,
  pathParams: GetterParameters['query'],
  operationId: string,
): GetterParameters['query'][number] {
  const matching = pathParams.filter(
    ({ parameter }) => camelPathParamName(parameter.name ?? '') === identifier,
  );

  if (matching.length > 1) {
    const names = matching
      .map(({ parameter }) => `'${parameter.name}'`)
      .join(', ');
    throw new Error(
      `Path parameters ${names} all map to the same generated identifier '${identifier}' (${operationId}). Rename them so they don't collide.`,
    );
  }

  const pathParam = matching[0];
  if (!pathParam) {
    throw new Error(
      `The path params ${identifier} can't be found in parameters (${operationId})`,
    );
  }

  return pathParam;
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
    const pathParam = resolvePathParam(p, pathParams, operationId);

    const {
      name: nameWithoutSanitize,
      required = false,
      schema,
    } = pathParam.parameter;

    const name = camelPathParamName(nameWithoutSanitize ?? '');

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

    // Bridge assertion: .default returns any due to AnyOtherAttribute on OpenApiSchemaObject
    const schemaDefault = originalSchema.default as
      | string
      | Record<string, unknown>
      | unknown[]
      | undefined;

    let paramType = resolvedValue.value;
    if (output.allParamsOptional) {
      paramType = `${paramType} | undefined | null`; // TODO: maybe check that `paramType` isn't already undefined or null
    }

    const definition = `${name}${
      !required || schemaDefault ? '?' : ''
    }: ${paramType}`;

    const implementation = `${name}${!required && !schemaDefault ? '?' : ''}${
      schemaDefault
        ? `: ${paramType} = ${stringify(schemaDefault)}`
        : `: ${paramType}`
    }`; // FIXME: in Vue if we have `version: MaybeRef<number | undefined | null> = 1` and we don't pass version, the unref(version) will be `undefined` and not `1`, so we need to handle default value somewhere in implementation and not in the definition

    return {
      name,
      definition,
      implementation,
      default: schemaDefault,
      required,
      imports: resolvedValue.imports,
      originalSchema,
    };
  });
}
