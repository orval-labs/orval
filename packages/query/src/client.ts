import {
  camel,
  type ClientHeaderBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  getFileInfo,
  type GeneratorDependency,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GetterProp,
  GetterPropType,
  type GetterResponse,
  isSyntheticDefaultImportsAllow,
  kebab,
  ModelStyle,
  type NormalizedOutputOptions,
  OutputClient,
  OutputHttpClient,
  pascal,
  toObjectString,
  upath,
  type OutputClientFunc,
} from '@orval/core';
import {
  generateFetchHeader,
  generateRequestFunction as generateFetchRequestFunction,
} from '@orval/fetch';

import {
  getHasSignal,
  makeRouteSafe,
  vueUnRefParams,
  vueWrapTypeWithMaybeRef,
} from './utils';

// Helper function to generate module specifier for zod imports
const generateModuleSpecifier = (from: string, to: string) => {
  if (to.startsWith('.') || upath.isAbsolute(to)) {
    let ret: string;
    ret = upath.relativeSafe(upath.dirname(from), to);
    ret = ret.replace(/\.ts$/, '');
    ret = ret.replaceAll(upath.separator, '/');
    if (!ret.startsWith('.')) {
      ret = './' + ret;
    }
    return ret;
  }

  return to;
};

export const AXIOS_DEPENDENCIES: GeneratorDependency[] = [
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
      { name: 'AxiosError' },
    ],
    dependency: 'axios',
  },
];

export const generateQueryRequestFunction = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
  isVue: boolean,
  outputClient?: OutputClient | OutputClientFunc,
) => {
  return options.context.output.httpClient === OutputHttpClient.AXIOS
    ? generateAxiosRequestFunction(verbOptions, options, isVue, outputClient)
    : generateFetchRequestFunction(verbOptions, options);
};

export const generateAxiosRequestFunction = (
  verbOptions: GeneratorVerbOptions,
  { route: _route, context }: GeneratorOptions,
  isVue: boolean,
  outputClient?: OutputClient | OutputClientFunc,
) => {
  // Check if we need zod validation - define early to avoid initialization errors
  const isZodModelStyle = context.output.modelStyle === ModelStyle.ZOD;

  const {
    headers,
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props: _props,
    verb,
    formData,
    formUrlEncoded,
    override,
    paramsSerializer,
    params,
  } = verbOptions;
  let props = _props;
  let route = _route;

  if (isVue) {
    props = vueWrapTypeWithMaybeRef(_props);
  }

  if (context.output?.urlEncodeParameters) {
    route = makeRouteSafe(route);
  }

  const isRequestOptions = override.requestOptions !== false;
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const hasSignal = getHasSignal({
    overrideQuerySignal: override.query.signal,
    verb,
  });

  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;

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
      hasSignal,
      isExactOptionalPropertyTypes,
      isVue,
    });

    const bodyDefinition = body.definition.replace('[]', String.raw`\[\]`);
    const propsImplementation =
      mutator?.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(`(\\w*):\\s?${bodyDefinition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    if (mutator.isHook) {
      const ret = `${
        override.query.shouldExportMutatorHooks ? 'export ' : ''
      }const use${pascal(operationName)}Hook = () => {
        const ${operationName} = ${mutator.name}<${
          response.definition.success || 'unknown'
        }>();

        return useCallback((\n    ${propsImplementation}\n ${
          isRequestOptions && mutator.hasSecondArg
            ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<ReturnType<typeof ${mutator.name}>>,`
            : ''
        }${hasSignal ? 'signal?: AbortSignal\n' : ''}) => {${bodyForm}
        return ${operationName}(
          ${mutatorConfig},
          ${requestOptions});
        }, [${operationName}])
      }
    `;

      const vueRet = `${
        override.query.shouldExportMutatorHooks ? 'export ' : ''
      }const use${pascal(operationName)}Hook = () => {
        const ${operationName} = ${mutator.name}<${
          response.definition.success || 'unknown'
        }>();

        return (\n    ${propsImplementation}\n ${
          isRequestOptions && mutator.hasSecondArg
            ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<ReturnType<typeof ${mutator.name}>>,`
            : ''
        }${hasSignal ? 'signal?: AbortSignal\n' : ''}) => {${bodyForm}
        return ${operationName}(
          ${mutatorConfig},
          ${requestOptions});
        }
      }
    `;

      return isVue ? vueRet : ret;
    }

    return `${override.query.shouldExportHttpClient ? 'export ' : ''}const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<typeof ${mutator.name}>,`
        : ''
    }${hasSignal ? 'signal?: AbortSignal\n' : ''}) => {
      ${isVue ? vueUnRefParams(props) : ''}
      ${bodyForm}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
      ${mutatorConfig},
      ${requestOptions});
    }
  `;
  }

  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    context.output.tsconfig,
  );

  const options = generateOptions({
    route,
    body,
    headers,
    queryParams,
    response,
    verb,
    requestOptions: override?.requestOptions,
    isFormData,
    isFormUrlEncoded,
    paramsSerializer,
    paramsSerializerOptions: override?.paramsSerializerOptions,
    isExactOptionalPropertyTypes,
    hasSignal,
    isVue: isVue,
  });

  const optionsArgs = generateRequestOptionsArguments({
    isRequestOptions,
    hasSignal,
  });

  // For zod model style, prepare validation code and update imports
  let zodPreValidationCode = '';
  let zodPostValidationCode = '';

  if (isZodModelStyle) {
    const { extension, dirname, filename } = getFileInfo(context.output.target);

    // Calculate zod file path based on mode
    let zodImportPath = '';
    if (context.output.mode === 'single') {
      zodImportPath = generateModuleSpecifier(
        context.output.target,
        upath.join(dirname, `${filename}.zod${extension}`),
      );
    } else if (context.output.mode === 'split') {
      zodImportPath = generateModuleSpecifier(
        context.output.target,
        upath.join(dirname, `${operationName}.zod${extension}`),
      );
    } else if (
      context.output.mode === 'tags' ||
      context.output.mode === 'tags-split'
    ) {
      const tag = verbOptions.tags?.[0] || '';
      const tagName = kebab(tag);
      zodImportPath =
        context.output.mode === 'tags'
          ? generateModuleSpecifier(
              context.output.target,
              upath.join(dirname, `${tagName}.zod${extension}`),
            )
          : generateModuleSpecifier(
              context.output.target,
              upath.join(dirname, tag, `${tag}.zod${extension}`),
            );
    }

    // Remove .ts extension for import path
    zodImportPath = zodImportPath.replace(/\.ts$/, '');

    if (zodImportPath) {
      // Build zod schema names for validation
      const responseCode = context.output.override.zod.generateEachHttpStatus
        ? '200'
        : '';
      const responseSchemaName = camel(
        `${operationName}-${responseCode}-response`,
      );
      const zodSchemaNames = {
        params: params.length > 0 ? `${operationName}Params` : null,
        queryParams: queryParams ? `${operationName}QueryParams` : null,
        body: body.definition ? `${operationName}Body` : null,
        response: responseSchemaName,
      };

      // Update imports to point to zod files and add schema imports for validation
      // Response imports
      verbOptions.response.imports.forEach((imp) => {
        imp.specKey = zodImportPath;
      });
      if (zodSchemaNames.response) {
        verbOptions.response.imports.push({
          name: zodSchemaNames.response,
          values: true,
          specKey: zodImportPath,
        });
      }

      // Body imports
      verbOptions.body.imports.forEach((imp) => {
        imp.specKey = zodImportPath;
      });
      if (zodSchemaNames.body) {
        verbOptions.body.imports.push({
          name: zodSchemaNames.body,
          values: true,
          specKey: zodImportPath,
        });
      }

      // QueryParams imports
      if (queryParams) {
        const queryParamsTypeName = queryParams.schema.name.replace(
          /Params$/,
          'QueryParams',
        );
        verbOptions.queryParams.schema.imports.forEach((imp) => {
          if (imp.name === queryParams.schema.name) {
            imp.name = queryParamsTypeName;
          }
          imp.specKey = zodImportPath;
        });
        // Ensure QueryParams type is imported
        if (
          !verbOptions.queryParams.schema.imports.some(
            (imp) => imp.name === queryParamsTypeName,
          )
        ) {
          verbOptions.queryParams.schema.imports.push({
            name: queryParamsTypeName,
            specKey: zodImportPath,
          });
        }
        // Add schema import for validation
        if (zodSchemaNames.queryParams) {
          verbOptions.queryParams.schema.imports.push({
            name: zodSchemaNames.queryParams,
            values: true,
            specKey: zodImportPath,
          });
        }
      }

      // Params (path parameters) imports
      if (params.length > 0) {
        params.forEach((param) => {
          param.imports.forEach((imp) => {
            imp.specKey = zodImportPath;
          });
          // Add schema import for validation if params schema exists
          if (zodSchemaNames.params) {
            param.imports.push({
              name: zodSchemaNames.params,
              values: true,
              specKey: zodImportPath,
            });
          }
        });
      }

      // Build validation code
      const validations: string[] = [];

      // Validate params (path parameters)
      if (zodSchemaNames.params && params.length > 0) {
        const paramNames = params
          .map((p: { name: string }) => p.name)
          .join(', ');
        validations.push(`${zodSchemaNames.params}.parse({ ${paramNames} });`);
      }

      // Validate query params
      if (zodSchemaNames.queryParams && queryParams) {
        validations.push(`${zodSchemaNames.queryParams}.parse(params);`);
      }

      // Validate body
      if (zodSchemaNames.body && body.definition) {
        const bodyProp = props.find(
          (p: { type: string }) => p.type === GetterPropType.BODY,
        );
        if (bodyProp) {
          validations.push(
            `${bodyProp.name} = ${zodSchemaNames.body}.parse(${bodyProp.name});`,
          );
        }
      }

      if (validations.length > 0) {
        zodPreValidationCode = `\n    ${validations.join('\n    ')}\n    `;
      }

      // Post-validation code (after HTTP request)
      if (zodSchemaNames.response) {
        zodPostValidationCode = `\n    const validatedResponse = ${zodSchemaNames.response}.parse(response.data);\n    return { ...response, data: validatedResponse };`;
      }
    }
  }

  const hasZodValidation = !!zodPostValidationCode;

  // For zod model style, use QueryParams type from zod file
  // The zod file exports QueryParams type (e.g., LookupDealUrgencyListQueryParams)
  if (isZodModelStyle && queryParams) {
    const queryParamsTypeName = queryParams.schema.name.replace(
      /Params$/,
      'QueryParams',
    );
    props = props.map((prop: GetterProp) => {
      if (prop.type === GetterPropType.QUERY_PARAM) {
        const optionalMarker = prop.definition.includes('?') ? '?' : '';
        return {
          ...prop,
          definition: `params${optionalMarker}: ${queryParamsTypeName}`,
          implementation: `params${optionalMarker}: ${queryParamsTypeName}`,
        };
      }
      return prop;
    });
  }

  const queryProps = toObjectString(props, 'implementation');

  // Use type names from response - they will be imported from zod files for zod model style
  const responseType = response.definition.success || 'unknown';

  const httpRequestFunctionImplementation = `${override.query.shouldExportHttpClient ? 'export ' : ''}const ${operationName} = ${hasZodValidation ? 'async ' : ''}(\n    ${queryProps} ${optionsArgs} ): Promise<AxiosResponse<${responseType}>> => {
    ${isVue ? vueUnRefParams(props) : ''}${zodPreValidationCode}${hasZodValidation ? '' : bodyForm}
    ${
      hasZodValidation
        ? `const response = await axios${
            isSyntheticDefaultImportsAllowed ? '' : '.default'
          }.${verb}(${options});${zodPostValidationCode}`
        : `return axios${
            isSyntheticDefaultImportsAllowed ? '' : '.default'
          }.${verb}(${options});`
    }
  }
`;

  return httpRequestFunctionImplementation;
};

export const generateRequestOptionsArguments = ({
  isRequestOptions,
  hasSignal,
}: {
  isRequestOptions: boolean;
  hasSignal: boolean;
}) => {
  if (isRequestOptions) {
    return 'options?: AxiosRequestConfig\n';
  }

  return hasSignal ? 'signal?: AbortSignal\n' : '';
};

export const getQueryArgumentsRequestType = (
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  if (!mutator) {
    return httpClient === OutputHttpClient.AXIOS
      ? `axios?: AxiosRequestConfig`
      : 'fetch?: RequestInit';
  }

  if (mutator.hasSecondArg && !mutator.isHook) {
    return `request?: SecondParameter<typeof ${mutator.name}>`;
  }

  if (mutator.hasSecondArg && mutator.isHook) {
    return `request?: SecondParameter<ReturnType<typeof ${mutator.name}>>`;
  }

  return '';
};

export const getQueryOptions = ({
  isRequestOptions,
  mutator,
  isExactOptionalPropertyTypes,
  hasSignal,
  httpClient,
}: {
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  httpClient: OutputHttpClient;
}) => {
  if (!mutator && isRequestOptions) {
    const options =
      httpClient === OutputHttpClient.AXIOS ? 'axiosOptions' : 'fetchOptions';

    if (!hasSignal) {
      return options;
    }

    return `{ ${
      isExactOptionalPropertyTypes ? '...(signal ? { signal } : {})' : 'signal'
    }, ...${options} }`;
  }

  if (mutator?.hasSecondArg && isRequestOptions) {
    if (!hasSignal) {
      return 'requestOptions';
    }

    return httpClient === OutputHttpClient.AXIOS
      ? 'requestOptions, signal'
      : '{ signal, ...requestOptions }';
  }

  if (hasSignal) {
    return 'signal';
  }

  return '';
};

export const getHookOptions = ({
  isRequestOptions,
  httpClient,
  mutator,
}: {
  isRequestOptions: boolean;
  httpClient: OutputHttpClient;
  mutator?: GeneratorMutator;
}) => {
  if (!isRequestOptions) {
    return '';
  }

  let value = 'const {query: queryOptions';

  if (!mutator) {
    const options =
      httpClient === OutputHttpClient.AXIOS
        ? ', axios: axiosOptions'
        : ', fetch: fetchOptions';

    value += options;
  }

  if (mutator?.hasSecondArg) {
    value += ', request: requestOptions';
  }

  value += '} = options ?? {};';

  return value;
};

// Helper to deduplicate union type string: "A | B | B" -> "A | B"
const dedupeUnionTypes = (types: string): string => {
  if (!types) return types;
  // Split by '|', trim spaces, filter out empty, and dedupe using a Set
  const unique = [
    ...new Set(
      types
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
  return unique.join(' | ');
};

export const getQueryErrorType = (
  operationName: string,
  response: GetterResponse,
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  const errorsType = dedupeUnionTypes(response.definition.errors || 'unknown');

  if (mutator) {
    return mutator.hasErrorType
      ? `${mutator.default ? pascal(operationName) : ''}ErrorType<${errorsType}>`
      : errorsType;
  } else {
    return httpClient === OutputHttpClient.AXIOS
      ? `AxiosError<${errorsType}>`
      : errorsType;
  }
};

export const getHooksOptionImplementation = (
  isRequestOptions: boolean,
  httpClient: OutputHttpClient,
  operationName: string,
  mutator?: GeneratorMutator,
) => {
  const options =
    httpClient === OutputHttpClient.AXIOS
      ? ', axios: axiosOptions'
      : ', fetch: fetchOptions';

  return isRequestOptions
    ? `const mutationKey = ['${operationName}'];
const {mutation: mutationOptions${
        mutator
          ? mutator?.hasSecondArg
            ? ', request: requestOptions'
            : ''
          : options
      }} = options ?
      options.mutation && 'mutationKey' in options.mutation && options.mutation.mutationKey ?
      options
      : {...options, mutation: {...options.mutation, mutationKey}}
      : {mutation: { mutationKey, }${mutator?.hasSecondArg ? ', request: undefined' : ''}${mutator ? '' : httpClient === OutputHttpClient.AXIOS ? ', axios: undefined' : ', fetch: undefined'}};`
    : '';
};

export const getMutationRequestArgs = (
  isRequestOptions: boolean,
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  const options =
    httpClient === OutputHttpClient.AXIOS ? 'axiosOptions' : 'fetchOptions';

  return isRequestOptions
    ? mutator
      ? mutator?.hasSecondArg
        ? 'requestOptions'
        : ''
      : options
    : '';
};

export const getHttpFunctionQueryProps = (
  isVue: boolean,
  httpClient: OutputHttpClient,
  queryProperties: string,
) => {
  if (isVue && httpClient === OutputHttpClient.FETCH && queryProperties) {
    return queryProperties
      .split(',')
      .map((prop) => `unref(${prop})`)
      .join(',');
  }

  return queryProperties;
};

export const getQueryHeader: ClientHeaderBuilder = (params: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  noFunction?: boolean;
  isGlobalMutator: boolean;
  provideIn: boolean | 'root' | 'any';
  hasAwaitedType: boolean;
  output: NormalizedOutputOptions;
  verbOptions: Record<string, GeneratorVerbOptions>;
  tag?: string;
  clientImplementation: string;
}) => {
  return params.output.httpClient === OutputHttpClient.FETCH
    ? generateFetchHeader(params)
    : '';
};
