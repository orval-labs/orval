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
  const isReactQueryZod = outputClient === OutputClient.REACT_QUERY_ZOD;

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

  // Get zod schema import path and schema names if needed
  let zodPreValidationCode = '';
  let zodPostValidationCode = '';
  let zodSchemaPath = '';
  let zodSchemaNames: string[] = [];

  if (isReactQueryZod) {
    const { extension, dirname, filename } = getFileInfo(context.output.target);

    if (context.output.mode === 'single') {
      zodSchemaPath = generateModuleSpecifier(
        context.output.target,
        upath.join(dirname, `${filename}.zod${extension}`),
      );
    } else if (context.output.mode === 'split') {
      // In split mode, zod files are generated in the same directory as endpoints.ts
      zodSchemaPath = generateModuleSpecifier(
        context.output.target,
        upath.join(dirname, `${operationName}.zod${extension}`),
      );
    } else if (
      context.output.mode === 'tags' ||
      context.output.mode === 'tags-split'
    ) {
      const tag = verbOptions.tags?.[0] || '';
      const tagName = kebab(tag);
      zodSchemaPath =
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

    // Build zod schema names - note: response schema name depends on status code
    // When generateEachHttpStatus is false (default), responses array has [['', response200]]
    // So the response name is: camel(`${operationName}--response`) = `${operationName}Response`
    // When generateEachHttpStatus is true, response name is: camel(`${operationName}-200-response`) = `${operationName}200Response`
    // For default case, code is empty string '', so we use: `${operationName}Response`
    const responseCode = context.output.override.zod.generateEachHttpStatus
      ? '200'
      : '';
    const responseSchemaName = camel(
      `${operationName}-${responseCode}-response`,
    );
    const schemaNames = {
      params: params.length > 0 ? `${operationName}Params` : null,
      queryParams: queryParams ? `${operationName}QueryParams` : null,
      body: body.definition ? `${operationName}Body` : null,
      response: responseSchemaName,
    };
    
    // Store schemaNames for later use (even if zod validation is not used)
    (verbOptions as any).__zodSchemaNamesMap = schemaNames;

    // Build imports
    const zodSchemaImports: string[] = [];
    if (schemaNames.params) zodSchemaImports.push(schemaNames.params);
    if (schemaNames.queryParams) zodSchemaImports.push(schemaNames.queryParams);
    if (schemaNames.body) zodSchemaImports.push(schemaNames.body);
    if (schemaNames.response) zodSchemaImports.push(schemaNames.response);

    if (zodSchemaImports.length > 0 && zodSchemaPath) {
      zodSchemaNames = zodSchemaImports;

      // Build pre-validation code (before HTTP request)
      const validations: string[] = [];

      // Validate params (path parameters)
      if (schemaNames.params && params.length > 0) {
        const paramNames = params
          .map((p: { name: string }) => p.name)
          .join(', ');
        validations.push(`${schemaNames.params}.parse({ ${paramNames} });`);
      }

      // Validate query params
      if (schemaNames.queryParams && queryParams) {
        // Parse validates and returns the validated value, but we keep using original params
        // as parse() ensures they are valid. If invalid, parse() will throw.
        validations.push(`${schemaNames.queryParams}.parse(params);`);
      }

      // Validate body
      if (schemaNames.body && body.definition) {
        const bodyProp = props.find(
          (p: { type: string }) => p.type === GetterPropType.BODY,
        );
        if (bodyProp) {
          validations.push(
            `${bodyProp.name} = ${schemaNames.body}.parse(${bodyProp.name});`,
          );
        }
      }

      if (validations.length > 0) {
        zodPreValidationCode = `\n    ${validations.join('\n    ')}\n    `;
      }

      // Post-validation code (after HTTP request)
      zodPostValidationCode = `\n    const validatedResponse = ${schemaNames.response}.parse(response.data);\n    return { ...response, data: validatedResponse };`;
    }
  }

  const hasZodValidation = !!zodPostValidationCode;

  // For react-query-zod, use exported types from zod files instead of z.infer
  // Store original type names for zod exports
  // schemaNames might not be defined if zod validation is not used, so we get it from verbOptions
  const zodSchemaNamesMap = (verbOptions as any).__zodSchemaNamesMap as
    | { params: string | null; queryParams: string | null; body: string | null; response: string | null }
    | undefined;
  
  // Get type names from schema objects (used in endpoints.ts) instead of schema names (used in zod files)
  // For params, the type name is formed from operationName + "Params" (PascalCase)
  // This matches the type name used in endpoints.ts
  const paramsTypeName = params.length > 0 
    ? pascal(operationName) + 'Params'
    : null;
  
  // For queryParams, use schema.name which is the type name used in endpoints.ts
  const queryParamsTypeName = queryParams?.schema.name || null;
  
  const originalTypeNames = {
    body: body.definition || null,
    response: response.definition.success || null,
    params: paramsTypeName,
    queryParams: queryParamsTypeName,
  };
  (verbOptions as any).__zodOriginalTypeNames = originalTypeNames;

  // For react-query-zod, replace queryParams type in props with the type from zod file
  // The zod file exports QueryParams type (e.g., LookupDealUrgencyListQueryParams)
  // which should be used instead of the Params type (e.g., LookupDealUrgencyListParams)
  if (isReactQueryZod && queryParams && originalTypeNames.queryParams) {
    // Find the queryParams prop and replace its type
    props = props.map((prop: GetterProp) => {
      if (prop.type === GetterPropType.QUERY_PARAM) {
        // Use QueryParams type from zod file (replace "Params" with "QueryParams")
        // originalTypeNames.queryParams contains "LookupDealUrgencyListParams"
        // We need "LookupDealUrgencyListQueryParams" from zod file
        const queryParamsTypeName = originalTypeNames.queryParams.replace(/Params$/, 'QueryParams');
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

  // Use original type names directly from zod exports (not z.infer)
  const responseType = isReactQueryZod && originalTypeNames.response
    ? originalTypeNames.response
    : response.definition.success || 'unknown';

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

  // Store zod schema info for adding imports later
  // Also store type names to export from zod files
  (verbOptions as any).__zodSchemaPath = zodSchemaPath;
  (verbOptions as any).__zodSchemaNames = zodSchemaNames;
  (verbOptions as any).__zodTypeNames = originalTypeNames;

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
