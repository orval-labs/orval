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
  const isFormData = override?.formData !== false;
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

  ${
    queryParams
      ? `return normalizedParams.size ? \`${route}${'?${normalizedParams.toString()}'}\` : \`${route}\``
      : `return \`${route}\``
  }
}\n`;

  const responseTypeName = fetchResponseTypeName(
    override.fetch.includeHttpStatusReturnType,
    response.definition.success,
    operationName,
  );
  const responseTypeImplementation = override.fetch.includeHttpStatusReturnType
    ? `export type ${responseTypeName} = {
  data: ${response.definition.success || 'unknown'};
  status: number;
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
  const retrunType = `Promise<${responseTypeName}>`;

  const globalFetchOptions = isObject(override?.requestOptions)
    ? `${stringify(override?.requestOptions)?.slice(1, -1)?.trim()}`
    : '';
  const fetchMethodOption = `method: '${verb.toUpperCase()}'`;
  const ignoreContentTypes = ['multipart/form-data'];
  const fetchHeadersOption =
    body.contentType && !ignoreContentTypes.includes(body.contentType)
      ? `headers: { 'Content-Type': '${body.contentType}', ...options?.headers }`
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
  const fetchResponseImplementation = `const res = await fetch(${fetchFnOptions}
  )
  const data = await res.json()

  ${override.fetch.includeHttpStatusReturnType ? 'return { status: res.status, data }' : `return data as ${responseTypeName}`}
`;
  const customFetchResponseImplementation = `return ${mutator?.name}<${retrunType}>(${fetchFnOptions});`;

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

  const fetchImplementation = `export const ${operationName} = async (${args}): ${retrunType} => {
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
  includeHttpStatusReturnType: boolean,
  definitionSuccessResponse: string,
  operationName: string,
) => {
  return includeHttpStatusReturnType
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

const fetchClientBuilder: ClientGeneratorsBuilder = {
  client: generateClient,
  dependencies: () => [],
};

export const builder = () => () => fetchClientBuilder;

export default builder;
