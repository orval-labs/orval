import {
  camel,
  type ClientBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  generateBodyOptions,
  generateFormDataAndUrlEncodedFunction,
  generateVerbImports,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  GetterPropType,
  isObject,
  pascal,
  resolveRef,
  stringify,
  toObjectString,
} from '@orval/core';
import type {
  ParameterObject,
  PathItemObject,
  ReferenceObject,
} from 'openapi3-ts/oas30';
import type { SchemaObject } from 'openapi3-ts/oas31';

export const generateRequestFunction = (
  {
    queryParams,
    headers,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    fetchReviver,
    formData,
    formUrlEncoded,
    override,
  }: GeneratorVerbOptions,
  { route, context, pathRoute }: GeneratorOptions,
) => {
  const isRequestOptions = override.requestOptions !== false;
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;

  const getUrlFnName = camel(`get-${operationName}-url`);
  const getUrlFnProps = toObjectString(
    props.filter(
      (prop) =>
        prop.type === GetterPropType.PARAM ||
        prop.type === GetterPropType.NAMED_PATH_PARAMS ||
        prop.type === GetterPropType.QUERY_PARAM,
    ),
    'implementation',
  );

  const spec = context.specs[context.specKey].paths[pathRoute] as
    | PathItemObject
    | undefined;
  const parameters =
    spec?.[verb]?.parameters ?? ([] as (ParameterObject | ReferenceObject)[]);

  const explodeParameters = parameters.filter((parameter) => {
    const { schema } = resolveRef<ParameterObject>(parameter, context);
    const schemaObject = schema.schema as SchemaObject;

    return (
      schema.in === 'query' && schemaObject.type === 'array' && schema.explode
    );
  });

  const explodeParametersNames = explodeParameters.map((parameter) => {
    const { schema } = resolveRef<ParameterObject>(parameter, context);

    return schema.name;
  });
  const hasDateParams =
    context.output.override.useDates &&
    parameters.some(
      (p) =>
        'schema' in p &&
        p.schema &&
        'format' in p.schema &&
        p.schema.format === 'date-time',
    );

  const explodeArrayImplementation =
    explodeParameters.length > 0
      ? `const explodeParameters = ${JSON.stringify(explodeParametersNames)};

    if (Array.isArray(value) && explodeParameters.includes(key)) {
      value.forEach((v) => {
        normalizedParams.append(key, v === null ? 'null' : ${hasDateParams ? 'v instanceof Date ? v.toISOString() : ' : ''}v.toString());
      });
      return;
    }
      `
      : '';

  const isExplodeParametersOnly =
    explodeParameters.length === parameters.length;

  const nomalParamsImplementation = `if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : ${hasDateParams ? 'value instanceof Date ? value.toISOString() : ' : ''}value.toString())
    }`;

  const getUrlFnImplementation = `export const ${getUrlFnName} = (${getUrlFnProps}) => {
${
  queryParams
    ? `  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    ${explodeArrayImplementation}
    ${isExplodeParametersOnly ? '' : nomalParamsImplementation}
  });`
    : ''
}

  ${queryParams ? `const stringifiedParams = normalizedParams.toString();` : ``}

  ${
    queryParams
      ? `return stringifiedParams.length > 0 ? \`${route}?\${stringifiedParams}\` : \`${route}\``
      : `return \`${route}\``
  }
}\n`;

  const isContentTypeNdJson = (contentType: string) =>
    contentType === 'application/nd-json' ||
    contentType === 'application/x-ndjson';

  const isNdJson = response.contentTypes.some((contentType) =>
    isContentTypeNdJson(contentType),
  );
  const responseTypeName = fetchResponseTypeName(
    override.fetch.includeHttpResponseReturnType,
    isNdJson ? 'Response' : response.definition.success,
    operationName,
  );

  const allResponses = [...response.types.success, ...response.types.errors];
  if (allResponses.length === 0) {
    allResponses.push({
      contentType: '',
      hasReadonlyProps: false,
      imports: [],
      isEnum: false,
      isRef: false,
      key: 'default',
      schemas: [],
      type: 'unknown',
      value: 'unknown',
    });
  }
  const nonDefaultStatuses = allResponses
    .filter((r) => r.key !== 'default')
    .map((r) => r.key);
  const responseDataTypes = allResponses
    .map((r) =>
      allResponses.filter((r2) => r2.key === r.key).length > 1
        ? { ...r, suffix: pascal(r.contentType) }
        : r,
    )
    .map((r) => {
      const name = `${responseTypeName}${pascal(r.key)}${'suffix' in r ? r.suffix : ''}`;
      return {
        name,
        success: response.types.success.some((s) => s.key === r.key),
        value: `export type ${name} = {
  ${isContentTypeNdJson(r.contentType) ? `stream: TypedResponse<${r.value}>` : `data: ${r.value || 'unknown'}`}
  status: ${
    r.key === 'default'
      ? nonDefaultStatuses.length > 0
        ? `Exclude<HTTPStatusCodes, ${nonDefaultStatuses.join(' | ')}>`
        : 'number'
      : r.key
  }
}`,
      };
    });

  const successName = `${responseTypeName}Success`;
  const errorName = `${responseTypeName}Error`;
  const hasSuccess = responseDataTypes.some((r) => r.success);
  const hasError = responseDataTypes.some((r) => !r.success);

  const responseTypeImplementation = override.fetch
    .includeHttpResponseReturnType
    ? `${responseDataTypes.map((r) => r.value).join('\n\n')}
    
${
  hasSuccess
    ? `export type ${successName} = (${responseDataTypes
        .filter((r) => r.success)
        .map((r) => r.name)
        .join(' | ')}) & {
  headers: Headers;
}`
    : ''
};
${
  hasError
    ? `export type ${errorName} = (${responseDataTypes
        .filter((r) => !r.success)
        .map((r) => r.name)
        .join(' | ')}) & {
  headers: Headers;
}`
    : ''
};

${override.fetch.forceSuccessResponse && hasSuccess ? '' : `export type ${responseTypeName} = (${hasError && hasSuccess ? `${successName} | ${errorName}` : hasSuccess ? successName : errorName})\n\n`}`
    : '';

  const getUrlFnProperties = props
    .filter(
      (prop) =>
        prop.type === GetterPropType.PARAM ||
        prop.type === GetterPropType.QUERY_PARAM ||
        prop.type === GetterPropType.NAMED_PATH_PARAMS,
    )
    .map((param) => {
      return param.type === GetterPropType.NAMED_PATH_PARAMS
        ? param.destructured
        : param.name;
    })
    .join(',');

  const args = `${toObjectString(props, 'implementation')} ${isRequestOptions ? `options?: RequestInit` : ''}`;
  const returnType =
    override.fetch.forceSuccessResponse && hasSuccess
      ? `Promise<${successName}>`
      : `Promise<${responseTypeName}>`;

  const fetchMethodOption = `method: '${verb.toUpperCase()}'`;
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
    ...(isNdJson && response.contentTypes.length === 1
      ? [
          `Accept: ${
            response.contentTypes[0] === 'application/x-ndjson'
              ? "'application/x-ndjson'"
              : "'application/nd-json'"
          }`,
        ]
      : []),
    ...overrideHeaders,
    ...(headers ? ['...headers'] : []),
  ];

  let globalFetchOptions;
  if (isObject(override.requestOptions)) {
    // If both requestOptions and fetchHeadersOptions will be adding a header, we must merge them to avoid multiple properties with the same name
    const shouldMergeFetchOptionHeaders =
      headersToAdd.length > 0 && 'headers' in override.requestOptions;
    const globalFetchOptionsObject = { ...override.requestOptions };
    if (shouldMergeFetchOptionHeaders && override.requestOptions.headers) {
      // Remove the headers from the object going into globalFetchOptions
      delete globalFetchOptionsObject.headers;
      // Add it to the dedicated headers object
    }
    globalFetchOptions = stringify(globalFetchOptionsObject)
      ?.slice(1, -1)
      .trim();
  } else {
    globalFetchOptions = '';
  }
  const fetchHeadersOption =
    headersToAdd.length > 0
      ? `headers: { ${headersToAdd.join(',')}, ...options?.headers }`
      : '';
  const requestBodyParams = generateBodyOptions(
    body,
    isFormData,
    isFormUrlEncoded,
  );
  const fetchBodyOption = requestBodyParams
    ? (isFormData && body.formData) ||
      (isFormUrlEncoded && body.formUrlEncoded) ||
      body.contentType === 'text/plain'
      ? `body: ${requestBodyParams}`
      : `body: JSON.stringify(${requestBodyParams})`
    : '';
  const fetchFnOptions = `${getUrlFnName}(${getUrlFnProperties}),
  {${globalFetchOptions ? '\n' : ''}      ${globalFetchOptions}
    ${isRequestOptions ? '...options,' : ''}
    ${fetchMethodOption}${fetchHeadersOption ? ',' : ''}
    ${fetchHeadersOption}${fetchBodyOption ? ',' : ''}
    ${fetchBodyOption}
  }
`;
  const reviver = fetchReviver ? `, ${fetchReviver.name}` : '';
  const throwOnErrorImplementation = `if (!${isNdJson ? 'stream' : 'res'}.ok) {
    ${isNdJson ? 'const body = [204, 205, 304].includes(stream.status) ? null : await stream.text();' : ''}
    const err: globalThis.Error & {info?: ${hasError ? `${errorName}${override.fetch.includeHttpResponseReturnType ? "['data']" : ''}` : 'any'}, status?: number} = new globalThis.Error();
    const data ${hasError ? `: ${errorName}${override.fetch.includeHttpResponseReturnType ? `['data']` : ''}` : ''} = body ? JSON.parse(body${reviver}) : {}
    err.info = data;
    err.status = ${isNdJson ? 'stream' : 'res'}.status;
    throw err;
  }`;
  const fetchResponseImplementation = isNdJson
    ? `  const stream = await fetch(${fetchFnOptions});
  ${override.fetch.forceSuccessResponse ? throwOnErrorImplementation : ''}
  ${override.fetch.includeHttpResponseReturnType ? `return { status: stream.status, stream, headers: stream.headers } as ${override.fetch.forceSuccessResponse && hasSuccess ? successName : responseTypeName}` : `return stream`}
  `
    : `const res = await fetch(${fetchFnOptions})

  const body = [204, 205, 304].includes(res.status) ? null : await res.text();
  ${override.fetch.forceSuccessResponse ? throwOnErrorImplementation : ''}
  const data: ${override.fetch.forceSuccessResponse && hasSuccess ? successName : responseTypeName}${override.fetch.includeHttpResponseReturnType ? `['data']` : ''} = body ? JSON.parse(body${reviver}) : {}
  ${override.fetch.includeHttpResponseReturnType ? `return { data, status: res.status, headers: res.headers } as ${override.fetch.forceSuccessResponse && hasSuccess ? successName : responseTypeName}` : 'return data'}
`;
  const customFetchResponseImplementation = `return ${mutator?.name}<${override.fetch.forceSuccessResponse && hasSuccess ? successName : responseTypeName}>(${fetchFnOptions});`;

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  const fetchImplementationBody = mutator
    ? customFetchResponseImplementation
    : fetchResponseImplementation;

  const fetchImplementation = `export const ${operationName} = async (${args}): ${returnType} => {
  ${bodyForm ? `  ${bodyForm}` : ''}
  ${fetchImplementationBody}}
`;

  const implementation =
    responseTypeImplementation +
    `${getUrlFnImplementation}\n` +
    `${fetchImplementation}\n`;

  return implementation;
};

export const fetchResponseTypeName = (
  includeHttpResponseReturnType: boolean | undefined,
  definitionSuccessResponse: string,
  operationName: string,
) => {
  return includeHttpResponseReturnType
    ? `${operationName}Response`
    : definitionSuccessResponse;
};

export const generateClient: ClientBuilder = (verbOptions, options) => {
  const imports = generateVerbImports(verbOptions);
  const functionImplementation = generateRequestFunction(verbOptions, options);

  return {
    implementation: `${functionImplementation}\n`,
    imports,
  };
};

const getHTTPStatusCodes = () => `
export type HTTPStatusCode1xx = 100 | 101 | 102 | 103;
export type HTTPStatusCode2xx = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207;
export type HTTPStatusCode3xx = 300 | 301 | 302 | 303 | 304 | 305 | 307 | 308;
export type HTTPStatusCode4xx = 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 419 | 420 | 421 | 422 | 423 | 424 | 426 | 428 | 429 | 431 | 451;
export type HTTPStatusCode5xx = 500 | 501 | 502 | 503 | 504 | 505 | 507 | 511;
export type HTTPStatusCodes = HTTPStatusCode1xx | HTTPStatusCode2xx | HTTPStatusCode3xx | HTTPStatusCode4xx | HTTPStatusCode5xx;

`;

export const generateFetchHeader: ClientHeaderBuilder = ({
  clientImplementation,
}) => {
  return clientImplementation.includes('<HTTPStatusCodes,')
    ? getHTTPStatusCodes()
    : '';
};

const fetchClientBuilder: ClientGeneratorsBuilder = {
  client: generateClient,
  header: generateFetchHeader,
  dependencies: () => [],
};

export const builder = () => () => fetchClientBuilder;

export default builder;
