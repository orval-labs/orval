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

type ArrayFormat = GeneratorVerbOptions['override']['fetch']['arrayFormat'];

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

export const getParameterObjects = (
  { verb }: Pick<GeneratorVerbOptions, 'verb'>,
  { context, pathRoute }: Pick<GeneratorOptions, 'context' | 'pathRoute'>,
): OpenApiParameterObject[] => {
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
  return [
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
};

const isArrayLikeParam = (
  parameterObject: OpenApiParameterObject,
  context: GeneratorOptions['context'],
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

export const getExplodeParameters = (
  parameterObjects: OpenApiParameterObject[],
  arrayFormat: ArrayFormat,
  context: GeneratorOptions['context'],
) =>
  parameterObjects.filter(
    (parameterObject): parameterObject is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      isArrayLikeParam(parameterObject, context) &&
      (parameterObject.style ?? 'form') === 'form' &&
      // Respect the OpenAPI default `explode: true` for form-style array query
      // params, but defer params without an explicit `explode` to arrayFormat
      // when an `arrayFormat` override is set.
      (parameterObject.explode ?? true) &&
      !(arrayFormat && parameterObject.explode === undefined),
  );

// Array params where the spec does not explicitly set explode — arrayFormat applies here.
export const getArrayFormatParameters = (
  parameterObjects: OpenApiParameterObject[],
  arrayFormat: ArrayFormat,
  context: GeneratorOptions['context'],
) =>
  arrayFormat
    ? parameterObjects.filter(
        (
          parameterObject,
        ): parameterObject is OpenApiParameterWithSchemaObject =>
          isSchemaParameter(parameterObject) &&
          parameterObject.in === 'query' &&
          isArrayLikeParam(parameterObject, context) &&
          parameterObject.explode === undefined,
      )
    : [];

export const getDeepObjectParameters = (
  parameterObjects: OpenApiParameterObject[],
) =>
  parameterObjects.filter(
    (parameterObject): parameterObject is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      parameterObject.style === 'deepObject',
  );

export const hasDateTimeParameter = (
  parameters: OpenApiParameterObject[],
  context: GeneratorOptions['context'],
) =>
  parameters.some((parameter) => {
    if (!isSchemaParameter(parameter)) {
      return false;
    }

    const { schema } = resolveSchemaRef(parameter.schema, context);
    return schema.format === 'date-time';
  });

export const hasDateTimeProperty = (
  parameters: OpenApiParameterWithSchemaObject[],
  context: GeneratorOptions['context'],
) =>
  parameters.some((parameter) => {
    const { schema } = resolveSchemaRef(parameter.schema, context);

    if (!schema.properties) {
      return false;
    }

    return Object.values(schema.properties).some((prop) => {
      const { schema: propSchema } = resolveSchemaRef(prop, context);
      return propSchema.format === 'date-time';
    });
  });
