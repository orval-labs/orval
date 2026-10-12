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

export interface QueryParamSerialization {
  /**
   * The operation's parameters, path-item-level ones first, deduplicated so an
   * operation-level parameter overrides a path-item-level one with the same
   * name and location.
   */
  parameters: OpenApiParameterObject[];
  /** Array query params serialized as repeated keys (`form` + `explode`). */
  explode: OpenApiParameterWithSchemaObject[];
  /** Array query params without an explicit `explode`, left to `arrayFormat`. */
  arrayFormat: OpenApiParameterWithSchemaObject[];
  /** Query params with `style: deepObject`. */
  deepObject: OpenApiParameterWithSchemaObject[];
  /**
   * Every query param is in `explode`, `arrayFormat` or `deepObject`, so the
   * generated URL helpers drop values that none of them handle.
   */
  explodeOnly: boolean;
}

export const isSchemaParameter = (
  parameter: OpenApiParameterObject,
): parameter is OpenApiParameterWithSchemaObject => 'schema' in parameter;

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
 * How an operation's query params are serialized into its URL, as the fetch
 * client's `get<Op>Url` does it. Reads the parameters from the spec rather
 * than from `verbOptions.queryParams`, which only carries the generated type.
 *
 * @param arrayFormat The fetch client's `override.fetch.arrayFormat`. When set,
 * array params without an explicit `explode` use it instead of the OpenAPI
 * default.
 */
export function getQueryParamSerialization(
  { pathRoute, verb }: Pick<GeneratorVerbOptions, 'pathRoute' | 'verb'>,
  context: ContextSpec,
  arrayFormat?: QueryArrayFormat,
): QueryParamSerialization {
  const spec = context.spec.paths?.[pathRoute];
  // `query` is an orval verb, not an OpenAPI path-item method.
  const operation = spec && verb !== 'query' ? spec[verb] : undefined;
  // Path-item-level parameters apply to every operation under the path, and an
  // operation-level parameter with the same name and location overrides them.
  // Same dedup rule as `getParameters`.
  const declared = [
    ...(spec?.parameters ?? []),
    ...(operation?.parameters ?? []),
  ];
  const parameters = [
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

  const isArrayLikeParam = (parameterObject: OpenApiParameterObject) => {
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

  const explode = parameters.filter(
    (parameterObject): parameterObject is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      isArrayLikeParam(parameterObject) &&
      (parameterObject.style ?? 'form') === 'form' &&
      // Respect the OpenAPI default `explode: true` for form-style array query
      // params, but defer params without an explicit `explode` to arrayFormat
      // when an `arrayFormat` override is set.
      (parameterObject.explode ?? true) &&
      !(arrayFormat && parameterObject.explode === undefined),
  );

  // Array params where the spec does not explicitly set explode — arrayFormat applies here.
  const arrayFormatParameters = arrayFormat
    ? parameters.filter(
        (
          parameterObject,
        ): parameterObject is OpenApiParameterWithSchemaObject =>
          isSchemaParameter(parameterObject) &&
          parameterObject.in === 'query' &&
          isArrayLikeParam(parameterObject) &&
          parameterObject.explode === undefined,
      )
    : [];

  const deepObject = parameters.filter(
    (parameterObject): parameterObject is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      parameterObject.style === 'deepObject',
  );

  const explodeOnly =
    explode.length + arrayFormatParameters.length + deepObject.length ===
    parameters.filter((p) => p.in === 'query').length;

  return {
    parameters,
    explode,
    arrayFormat: arrayFormatParameters,
    deepObject,
    explodeOnly,
  };
}
