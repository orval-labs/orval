import { ClientHeaderBuilder, pascal } from '@orval/core';
import {
  camel,
  ClientBuilder,
  ClientGeneratorsBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateVerbImports,
  GeneratorOptions,
  GeneratorVerbOptions,
  GetterPropType,
  stringify,
  toObjectString,
  generateBodyOptions,
  isObject,
  resolveRef,
} from '@orval/core';
import {
  PathItemObject,
  ParameterObject,
  ReferenceObject,
} from 'openapi3-ts/oas30';

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
    formData,
    formUrlEncoded,
    override,
  }: GeneratorVerbOptions,
  { route, context, pathRoute }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData.disabled === false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;

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
    spec?.[verb]?.parameters || ([] as (ParameterObject | ReferenceObject)[]);

  const explodeParameters = parameters.filter((parameter) => {
    const { schema } = resolveRef<ParameterObject>(parameter, context);

    return schema.in === 'query' && schema.explode;
  });

  const explodeParametersNames = explodeParameters.map((parameter) => {
    const { schema } = resolveRef<ParameterObject>(parameter, context);

    return schema.name;
  });

  const explodeArrayImplementation =
    explodeParameters.length > 0
      ? `const explodeParameters = ${JSON.stringify(explodeParametersNames)};

    if (value instanceof Array && explodeParameters.includes(key)) {
      value.forEach((v) => normalizedParams.append(key, v === null ? 'null' : v.toString()));
      return;
    }
      `
      : '';

  const isExplodeParametersOnly =
    explodeParameters.length === parameters.length;

  const nomalParamsImplementation = `if (value !== undefined) {
      normalizedParams.append(key, value === null ? 'null' : value.toString())
    }`;

  const getUrlFnImplementation = `export const ${getUrlFnName} = (${getUrlFnProps}) => {
${
  queryParams
    ? `  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    ${explodeArrayImplementation}
    ${!isExplodeParametersOnly ? nomalParamsImplementation : ''}
  });`
    : ''
}

  ${queryParams ? `const stringifiedParams = normalizedParams.toString();` : ``}

  ${
    queryParams
      ? `return stringifiedParams.length > 0 ? \`${route}${'?${stringifiedParams}'}\` : \`${route}\``
      : `return \`${route}\``
  }
}\n`;

  const isContentTypeNdJson = (contentType: string) =>
    contentType === 'application/nd-json' ||
    contentType === 'application/x-ndjson';

  const isNdJson = response.contentTypes.some(isContentTypeNdJson);
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
    .map(
      (r) => `export type ${responseTypeName}${pascal(r.key)} = {
  ${isContentTypeNdJson(r.contentType) ? 'stream: Response' : `data: ${r.value || 'unknown'}`}
  status: ${
    r.key === 'default'
      ? nonDefaultStatuses.length
        ? `Exclude<HTTPStatusCodes, ${nonDefaultStatuses.join(' | ')}>`
        : 'number'
      : r.key
  }
}`,
    )
    .join('\n\n');

  const compositeName = `${responseTypeName}Composite`;
  const compositeResponse = `${compositeName} = ${allResponses.map((r) => `${responseTypeName}${pascal(r.key)}`).join(' | ')}`;

  const responseTypeImplementation = override.fetch
    .includeHttpResponseReturnType
    ? `${responseDataTypes}
    
export type ${compositeResponse};
    
export type ${responseTypeName} = ${compositeName} & {
  headers: Headers;
}\n\n`
    : '';

  const getUrlFnProperties = props
    .filter(
      (prop) =>
        prop.type === GetterPropType.PARAM ||
        prop.type === GetterPropType.QUERY_PARAM ||
        prop.type === GetterPropType.NAMED_PATH_PARAMS,
    )
    .map((param) => {
      if (param.type === GetterPropType.NAMED_PATH_PARAMS) {
        return param.destructured;
      } else {
        return param.name;
      }
    })
    .join(',');

  const args = `${toObjectString(props, 'implementation')} ${isRequestOptions ? `options?: RequestInit` : ''}`;
  const returnType = `Promise<${responseTypeName}>`;

  const globalFetchOptions = isObject(override?.requestOptions)
    ? `${stringify(override?.requestOptions)?.slice(1, -1)?.trim()}`
    : '';
  const fetchMethodOption = `method: '${verb.toUpperCase()}'`;
  const ignoreContentTypes = ['multipart/form-data'];
  const fetchHeadersOption =
    body.contentType && !ignoreContentTypes.includes(body.contentType)
      ? `headers: { 'Content-Type': '${body.contentType}',${headers ? '...headers,' : ''} ...options?.headers }`
      : headers
        ? 'headers: {...headers, ...options?.headers}'
        : '';
  const requestBodyParams = generateBodyOptions(
    body,
    isFormData,
    isFormUrlEncoded,
  );
  const fetchBodyOption = requestBodyParams
    ? (isFormData && body.formData) || (isFormUrlEncoded && body.formUrlEncoded)
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
  const fetchResponseImplementation = isNdJson
    ? `const stream = await fetch(${fetchFnOptions})

  ${override.fetch.includeHttpResponseReturnType ? 'return { status: stream.status, stream, headers: stream.headers }' : `return stream`}
  `
    : `const res = await fetch(${fetchFnOptions})

  const body = [204, 205, 304].includes(res.status) ? null : await res.text()
  const data: ${responseTypeName}${override.fetch.includeHttpResponseReturnType ? `['data']` : ''} = body ? JSON.parse(body) : {}

  ${override.fetch.includeHttpResponseReturnType ? `return { data, status: res.status, headers: res.headers } as ${responseTypeName}` : 'return data'}
`;
  const customFetchResponseImplementation = `return ${mutator?.name}<${responseTypeName}>(${fetchFnOptions});`;

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
    `${responseTypeImplementation}` +
    `${getUrlFnImplementation}\n` +
    `${fetchImplementation}\n`;

  return implementation;
};

export const fetchResponseTypeName = (
  includeHttpResponseReturnType: boolean,
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
