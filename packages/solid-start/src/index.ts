import {
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientFooterBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  type ClientTitleBuilder,
  generateBodyOptions,
  generateFormDataAndUrlEncodedFunction,
  generateVerbImports,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getIsBodyVerb,
  isObject,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  pascal,
  resolveRef,
  sanitize,
  toObjectString,
  Verbs,
} from '@orval/core';

const SOLID_START_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'query', values: true },
      { name: 'action', values: true },
      { name: 'cache', values: true },
      { name: 'revalidate', values: true },
    ],
    dependency: '@solidjs/router',
  },
];

export const getSolidStartDependencies: ClientDependenciesBuilder = () =>
  SOLID_START_DEPENDENCIES;

export const generateSolidStartTitle: ClientTitleBuilder = (title) => {
  const sanTitle = sanitize(title);
  return pascal(sanTitle);
};

export const generateSolidStartHeader: ClientHeaderBuilder = ({ title }) => `
/**
 * Cache Invalidation:
 *
 * Each query provides .key and .keyFor() for cache invalidation.
 *
 * Examples:
 *   // Invalidate all calls to a query
 *   revalidate(${title}.listPets.key);
 *
 *   // Invalidate a specific call with arguments
 *   revalidate(${title}.showPetById.keyFor("pet-123", 1));
 *
 *   // Invalidate multiple queries
 *   revalidate([${title}.listPets.key, ${title}.showPetById.keyFor("pet-123", 1)]);
 */
export const ${title} = {
`;

export const generateSolidStartFooter: ClientFooterBuilder = () => {
  return '};\n';
};

const generateImplementation = (
  {
    headers,
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    override,
    formData,
    formUrlEncoded,
  }: GeneratorVerbOptions,
  { route, context, pathRoute }: GeneratorOptions,
) => {
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  const dataType = response.definition.success || 'unknown';
  const isGetVerb = verb === Verbs.GET;
  const isBodyVerb = getIsBodyVerb(verb);

  if (mutator) {
    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(String.raw`(\w*):\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    // Build config object for mutator
    const configParts: string[] = [
      `url: \`${route}\``,
      `method: '${verb.toUpperCase()}'`,
    ];

    // Add params for query parameters
    if (queryParams) {
      configParts.push('params');
    }

    // Add headers
    const ignoreContentTypes = ['multipart/form-data'];
    const overrideHeaders =
      isObject(override.requestOptions) && override.requestOptions.headers
        ? Object.entries(override.requestOptions.headers).map(
            ([key, value]) => `'${key}': \`${value}\``,
          )
        : [];

    const headersToAdd: string[] = [
      ...(body.contentType && !ignoreContentTypes.includes(body.contentType)
        ? [`'Content-Type': '${body.contentType}'`]
        : []),
      ...overrideHeaders,
      ...(headers ? ['...headers'] : []),
    ];

    if (headersToAdd.length > 0) {
      configParts.push(`headers: { ${headersToAdd.join(',')} }`);
    }

    // Add body/data for mutations
    const requestBodyParams = generateBodyOptions(
      body,
      isFormData,
      isFormUrlEncoded,
    );
    if (requestBodyParams) {
      if (
        (isFormData && body.formData) ||
        (isFormUrlEncoded && body.formUrlEncoded)
      ) {
        configParts.push(`data: ${requestBodyParams}`);
      } else {
        configParts.push(`data: ${requestBodyParams}`);
      }
    }

    const axiosConfig = `{
      ${configParts.join(',\n      ')}
    }`;

    const functionName = isGetVerb ? 'query' : 'action';

    return `  ${operationName}: ${functionName}(async (${propsImplementation}) => {${bodyForm}
    return ${mutator.name}<${dataType}>(${axiosConfig});
  }, "${operationName}"),
`;
  }

  const propsImplementation = toObjectString(props, 'implementation');

  // Detect explode parameters from the OpenAPI spec
  // Merge path-item and operation-level parameters per the OpenAPI spec:
  // operation-level parameters override path-level ones with the same (in, name).
  const pathItem = context.spec.paths?.[pathRoute];
  const operation = pathItem?.[verb];
  const mergedParameters = [
    ...(pathItem?.parameters ?? []),
    ...(operation?.parameters ?? []),
  ];
  const byKey = new Map<string, (typeof mergedParameters)[number]>();
  for (const parameter of mergedParameters) {
    const { schema } = resolveRef<OpenApiParameterObject>(parameter, context);
    byKey.set(`${schema.in}:${schema.name}`, parameter);
  }
  const parameters = [...byKey.values()];

  const explodeParameters = parameters.filter((parameter) => {
    const { schema: parameterObject } = resolveRef<OpenApiParameterObject>(
      parameter,
      context,
    );

    if (!parameterObject.schema) {
      return false;
    }

    const { schema: schemaObject } = resolveRef<OpenApiSchemaObject>(
      parameterObject.schema,
      context,
    );

    const isArrayLike =
      schemaObject.type === 'array' ||
      (
        (schemaObject.oneOf as
          | (OpenApiSchemaObject | OpenApiReferenceObject)[]
          | undefined) ?? []
      ).some(
        (s) =>
          resolveRef<OpenApiSchemaObject>(s, context).schema.type === 'array',
      ) ||
      (
        (schemaObject.anyOf as
          | (OpenApiSchemaObject | OpenApiReferenceObject)[]
          | undefined) ?? []
      ).some(
        (s) =>
          resolveRef<OpenApiSchemaObject>(s, context).schema.type === 'array',
      ) ||
      (
        (schemaObject.allOf as
          | (OpenApiSchemaObject | OpenApiReferenceObject)[]
          | undefined) ?? []
      ).some(
        (s) =>
          resolveRef<OpenApiSchemaObject>(s, context).schema.type === 'array',
      );

    return (
      parameterObject.in === 'query' && isArrayLike && parameterObject.explode
    );
  });

  const explodeParametersNames = explodeParameters.map((parameter) => {
    const { schema } = resolveRef<OpenApiParameterObject>(parameter, context);
    return schema.name;
  });

  const hasExplodedDateParams =
    context.output.override.useDates &&
    explodeParameters.some((p) => {
      const { schema: parameterObject } = resolveRef<OpenApiParameterObject>(
        p,
        context,
      );
      if (!parameterObject.schema) {
        return false;
      }
      const { schema: schemaObject } = resolveRef<OpenApiSchemaObject>(
        parameterObject.schema,
        context,
      );
      return (
        schemaObject.format === 'date-time' ||
        (schemaObject.items as { format?: string } | undefined)?.format ===
          'date-time'
      );
    });

  const isExplodeParametersOnly =
    explodeParameters.length === parameters.length;

  const hasDateParams =
    context.output.override.useDates &&
    parameters.some((p) => {
      const { schema: parameterObject } = resolveRef<OpenApiParameterObject>(
        p,
        context,
      );
      if (!parameterObject.schema) {
        return false;
      }
      const { schema: schemaObject } = resolveRef<OpenApiSchemaObject>(
        parameterObject.schema,
        context,
      );
      return (
        schemaObject.format === 'date-time' ||
        (schemaObject.items as { format?: string } | undefined)?.format ===
          'date-time'
      );
    });

  const explodeArrayImplementation =
    explodeParameters.length > 0
      ? `const explodeParameters = ${JSON.stringify(explodeParametersNames)};

      if (Array.isArray(value) && explodeParameters.includes(key)) {
        value.forEach((v) => {
          normalizedParams.append(key, v === null ? 'null' : ${hasExplodedDateParams ? 'v instanceof Date ? v.toISOString() : ' : ''}v.toString());
        });
        return;
      }
        `
      : '';

  const normalParamsImplementation = `if (value !== undefined) {
        normalizedParams.append(key, value === null ? 'null' : ${hasDateParams ? 'value instanceof Date ? value.toISOString() : ' : ''}value.toString())
      }`;

  // Build query params string
  const queryParamsCode = queryParams
    ? `const normalizedParams = new URLSearchParams();

    Object.entries(params || {}).forEach(([key, value]) => {
      ${explodeArrayImplementation}
      ${isExplodeParametersOnly ? '' : normalParamsImplementation}
    });

    const queryString = normalizedParams.toString();
    const url = queryString ? \`${route}?\${queryString}\` : \`${route}\`;`
    : `const url = \`${route}\`;`;

  // Build headers object
  const headersCode = headers
    ? `headers: { ...headers, 'Content-Type': 'application/json' }`
    : `headers: { 'Content-Type': 'application/json' }`;

  // Build body code
  const bodyCode =
    isBodyVerb && body.implementation
      ? `,
      body: JSON.stringify(${body.implementation})`
      : '';

  const functionName = isGetVerb ? 'query' : 'action';
  const fetchBodyPart = isGetVerb ? '' : bodyCode;

  return `  ${operationName}: ${functionName}(async (${propsImplementation}) => {${bodyForm}
    ${queryParamsCode}
    const response = await fetch(url, {
      method: '${verb.toUpperCase()}',
      ${headersCode}${fetchBodyPart}
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json() as Promise<${dataType}>;
  }, "${operationName}"),
`;
};

export const generateSolidStart: ClientBuilder = (verbOptions, options) => {
  const imports = generateVerbImports(verbOptions);
  const implementation = generateImplementation(verbOptions, options);

  return { implementation, imports };
};

const solidStartClientBuilder: ClientGeneratorsBuilder = {
  client: generateSolidStart,
  header: generateSolidStartHeader,
  dependencies: getSolidStartDependencies,
  footer: generateSolidStartFooter,
  title: generateSolidStartTitle,
};

export const builder = () => () => solidStartClientBuilder;

export default builder;
