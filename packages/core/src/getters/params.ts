import { resolveValue } from '../resolvers';
import type {
  ContextSpec,
  GetterParameters,
  GetterParams,
  NormalizedOutputOptions,
} from '../types';
import { stringify } from '../utils';
import { camelPathParamName, parseRoutePath } from './route';

/**
 * Return the name of every `{param}` in an OpenAPI path, in spec spelling.
 *
 * Uses the same tokenizer as the route generators ({@link parseRoutePath}), so
 * a placeholder is reported here if and only if it becomes an interpolation in
 * the generated route. Text that only looks like a placeholder — `{a+b}`,
 * `{}`, or a `${...}` block written in the spec — is static text and is not
 * reported (#3703).
 *
 * @example
 * ```
 * getParamsInPath("/pet/{category}/{name}/");
 * // => ["category", "name"]
 * ```
 * @param path an OpenAPI path, not a generated route
 */
export function getParamsInPath(path: string): string[] {
  return parseRoutePath(path)
    .filter((token) => token.kind === 'param')
    .map((token) => token.name);
}

interface GetParamsOptions {
  /** The OpenAPI path (`/pets/{petId}`), not the generated route. */
  pathRoute: string;
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
  pathRoute,
  pathParams = [],
  operationId,
  context,
  output,
}: GetParamsOptions): GetterParams {
  // Derived from the spec path through the same tokenizer the route generator
  // uses, so the generated function arguments and the route interpolations
  // can never disagree about what is a parameter (#3703).
  return getParamsInPath(pathRoute).map((specName) => {
    const pathParam = resolvePathParam(
      camelPathParamName(specName),
      pathParams,
      operationId,
    );

    const {
      name: nameWithoutSanitize,
      required = false,
      schema,
      allowReserved = false,
    } = pathParam.parameter;

    const name = camelPathParamName(nameWithoutSanitize ?? '');

    if (!schema) {
      return {
        name,
        definition: `${name}${required ? '' : '?'}: unknown`,
        implementation: `${name}${required ? '' : '?'}: unknown`,
        default: undefined,
        required,
        allowReserved,
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

    // `0`, `false` and `''` are defaults like any other, so the presence of one
    // is a check against `undefined` rather than a truthiness test.
    const hasSchemaDefault = schemaDefault !== undefined;

    const definition = `${name}${
      !required || hasSchemaDefault ? '?' : ''
    }: ${paramType}`;

    const implementation = `${name}${!required && !hasSchemaDefault ? '?' : ''}${
      hasSchemaDefault
        ? `: ${paramType} = ${stringify(schemaDefault)}`
        : `: ${paramType}`
    }`; // FIXME: in Vue if we have `version: MaybeRef<number | undefined | null> = 1` and we don't pass version, the unref(version) will be `undefined` and not `1`, so we need to handle default value somewhere in implementation and not in the definition

    return {
      name,
      definition,
      implementation,
      default: schemaDefault,
      required,
      allowReserved,
      imports: resolvedValue.imports,
      originalSchema,
    };
  });
}
