import { resolveRef } from '../resolvers';
import type {
  ContextSpec,
  GeneratorVerbOptions,
  OpenApiParameterObject,
  OpenApiParameterWithSchemaObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { toObjectSchema } from '../utils';

export type QueryArrayFormat = 'repeat' | 'brackets' | 'comma';

/** Whether the parameter declares a `schema` (rather than `content`). */
export const isSchemaParameter = (
  parameter: OpenApiParameterObject,
): parameter is OpenApiParameterWithSchemaObject => 'schema' in parameter;

/** Resolves a schema `$ref` and normalizes a boolean schema to an object. */
const resolveSchemaRef = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
) => {
  if (typeof schema === 'boolean') {
    return { schema: toObjectSchema(schema) };
  }
  const resolved = resolveRef(schema as OpenApiReferenceObject, context) as {
    schema: OpenApiSchemaObject;
  };
  return { schema: toObjectSchema(resolved.schema) };
};

/**
 * The operation's parameters, path-item-level ones first, deduplicated so an
 * operation-level parameter overrides a path-item-level one with the same
 * name and location. Reads the spec rather than `verbOptions.queryParams`,
 * which only carries the generated type.
 */
export function getOperationParameters(
  { pathRoute, verb }: Pick<GeneratorVerbOptions, 'pathRoute' | 'verb'>,
  context: ContextSpec,
): OpenApiParameterObject[] {
  const spec = context.spec.paths?.[pathRoute];
  // `query` is an orval verb, not an OpenAPI path-item method.
  const operation = spec && verb !== 'query' ? spec[verb] : undefined;
  // Same dedup rule as `getParameters`.
  const declared = [
    ...(spec?.parameters ?? []),
    ...(operation?.parameters ?? []),
  ];
  return [
    ...new Map(
      declared.map((parameter) => {
        const { schema } = resolveRef(parameter, context);
        const parameterObject = schema as OpenApiParameterObject;
        return [
          // oxlint-disable-next-line typescript/no-unnecessary-condition
          `${parameterObject.in}:${parameterObject.in === 'header' ? parameterObject.name?.toLowerCase() : parameterObject.name}`,
          parameterObject,
        ] as const;
      }),
    ).values(),
  ];
}

const isArrayLikeParam = (
  parameterObject: OpenApiParameterObject,
  context: ContextSpec,
) => {
  if (!isSchemaParameter(parameterObject)) return false;
  const { schema: schemaObject } = resolveSchemaRef(
    parameterObject.schema,
    context,
  );
  const compositionIncludesArray = (
    members: readonly (OpenApiSchemaObject | OpenApiReferenceObject)[] = [],
  ) =>
    members.some(
      (member) => resolveSchemaRef(member, context).schema.type === 'array',
    );
  return (
    schemaObject.type === 'array' ||
    compositionIncludesArray(schemaObject.oneOf) ||
    compositionIncludesArray(schemaObject.anyOf) ||
    compositionIncludesArray(schemaObject.allOf)
  );
};

/**
 * Array query params serialized as repeated keys (`form` + `explode`).
 *
 * @param arrayFormat The fetch client's `override.fetch.arrayFormat`. When set,
 * array params without an explicit `explode` are left to it instead of the
 * OpenAPI default.
 */
export const getExplodeParameters = (
  parameters: OpenApiParameterObject[],
  context: ContextSpec,
  arrayFormat?: QueryArrayFormat,
) =>
  parameters.filter(
    (parameterObject): parameterObject is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      isArrayLikeParam(parameterObject, context) &&
      (parameterObject.style ?? 'form') === 'form' &&
      (parameterObject.explode ?? true) &&
      !(arrayFormat && parameterObject.explode === undefined),
  );

/** Array query params without an explicit `explode`, serialized per `arrayFormat`. */
export const getArrayFormatParameters = (
  parameters: OpenApiParameterObject[],
  context: ContextSpec,
  arrayFormat?: QueryArrayFormat,
) =>
  arrayFormat
    ? parameters.filter(
        (
          parameterObject,
        ): parameterObject is OpenApiParameterWithSchemaObject =>
          isSchemaParameter(parameterObject) &&
          parameterObject.in === 'query' &&
          isArrayLikeParam(parameterObject, context) &&
          parameterObject.explode === undefined,
      )
    : [];

/** Query params with `style: deepObject`. */
export const getDeepObjectParameters = (parameters: OpenApiParameterObject[]) =>
  parameters.filter(
    (parameterObject): parameterObject is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      parameterObject.style === 'deepObject',
  );

/**
 * Whether every query param falls into one of the serialized groups, so the
 * generated URL helpers drop values that none of them handle.
 */
export const isExplodeOnly = (
  parameters: OpenApiParameterObject[],
  ...serialized: OpenApiParameterObject[][]
) =>
  serialized.reduce((count, group) => count + group.length, 0) ===
  parameters.filter((parameter) => parameter.in === 'query').length;
