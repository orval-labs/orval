import { isBooleanJsonSchema } from '@scalar/openapi-types/helpers';

import { resolveValue } from '../resolvers';
import type {
  ContextSpec,
  GetterParam,
  GetterParameters,
  GetterParams,
  NormalizedOutputOptions,
  OpenApiNonBooleanSchemaObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResolverValue,
} from '../types';
import { isSchemaNullable, stringify } from '../utils';
import { camelPathParamName, parseRoutePath } from './route';
import {
  callFormatTypeFunction,
  findCustomFormatType,
  findModelFormatType,
  getCustomFormatType,
  getFormatTypeError,
  getModelFormatType,
} from './scalar';

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
    // oxlint-disable-next-line typescript/no-unnecessary-condition
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
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (!pathParam) {
    throw new Error(
      `The path params ${identifier} can't be found in parameters (${operationId})`,
    );
  }

  return pathParam;
}

/**
 * The {@link GetterParam.formatTypeEncoding} of a path parameter, which a
 * component `$ref` types with the model type.
 */
function getFormatTypeEncoding(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  { isRef, originalSchema }: ResolverValue,
  parameterName: string,
  operationId: string,
  context: ContextSpec,
): GetterParam['formatTypeEncoding'] {
  const found = isRef
    ? findModelFormatType(schema, context)
    : findCustomFormatType(schema, context);
  if (!found) return undefined;
  // Otherwise the mapped values sit inside an array or object.
  const isValue = !!getCustomFormatType(
    originalSchema,
    context.output.override,
  );
  if (isValue && found.config.encode) {
    return {
      encode: found.config.encode,
      ...(isSchemaNullable(originalSchema) && { nullable: true }),
    };
  }
  return {
    error: getFormatTypeError(
      found.format,
      found.config,
      `operation \`${operationId}\`, path parameter \`${parameterName}\` ${isValue ? 'needs `encode`' : "can't encode it"}`,
    ).message,
  };
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

    const parameter = pathParam.parameter;
    const nameWithoutSanitize = parameter.name;
    const required = parameter.required ?? false;
    const schema = 'schema' in parameter ? parameter.schema : undefined;
    const allowReserved =
      'allowReserved' in parameter ? parameter.allowReserved : false;

    // oxlint-disable-next-line typescript/no-unnecessary-condition
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
    const schemaDefault = !isBooleanJsonSchema(originalSchema)
      ? (originalSchema.default as
          | string
          | Record<string, unknown>
          | unknown[]
          | undefined)
      : undefined;

    let paramType = resolvedValue.value;
    if (output.allParamsOptional) {
      paramType = `${paramType} | undefined | null`; // TODO: maybe check that `paramType` isn't already undefined or null
    }

    // `0`, `false` and `''` are defaults like any other, so the presence of one
    // is a check against `undefined` rather than a truthiness test.
    const hasSchemaDefault = schemaDefault !== undefined;
    // The default of a mapped value is its wire string.
    const defaultFormatType = hasSchemaDefault
      ? resolvedValue.isRef
        ? getModelFormatType(originalSchema, context)
        : getCustomFormatType(originalSchema, context.output.override)
      : undefined;
    if (defaultFormatType && !defaultFormatType.decode) {
      throw getFormatTypeError(
        (originalSchema as OpenApiNonBooleanSchemaObject).format,
        defaultFormatType,
        `operation \`${operationId}\`, path parameter \`${nameWithoutSanitize}\` needs \`decode\` for its default`,
      );
    }
    const defaultValue = defaultFormatType?.decode
      ? callFormatTypeFunction(
          defaultFormatType.decode,
          `${stringify(schemaDefault)}`,
        )
      : stringify(schemaDefault);

    const definition = `${name}${
      !required || hasSchemaDefault ? '?' : ''
    }: ${paramType}`;

    const implementation = `${name}${!required && !hasSchemaDefault ? '?' : ''}${
      hasSchemaDefault ? `: ${paramType} = ${defaultValue}` : `: ${paramType}`
    }`; // FIXME: in Vue if we have `version: MaybeRef<number | undefined | null> = 1` and we don't pass version, the unref(version) will be `undefined` and not `1`, so we need to handle default value somewhere in implementation and not in the definition

    return {
      name,
      definition,
      implementation,
      default: schemaDefault,
      required,
      allowReserved,
      formatTypeEncoding: getFormatTypeEncoding(
        schema,
        resolvedValue,
        nameWithoutSanitize,
        operationId,
        context,
      ),
      imports: resolvedValue.imports,
      originalSchema,
    };
  });
}
