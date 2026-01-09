import {
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientFooterBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  type ClientTitleBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateVerbImports,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getIsBodyVerb,
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
  return `${pascal(sanTitle)}`;
};

export const generateSolidStartHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
}) => `
${
  isRequestOptions && !isGlobalMutator
    ? `interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}`
    : ''
}

${
  isRequestOptions && isMutator
    ? `type ThirdParameter<T extends (...args: any) => any> = T extends (
  config: any,
  httpClient: any,
  args: infer P,
) => any
  ? P
  : never;`
    : ''
}

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
    paramsSerializer,
  }: GeneratorVerbOptions,
  { route, context }: GeneratorOptions,
) => {
  const isRequestOptions = override.requestOptions !== false;
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
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
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      headers,
      queryParams,
      response,
      verb,
      isFormData,
      isFormUrlEncoded,
      hasSignal: false,
      isExactOptionalPropertyTypes,
    });

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override.requestOptions,
          mutator.hasThirdArg,
        )
      : '';

    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(String.raw`(\w*):\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    if (isGetVerb) {
      // Use query for GET requests
      return `  ${operationName}: query(async (${propsImplementation}) => {${bodyForm}
    return ${mutator.name}<${dataType}>(
      ${mutatorConfig},
      fetch,
      ${requestOptions});
  }, "${operationName}"),
`;
    } else {
      // Use action for mutations
      return `  ${operationName}: action(async (${propsImplementation}) => {${bodyForm}
    return ${mutator.name}<${dataType}>(
      ${mutatorConfig},
      fetch,
      ${requestOptions});
  }, "${operationName}"),
`;
    }
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

  if (isGetVerb) {
    // Use query for GET requests
    return `  ${operationName}: query(async (${propsImplementation}) => {${bodyForm}
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
`;
  } else {
    // Use action for mutations (POST, PUT, PATCH, DELETE)
    return `  ${operationName}: action(async (${propsImplementation}) => {${bodyForm}
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
  }
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
