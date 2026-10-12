import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type OpenApiParameterObject,
  type OpenApiParameterWithSchemaObject,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  resolveRef,
  toObjectSchema,
} from '@orval/core';

const resolveSchemaRef = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: GeneratorOptions['context'],
) => {
  if (typeof schema === 'boolean') {
    return { schema: toObjectSchema(schema) };
  }
  const resolved = resolveRef(schema as OpenApiReferenceObject, context) as {
    schema: OpenApiSchemaObject;
  };
  return { schema: toObjectSchema(resolved.schema) };
};

const isSchemaParameter = (
  parameter: OpenApiParameterObject,
): parameter is OpenApiParameterWithSchemaObject => 'schema' in parameter;

export interface QueryParamsAnalysis {
  arrayFormat: GeneratorVerbOptions['override']['fetch']['arrayFormat'];
  explodeParameterNames: string[];
  arrayFormatParameterNames: string[];
  deepObjectParameterNames: string[];
  hasExplodedDateParams: boolean;
  hasArrayFormatDateParams: boolean;
  hasDeepObjectDateParams: boolean;
  hasDateParams: boolean;
  isExplodeParametersOnly: boolean;
}

export const analyzeQueryParams = (
  { verb, override }: Pick<GeneratorVerbOptions, 'verb' | 'override'>,
  { context, pathRoute }: Pick<GeneratorOptions, 'context' | 'pathRoute'>,
): QueryParamsAnalysis => {
  const spec = context.spec.paths?.[pathRoute];
  // `query` is an orval verb, not an OpenAPI path-item method.
  const operation = spec && verb !== 'query' ? spec[verb] : undefined;
  // Path-item-level parameters apply to every operation under the path, and an
  // operation-level parameter with the same name and location overrides them.
  // Same dedup rule as `getParameters` in core.
  const parameters = [
    ...(spec?.parameters ?? []),
    ...(operation?.parameters ?? []),
  ];
  const parameterObjects = [
    ...new Map(
      parameters.map((parameter) => {
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

  const arrayFormat = override.fetch.arrayFormat;

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

  const explodeParameters = parameterObjects.filter(
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
    ? parameterObjects.filter(
        (
          parameterObject,
        ): parameterObject is OpenApiParameterWithSchemaObject =>
          isSchemaParameter(parameterObject) &&
          parameterObject.in === 'query' &&
          isArrayLikeParam(parameterObject) &&
          parameterObject.explode === undefined,
      )
    : [];

  const explodeParameterNames = explodeParameters.map(
    (parameter) => parameter.name,
  );
  const arrayFormatParameterNames = arrayFormatParameters.map(
    (parameter) => parameter.name,
  );

  const hasExplodedDateParams =
    context.output.override.useDates &&
    explodeParameters.some((parameter) => {
      const { schema } = resolveSchemaRef(parameter.schema, context);
      return schema.format === 'date-time';
    });

  const hasArrayFormatDateParams =
    context.output.override.useDates &&
    arrayFormatParameters.some((parameter) => {
      const { schema } = resolveSchemaRef(parameter.schema, context);
      return schema.format === 'date-time';
    });

  const deepObjectParameters = parameterObjects.filter(
    (parameterObject): parameterObject is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      parameterObject.style === 'deepObject',
  );

  const deepObjectParameterNames = deepObjectParameters.map(
    (parameter) => parameter.name,
  );

  const hasDeepObjectDateParams =
    context.output.override.useDates &&
    deepObjectParameters.some((parameter) => {
      const { schema } = resolveSchemaRef(parameter.schema, context);

      if (!schema.properties) {
        return false;
      }

      return Object.values(schema.properties).some((prop) => {
        const { schema: propSchema } = resolveSchemaRef(prop, context);
        return propSchema.format === 'date-time';
      });
    });

  const isExplodeParametersOnly =
    explodeParameters.length +
      arrayFormatParameters.length +
      deepObjectParameters.length ===
    parameterObjects.filter((p) => p.in === 'query').length;

  const hasDateParams =
    context.output.override.useDates &&
    parameterObjects.some((parameter) => {
      if (!isSchemaParameter(parameter)) {
        return false;
      }

      const { schema } = resolveSchemaRef(parameter.schema, context);
      return schema.format === 'date-time';
    });

  return {
    arrayFormat,
    explodeParameterNames,
    arrayFormatParameterNames,
    deepObjectParameterNames,
    hasExplodedDateParams: !!hasExplodedDateParams,
    hasArrayFormatDateParams: !!hasArrayFormatDateParams,
    hasDeepObjectDateParams: !!hasDeepObjectDateParams,
    hasDateParams: !!hasDateParams,
    isExplodeParametersOnly,
  };
};
