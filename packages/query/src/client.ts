import {
  type ClientHeaderBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateResponseDateDeserializer,
  type GeneratorDependency,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getAngularFilteredParamsCallExpression,
  getAngularFilteredParamsHelperBody,
  getSuccessResponseType,
  type GetterResponse,
  isObject,
  isOperationInTagBucket,
  isSyntheticDefaultImportsAllow,
  makeRouteSafe,
  OutputHttpClient,
  pascal,
  toObjectString,
} from '@orval/core';
import { generateFetchHeader } from '@orval/fetch';

import type { FrameworkAdapter } from './framework-adapter';
import { getHasSignal } from './utils';

export const AXIOS_DEPENDENCIES = [
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
] as const satisfies readonly GeneratorDependency[];

export const ANGULAR_HTTP_DEPENDENCIES = [
  {
    exports: [
      { name: 'HttpClient', values: true },
      { name: 'HttpHeaders', values: true },
      { name: 'HttpParams', values: true },
      { name: 'HttpContext' },
    ],
    dependency: '@angular/common/http',
  },
  // Note: 'inject' from @angular/core is already in ANGULAR_QUERY_DEPENDENCIES
  {
    exports: [
      { name: 'lastValueFrom', values: true },
      { name: 'fromEvent', values: true },
    ],
    dependency: 'rxjs',
  },
  {
    exports: [
      { name: 'takeUntil', values: true },
      { name: 'map', values: true },
    ],
    dependency: 'rxjs/operators',
  },
] as const satisfies readonly GeneratorDependency[];

export const generateAngularHttpRequestFunction = (
  {
    headers,
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    formData,
    formUrlEncoded,
    override,
  }: GeneratorVerbOptions,
  { route: _route, context }: GeneratorOptions,
) => {
  let route = _route;
  if (context.output.urlEncodeParameters) {
    route = makeRouteSafe(route);
  }

  const isRequestOptions = override.requestOptions !== false;
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const hasSignal = getHasSignal({
    overrideQuerySignal: override.query.signal,
  });
  // Check if API has a param named "signal" to avoid conflict with AbortSignal
  const hasSignalParam = props.some((prop) => prop.name === 'signal');

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  // Handle mutator case
  if (mutator) {
    const isExactOptionalPropertyTypes =
      !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;

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
      hasSignalParam,
      isExactOptionalPropertyTypes,
      isAngular: context.output.httpClient === OutputHttpClient.ANGULAR,
    });

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    const propsImplementation = toObjectString(props, 'implementation');

    return `${override.query.shouldExportHttpClient ? 'export ' : ''}const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<typeof ${mutator.name}>,`
        : ''
    } ${getSignalDefinition({ hasSignal, hasSignalParam })}) => {
      ${bodyForm}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
      ${mutatorConfig},
      ${requestOptions});
    }
  `;
  }

  // Generate native Angular HttpClient implementation
  const queryProps = toObjectString(props, 'implementation').replace(
    /,\s*$/,
    '',
  );
  const dataType = response.definition.success || 'unknown';

  // Build URL with query params - use httpParams to avoid shadowing the 'params' variable
  const hasQueryParams = queryParams?.schema.name;
  // The queryParams variable from function props is always named 'params'
  const filteredParamsExpression = getAngularFilteredParamsCallExpression(
    'params',
    queryParams?.requiredNullableKeys,
  );
  const urlConstruction = hasQueryParams
    ? `const httpParams = params ? new HttpParams({ fromObject: ${filteredParamsExpression} }) : undefined;
    const url = \`${route}\`;`
    : `const url = \`${route}\`;`;

  // Build request options
  const httpOptions: string[] = [];
  if (hasQueryParams) {
    httpOptions.push('params: httpParams');
  }
  if (headers) {
    httpOptions.push('headers: new HttpHeaders(headers)');
  }

  // Use only success response content types to determine responseType
  // (response.contentTypes includes error responses which may be JSON and would
  // incorrectly prevent text/blob responseType from being set)
  const successResponseType = getSuccessResponseType(response);
  const responseTypeOption = successResponseType
    ? `'${successResponseType}'`
    : undefined;
  if (responseTypeOption) {
    httpOptions.push(`responseType: ${responseTypeOption}`);
  }

  const optionsStr =
    httpOptions.length > 0 ? `, { ${httpOptions.join(', ')} }` : '';

  // Build the HTTP method call
  let httpCall: string;
  const httpGeneric = responseTypeOption ? '' : `<${dataType}>`;
  const bodyArg =
    isFormData && body.formData
      ? 'formData'
      : isFormUrlEncoded && body.formUrlEncoded
        ? 'formUrlEncoded'
        : body.definition
          ? toObjectString([body], 'implementation').replace(/,\s*$/, '')
          : '';

  switch (verb) {
    case 'get':
    case 'head': {
      httpCall = `http.${verb}${httpGeneric}(url${optionsStr})`;
      break;
    }
    case 'delete': {
      httpCall = bodyArg
        ? `http.${verb}${httpGeneric}(url, { ${httpOptions.length > 0 ? httpOptions.join(', ') + ', ' : ''}body: ${bodyArg} })`
        : `http.${verb}${httpGeneric}(url${optionsStr})`;
      break;
    }
    default: {
      // post, put, patch
      httpCall = `http.${verb}${httpGeneric}(url, ${bodyArg || 'undefined'}${optionsStr})`;
      break;
    }
  }

  // Detect if Zod runtime validation should be applied
  const responseType = response.definition.success;
  const isPrimitiveType = [
    'string',
    'number',
    'boolean',
    'void',
    'unknown',
  ].includes(responseType);
  const hasSchema = response.imports.some((imp) => imp.name === responseType);
  const isZodOutput =
    isObject(context.output.schemas) && context.output.schemas.type === 'zod';
  const isValidateResponse =
    override.query.runtimeValidation &&
    isZodOutput &&
    !isPrimitiveType &&
    hasSchema;

  // If validation is enabled, pipe through map(data => Schema.parse(data))
  if (isValidateResponse) {
    const schemaValueRef =
      responseType === 'Error' ? 'ErrorSchema' : responseType;
    httpCall = `${httpCall}.pipe(map(data => ${schemaValueRef}.parse(data)))`;
  }

  // For Angular, we use takeUntil with fromEvent to handle AbortSignal cancellation
  // This follows the pattern from TanStack Query Angular documentation
  // Note: signal can be null (from RequestInit), so we accept null | undefined
  const optionsParam = hasSignal
    ? 'options?: { signal?: AbortSignal | null }'
    : '';

  // Build additional params after http, handling empty queryProps properly
  const additionalParams = [queryProps, optionsParam]
    .filter(Boolean)
    .join(', ');

  // Note: http parameter is passed from the inject* function which has injection context
  return `${override.query.shouldExportHttpClient ? 'export ' : ''}const ${operationName} = (
    http: HttpClient${additionalParams ? `,\n    ${additionalParams}` : ''}
  ): Promise<${dataType}> => {
    ${bodyForm}
    ${urlConstruction}
    const request$ = ${httpCall};
    if (options?.signal) {
      return lastValueFrom(request$.pipe(takeUntil(fromEvent(options.signal, 'abort'))));
    }
    return lastValueFrom(request$);
  }
`;
};
export const generateAxiosRequestFunction = (
  {
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
  }: GeneratorVerbOptions,
  { route: _route, context }: GeneratorOptions,
  adapter: FrameworkAdapter,
) => {
  const props = adapter.transformProps(_props);
  let route = _route;

  if (context.output.urlEncodeParameters) {
    route = makeRouteSafe(route);
  }

  const unrefStatements = adapter.getRequestUnrefStatements(props);

  const isRequestOptions = override.requestOptions !== false;
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const hasSignal = getHasSignal({
    overrideQuerySignal: override.query.signal,
  });
  // Check if API has a param named "signal" to avoid conflict with AbortSignal
  const hasSignalParam = _props.some((prop) => prop.name === 'signal');

  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  const dateDeserializer = override.useDatesTransform
    ? generateResponseDateDeserializer({ operationName, response, context })
    : undefined;
  // Emitted AFTER the operation block: the orval writer prepends the
  // operation's doc comment to this implementation string, so the operation
  // const must come first to keep the JSDoc attached to it. The deserializer
  // is only referenced inside the operation body (executed at call time), so
  // the later declaration has no TDZ issue.
  const dateDeserializerImplementation = dateDeserializer
    ? `\n${dateDeserializer.implementation}`
    : '';
  const thenDateDeserializer = dateDeserializer
    ? `.then(${dateDeserializer.name})`
    : '';

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
      hasSignalParam,
      isExactOptionalPropertyTypes,
    });

    const bodyDefinition = body.definition.replace('[]', String.raw`\[\]`);
    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(String.raw`(\w*):\s?${bodyDefinition}`),
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
      const hookSecondArg =
        isRequestOptions && mutator.hasSecondArg
          ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<ReturnType<typeof ${mutator.name}>>,`
          : '';

      const callback = `(\n    ${propsImplementation}\n ${hookSecondArg}${getSignalDefinition({ hasSignal, hasSignalParam })}) => {
        ${unrefStatements}
        ${bodyForm}
        return ${operationName}(
          ${mutatorConfig},
          ${requestOptions})${thenDateDeserializer};
        }`;

      return `${
        override.query.shouldExportMutatorHooks ? 'export ' : ''
      }const use${pascal(operationName)}Hook = () => {
        const ${operationName} = ${mutator.name}<${
          response.definition.success || 'unknown'
        }>();

        return ${adapter.wrapHookMutatorCallback(callback, operationName)}
      }
    ${dateDeserializerImplementation}`;
    }

    return `${override.query.shouldExportHttpClient ? 'export ' : ''}const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<typeof ${mutator.name}>,`
        : ''
    }${getSignalDefinition({ hasSignal, hasSignalParam })}) => {
      ${unrefStatements}
      ${bodyForm}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
      ${mutatorConfig},
      ${requestOptions})${thenDateDeserializer};
    }
  ${dateDeserializerImplementation}`;
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
    requestOptions: override.requestOptions,
    isFormData,
    isFormUrlEncoded,
    paramsSerializer,
    paramsSerializerOptions: override.paramsSerializerOptions,
    isExactOptionalPropertyTypes,
    hasSignal,
    hasSignalParam,
  });

  const optionsArgs = generateRequestOptionsArguments({
    isRequestOptions,
    hasSignal,
    hasSignalParam,
  });

  const queryProps = toObjectString(props, 'implementation');

  const httpRequestFunctionImplementation = `${override.query.shouldExportHttpClient ? 'export ' : ''}const ${operationName} = (\n    ${queryProps} ${optionsArgs} ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {
    ${unrefStatements}
    ${bodyForm}
    return axios${
      isSyntheticDefaultImportsAllowed ? '' : '.default'
    }.${verb}(${options})${
      dateDeserializer
        ? `.then((res) => { res.data = ${dateDeserializer.name}(res.data); return res; })`
        : ''
    };
  }
${dateDeserializerImplementation}`;

  return httpRequestFunctionImplementation;
};

export const generateRequestOptionsArguments = ({
  isRequestOptions,
  hasSignal,
  hasSignalParam = false,
}: {
  isRequestOptions: boolean;
  hasSignal: boolean;
  hasSignalParam?: boolean;
}) => {
  if (isRequestOptions) {
    return 'options?: AxiosRequestConfig\n';
  }

  return getSignalDefinition({ hasSignal, hasSignalParam });
};

export const getSignalDefinition = ({
  hasSignal,
  hasSignalParam = false,
}: {
  hasSignal: boolean;
  hasSignalParam?: boolean;
}): string => {
  if (!hasSignal) {
    return '';
  }
  const signalVar = hasSignalParam ? 'querySignal' : 'signal';
  return `${signalVar}?: AbortSignal\n`;
};

export const getQueryArgumentsRequestType = (
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
  useRuntimeFetcher?: boolean,
) => {
  if (!mutator) {
    if (httpClient === OutputHttpClient.AXIOS) {
      return `axios?: AxiosRequestConfig`;
    }
    if (httpClient === OutputHttpClient.FETCH && useRuntimeFetcher) {
      return 'fetch?: RequestInit, fetcher?: typeof globalThis.fetch';
    }
    return 'fetch?: RequestInit';
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
  hasSignalParam = false,
  useRuntimeFetcher = false,
}: {
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  httpClient: OutputHttpClient;
  hasSignalParam?: boolean;
  useRuntimeFetcher?: boolean;
}) => {
  // Use querySignal if API has a param named "signal" to avoid conflict
  const signalVar = hasSignalParam ? 'querySignal' : 'signal';
  // Only use explicit `signal: querySignal` when there's a naming conflict
  const signalProp = hasSignalParam ? `signal: ${signalVar}` : 'signal';

  if (!mutator && isRequestOptions) {
    const options =
      httpClient === OutputHttpClient.AXIOS ? 'axiosOptions' : 'fetchOptions';
    const fetcherArg =
      httpClient === OutputHttpClient.FETCH && useRuntimeFetcher
        ? ', fetcherFn'
        : '';

    if (!hasSignal) {
      return `${options}${fetcherArg}`;
    }

    return `{ ${
      isExactOptionalPropertyTypes
        ? `...(${signalVar} ? { ${signalProp} } : {})`
        : signalProp
    }, ...${options} }${fetcherArg}`;
  }

  // For Angular mutators with hasSecondArg, pass http through options parameter
  // http is injected in the queryOptionsFn and passed here as the second arg to the mutator
  if (mutator?.hasSecondArg && httpClient === OutputHttpClient.ANGULAR) {
    if (!hasSignal) {
      return 'http';
    }
    return `http, ${signalVar}`;
  }

  if (mutator?.hasSecondArg && isRequestOptions) {
    if (!hasSignal) {
      return 'requestOptions';
    }

    // Axios and Angular mutators: signal is a separate argument
    // Fetch mutators: signal is wrapped in options object
    return httpClient === OutputHttpClient.AXIOS ||
      httpClient === OutputHttpClient.ANGULAR
      ? `requestOptions, ${signalVar}`
      : `{ ${signalProp}, ...requestOptions }`;
  }

  if (hasSignal) {
    // Axios: signal is always separate
    // Angular with mutator: signal is separate (mutator pattern)
    // Angular without mutator: signal is wrapped (native pattern)
    // Fetch/other: signal is wrapped
    if (httpClient === OutputHttpClient.AXIOS) {
      return signalVar;
    }
    if (httpClient === OutputHttpClient.ANGULAR && mutator) {
      return signalVar;
    }
    return `{ ${signalProp} }`;
  }

  return '';
};

export const getHookOptions = ({
  isRequestOptions,
  httpClient,
  mutator,
  useRuntimeFetcher = false,
}: {
  isRequestOptions: boolean;
  httpClient: OutputHttpClient;
  mutator?: GeneratorMutator;
  useRuntimeFetcher?: boolean;
}) => {
  if (!isRequestOptions) {
    return '';
  }

  let value = 'const {query: queryOptions';

  if (!mutator) {
    if (httpClient === OutputHttpClient.AXIOS) {
      value += ', axios: axiosOptions';
    } else if (httpClient === OutputHttpClient.FETCH && useRuntimeFetcher) {
      value += ', fetch: fetchOptions, fetcher: fetcherFn';
    } else {
      value += ', fetch: fetchOptions';
    }
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
  forceSuccessResponse?: boolean,
) => {
  const errorsType = dedupeUnionTypes(response.definition.errors || 'unknown');

  if (mutator) {
    return mutator.hasErrorType
      ? `${mutator.default ? pascal(operationName) : ''}ErrorType<${errorsType}>`
      : errorsType;
  }

  if (httpClient === OutputHttpClient.AXIOS) {
    return `AxiosError<${errorsType}>`;
  }

  // With `forceSuccessResponse`, the fetch client narrows its return type to
  // the success body and throws `globalThis.Error & { info?, status? }` on
  // non-2xx responses instead of returning the error body. TError must match
  // that thrown shape rather than the raw OpenAPI error type. See #3300.
  if (forceSuccessResponse) {
    return `globalThis.Error & { info?: ${errorsType}; status?: number }`;
  }

  return errorsType;
};

export const getHooksOptionImplementation = (
  isRequestOptions: boolean,
  httpClient: OutputHttpClient,
  operationName: string,
  mutator?: GeneratorMutator,
  useRuntimeFetcher?: boolean,
) => {
  const fetcherOption =
    httpClient === OutputHttpClient.FETCH && useRuntimeFetcher
      ? ', fetcher: fetcherFn'
      : '';
  const options =
    httpClient === OutputHttpClient.AXIOS
      ? ', axios: axiosOptions'
      : `, fetch: fetchOptions${fetcherOption}`;

  return isRequestOptions
    ? `const mutationKey = ['${operationName}'];
const {mutation: mutationOptions${
        mutator
          ? mutator.hasSecondArg
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
  useRuntimeFetcher?: boolean,
) => {
  const options =
    httpClient === OutputHttpClient.AXIOS ? 'axiosOptions' : 'fetchOptions';
  const fetcherArg =
    httpClient === OutputHttpClient.FETCH && useRuntimeFetcher
      ? ', fetcherFn'
      : '';

  // For Angular mutators with hasSecondArg, pass http (which is injected in inject* fn)
  // http is required as first param so no assertion needed
  if (mutator?.hasSecondArg && httpClient === OutputHttpClient.ANGULAR) {
    return 'http';
  }

  return isRequestOptions
    ? mutator
      ? mutator.hasSecondArg
        ? 'requestOptions'
        : ''
      : `${options}${fetcherArg}`
    : '';
};

export const getQueryHeader: ClientHeaderBuilder = (params) => {
  if (params.output.httpClient === OutputHttpClient.FETCH) {
    return generateFetchHeader(params);
  }

  if (params.output.httpClient === OutputHttpClient.ANGULAR) {
    const relevantVerbs = Object.values(params.verbOptions).filter(
      (verbOption) => isOperationInTagBucket(verbOption, params.tag),
    );
    const hasQueryParams = relevantVerbs.some((v) => v.queryParams);

    return hasQueryParams ? getAngularFilteredParamsHelperBody() : '';
  }

  return '';
};
