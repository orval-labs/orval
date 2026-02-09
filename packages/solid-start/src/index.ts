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
  pascal,
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
  {
    exports: [{ name: 'DeepNonNullable' }],
    dependency: '@orval/core',
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
  { route }: GeneratorOptions,
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

    // Use query for GET requests, action for mutations
    return isGetVerb
      ? `  ${operationName}: query(async (${propsImplementation}) => {${bodyForm}
    return ${mutator.name}<${dataType}>(${axiosConfig});
  }, "${operationName}"),
`
      : `  ${operationName}: action(async (${propsImplementation}) => {${bodyForm}
    return ${mutator.name}<${dataType}>(${axiosConfig});
  }, "${operationName}"),
`;
  }

  const propsImplementation = toObjectString(props, 'implementation');

  // Build query params string
  const queryParamsCode = queryParams
    ? `const queryString = new URLSearchParams(params as any).toString();
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

  // Use query for GET requests, action for mutations (POST, PUT, PATCH, DELETE)
  return isGetVerb
    ? `  ${operationName}: query(async (${propsImplementation}) => {${bodyForm}
    ${queryParamsCode}
    const response = await fetch(url, {
      method: '${verb.toUpperCase()}',
      ${headersCode}
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json() as Promise<${dataType}>;
  }, "${operationName}"),
`
    : `  ${operationName}: action(async (${propsImplementation}) => {${bodyForm}
    ${queryParamsCode}
    const response = await fetch(url, {
      method: '${verb.toUpperCase()}',
      ${headersCode}${bodyCode}
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
