import {
  camel,
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientFooterBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  type ClientTitleBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  generateAxiosUrl,
  getStatusCodeType,
  HTTP_STATUS_CODE_SHARED_TYPES,
  isSyntheticDefaultImportsAllow,
  GetterPropType,
  needsHttpStatusCodeTypes,
  type NormalizedOverrideOutput,
  pascal,
  sanitize,
  toObjectString,
} from '@orval/core';

const AXIOS_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'axios',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
      { name: 'AxiosRequestConfig' },
      { name: 'AxiosResponse' },
    ],
    dependency: 'axios',
  },
];

const PARAMS_SERIALIZER_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'qs',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
    ],
    dependency: 'qs',
  },
];

const hasHttpResponseReturnType = (override?: NormalizedOverrideOutput) =>
  !!override &&
  [
    override,
    ...Object.values(override.operations),
    ...Object.values(override.tags),
  ].some((entry) => entry?.axios?.includeHttpResponseReturnType);

export const getAxiosDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator,
  hasParamsSerializerOptions: boolean,
  _packageJson,
  _httpClient,
  _hasTagsMutator,
  override,
) => [
  ...(hasGlobalMutator
    ? hasHttpResponseReturnType(override)
      ? [
          {
            exports: [{ name: 'AxiosResponse' }],
            dependency: 'axios',
          },
        ]
      : []
    : AXIOS_DEPENDENCIES),
  ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
];

// Factory mode needs axios default import (for optional parameter default value)
// plus AxiosInstance type for the parameter type
// When using mutator, AxiosInstance is not needed as the mutator handles the axios instance
export const getAxiosFactoryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator,
  hasParamsSerializerOptions: boolean,
  _packageJson,
  _httpClient,
  hasTagsMutator,
  override,
) => [
  {
    exports: [
      {
        name: 'axios',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
      // Only include AxiosInstance if we're not using a mutator (global or tags)
      ...(!hasGlobalMutator && !hasTagsMutator
        ? [{ name: 'AxiosInstance' }]
        : []),
      ...(hasGlobalMutator
        ? hasHttpResponseReturnType(override)
          ? [{ name: 'AxiosResponse' }]
          : []
        : [{ name: 'AxiosRequestConfig' }, { name: 'AxiosResponse' }]),
    ],
    dependency: 'axios',
  },
  ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
];

const getAxiosResponseTypes = (
  response: GeneratorVerbOptions['response'],
  typeName: string,
) => {
  const responseTypeName = `${typeName}Response`;
  const responses = response.types.success.length
    ? response.types.success
    : [
        {
          key: 'default',
          contentType: '',
          value: response.definition.success || 'unknown',
        },
      ];
  const responseKeys = responses.map(({ key }) => key);
  const nonDefaultStatuses = responses
    .filter(({ key }) => key !== 'default')
    .map(({ key }) => getStatusCodeType(key, responseKeys));
  const uniqueNonDefaultStatuses = [...new Set(nonDefaultStatuses)];
  const types = responses.map((entry) => {
    const hasDuplicateStatus =
      responses.filter(({ key }) => key === entry.key).length > 1;
    const name = `${responseTypeName}${pascal(entry.key)}${
      hasDuplicateStatus ? pascal(entry.contentType) : ''
    }`;
    const status =
      entry.key === 'default'
        ? uniqueNonDefaultStatuses.length
          ? `Exclude<HTTPStatusCodes, ${uniqueNonDefaultStatuses.join(' | ')}>`
          : 'number'
        : getStatusCodeType(entry.key, responseKeys);

    return {
      name,
      value: `export type ${name} = AxiosResponse<${entry.value || 'unknown'}> & {
  status: ${status}
}`,
    };
  });

  return {
    name: responseTypeName,
    value: `${types.map(({ value }) => value).join('\n\n')}

export type ${responseTypeName} = ${types.map(({ name }) => name).join(' | ')}`,
  };
};

const getEmptyResponseStatusCondition = (
  response: GeneratorVerbOptions['response'],
) => {
  const statuses = new Set(response.types.success.map(({ key }) => key));
  const exactStatuses = [...statuses].filter((key) => /^[1-5]\d{2}$/.test(key));

  const conditionFor = (key: string) => {
    if (/^[1-5]XX$/i.test(key)) {
      const start = Number(key[0]) * 100;
      const exclusions = exactStatuses
        .filter((status) => status[0] === key[0])
        .map((status) => `response.status !== ${status}`)
        .join(' && ');
      return `response.status >= ${start} && response.status < ${start + 100}${
        exclusions ? ` && ${exclusions}` : ''
      }`;
    }
    return `response.status === ${key}`;
  };

  return [...statuses]
    .filter((key) =>
      response.types.success
        .filter((entry) => entry.key === key)
        .every(({ value }) => value === 'void'),
    )
    .map((key) => {
      if (key === 'default') {
        const declaredConditions = [...statuses]
          .filter((status) => status !== 'default')
          .map(conditionFor);
        return declaredConditions.length
          ? `!(${declaredConditions.join(' || ')})`
          : 'true';
      }
      return `(${conditionFor(key)})`;
    })
    .join(' || ');
};

const normalizeEmptyAxiosResponse = (condition: string) =>
  condition
    ? `.then((response) =>
      ${condition}
        ? { ...response, data: undefined }
        : response,
    )`
    : '';

const generateAxiosImplementation = (
  {
    headers,
    queryParams,
    operationName,
    urlHelperName,
    typeName,
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
  isFactoryMode = false,
) => {
  const isRequestOptions = override.requestOptions !== false;
  const includeHttpResponseReturnType =
    override.axios?.includeHttpResponseReturnType;
  const axiosResponse = getAxiosResponseTypes(response, typeName);
  const emptyResponseNormalization = normalizeEmptyAxiosResponse(
    getEmptyResponseStatusCondition(response),
  );
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;

  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    context.output.tsconfig,
  );

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

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
          mutator.hasSecondArg,
        )
      : '';

    const returnType = (title?: string) =>
      includeHttpResponseReturnType
        ? `${axiosResponse.value}

export type ${pascal(typeName)}Result = ${axiosResponse.name}`
        : `export type ${pascal(typeName)}Result = NonNullable<Awaited<ReturnType<${
            title
              ? `ReturnType<typeof ${title}>['${operationName}']`
              : `typeof ${operationName}`
          }>>>`;

    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(String.raw`(\w*):\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    return {
      implementation: `const ${operationName} = (\n    ${propsImplementation}\n ${
        isRequestOptions && mutator.hasSecondArg
          ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<typeof ${mutator.name}<${response.definition.success || 'unknown'}>>,`
          : ''
      }) => {${bodyForm}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
      ${mutatorConfig},
      ${requestOptions})${includeHttpResponseReturnType ? ` as Promise<${axiosResponse.name}>` : ''};
    }
  `,
      returnType,
    };
  }

  const options = generateOptions({
    route,
    body,
    headers,
    queryParams,
    response,
    verb,
    requestOptions: override.requestOptions,
    isFormData,
    isFormUrlEncoded,
    paramsSerializer,
    paramsSerializerOptions: override.paramsSerializerOptions,
    isExactOptionalPropertyTypes,
    hasSignal: false,
  });

  const returnType = () =>
    includeHttpResponseReturnType
      ? `${axiosResponse.value}

export type ${pascal(typeName)}Result = ${axiosResponse.name}`
      : `export type ${pascal(typeName)}Result = AxiosResponse<${
          response.definition.success || 'unknown'
        }>`;

  // In factory mode, use the axiosInstance parameter
  // In functions mode with global import, .default may be needed based on tsconfig
  const axiosRef = isFactoryMode
    ? 'axiosInstance'
    : `axios${isSyntheticDefaultImportsAllowed ? '' : '.default'}`;

  const urlProps = props.filter(
    (prop) =>
      prop.type === GetterPropType.PARAM ||
      prop.type === GetterPropType.NAMED_PATH_PARAMS ||
      prop.type === GetterPropType.QUERY_PARAM,
  );
  const urlImplementation = generateAxiosUrl({
    functionName: urlHelperName ?? camel(`get-${operationName}-url`),
    propsImplementation: toObjectString(urlProps, 'implementation'),
    route,
    axiosRef,
    hasQueryParams: !!queryParams,
    paramsSerializer: paramsSerializer?.name,
    paramsSerializerOptions: override.paramsSerializerOptions,
  });

  return {
    implementation: `const ${operationName} = (\n    ${toObjectString(props, 'implementation')} ${
      isRequestOptions
        ? `options${context.output.optionsParamRequired ? '' : '?'}: AxiosRequestConfig\n`
        : ''
    } ): Promise<${includeHttpResponseReturnType ? axiosResponse.name : `AxiosResponse<${response.definition.success || 'unknown'}>`}> => {${bodyForm}
    return ${axiosRef}.${verb}(${options})${includeHttpResponseReturnType ? emptyResponseNormalization + ` as Promise<${axiosResponse.name}>` : ''};
  }
${isFactoryMode ? urlImplementation.replace(/^export /, '') : urlImplementation}`,
    returnType,
  };
};

export const generateAxiosTitle: ClientTitleBuilder = (title) => {
  const sanTitle = sanitize(title);
  return `get${pascal(sanTitle)}`;
};

// Header for factory mode - axios is optional parameter with default value
// When using mutator (global or tags-level), axiosInstance parameter is not needed
export const generateAxiosHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  noFunction,
  output,
  verbOptions,
}) => {
  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    output.tsconfig,
  );
  const axiosDefault = isSyntheticDefaultImportsAllowed
    ? 'axios'
    : 'axios.default';

  // Check if any operation uses a mutator (either global or tags-level)
  const hasAnyMutator =
    isGlobalMutator ||
    Object.values(verbOptions).some((verbOption) => !!verbOption.mutator);

  const implementation = `
${
  isRequestOptions && isMutator
    ? `type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];\n\n`
    : ''
}
  ${noFunction ? '' : hasAnyMutator ? `export const ${title} = () => {\n` : `export const ${title} = (axiosInstance: AxiosInstance = ${axiosDefault}) => {\n`}`;
  const hasStatusCodeTypes = Object.values(verbOptions).some(
    (verbOption) =>
      verbOption.override?.axios?.includeHttpResponseReturnType &&
      needsHttpStatusCodeTypes(
        getAxiosResponseTypes(verbOption.response, verbOption.typeName).value,
      ),
  );

  return hasStatusCodeTypes
    ? {
        implementation,
        sharedTypes: HTTP_STATUS_CODE_SHARED_TYPES,
      }
    : implementation;
};

export const generateAxiosFooter: ClientFooterBuilder = ({
  operationNames,
  operations,
  title,
  noFunction,
  hasMutator,
  hasAwaitedType,
}) => {
  let footer = '';

  if (!noFunction) {
    const urlOperationNames = (operations ?? [])
      .filter((operation) => !operation.mutator)
      .map(
        (operation) =>
          operation.urlHelperName ??
          camel(`get-${operation.operationName}-url`),
      );
    footer += `return {${[...operationNames, ...urlOperationNames].join(',')}}};\n`;
  }

  if (hasMutator && !hasAwaitedType) {
    footer += `\ntype AwaitedInput<T> = PromiseLike<T> | T;\n
    type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
\n`;
  }

  if (operations) {
    for (const operation of operations) {
      if (operation.types?.result) {
        footer += operation.types.result(noFunction ? undefined : title) + '\n';
      }
    }
  }

  return footer;
};

export const generateAxios = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
  isFactoryMode = false,
) => {
  const imports = generateVerbImports(verbOptions);
  const { implementation, returnType } = generateAxiosImplementation(
    verbOptions,
    options,
    isFactoryMode,
  );

  return { implementation, imports, returnType };
};

// Factory mode generator - axios is optional parameter
export const generateAxiosFactory: ClientBuilder = (verbOptions, options) => {
  const { implementation, imports, returnType } = generateAxios(
    verbOptions,
    options,
    true,
  );
  return { implementation, imports, returnType };
};

export const generateAxiosFunctions: ClientBuilder = (verbOptions, options) => {
  const { implementation, imports, returnType } = generateAxios(
    verbOptions,
    options,
  );

  return {
    implementation: 'export ' + implementation,
    imports,
    returnType,
  };
};

// axios client with factory pattern (axios as optional parameter)
const axiosClientBuilder: ClientGeneratorsBuilder = {
  client: generateAxiosFactory,
  header: generateAxiosHeader,
  dependencies: getAxiosFactoryDependencies,
  footer: generateAxiosFooter,
  title: generateAxiosTitle,
};

const axiosFunctionsClientBuilder: ClientGeneratorsBuilder = {
  client: generateAxiosFunctions,
  header: (options) => generateAxiosHeader({ ...options, noFunction: true }),
  dependencies: getAxiosDependencies,
  footer: (options) => generateAxiosFooter({ ...options, noFunction: true }),
  title: generateAxiosTitle,
};

export interface AxiosBuilderOptions {
  type?: 'axios' | 'axios-functions';
}

export const builder =
  ({ type = 'axios-functions' }: AxiosBuilderOptions = {}) =>
  () => {
    if (type === 'axios-functions') {
      return axiosFunctionsClientBuilder;
    }
    return axiosClientBuilder;
  };

export default builder;
