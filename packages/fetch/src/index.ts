import {
  ClientBuilder,
  ClientDependenciesBuilder,
  ClientGeneratorsBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateVerbImports,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
  stringify,
  toObjectString,
  generateBodyOptions,
  isObject,
} from '@orval/core';

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

export const getDependencies: ClientDependenciesBuilder = (
  hasParamsSerializerOptions: boolean,
) => [...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : [])];

const generateRequestFunction = (
  {
    queryParams,
    operationName,
    response,
    body,
    props,
    verb,
    formData,
    formUrlEncoded,
    override,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  const args = `${toObjectString(props, 'implementation')} ${isRequestOptions ? `options?: RequestInit` : ''}`;
  const retrunType = `Promise<${response.definition.success || 'unknown'}>`;

  const globalFetchOptions = isObject(override?.requestOptions)
    ? `${stringify(override?.requestOptions)?.slice(1, -1)?.trim()}`
    : '';
  const fetchMethodOption = `method: '${verb.toUpperCase()}'`;

  const requestBodyParams = generateBodyOptions(
    body,
    isFormData,
    isFormUrlEncoded,
  );
  const mergeRequestBodyImplementation =
    requestBodyParams && queryParams
      ? `const body = {...${requestBodyParams} ...params}`
      : '';

  let fetchBodyOption = '';
  if (requestBodyParams && queryParams) {
    fetchBodyOption = 'body: JSON.stringify(body)';
  } else if (requestBodyParams) {
    fetchBodyOption = `body: JSON.stringify(${requestBodyParams})`;
  } else if (queryParams) {
    fetchBodyOption = `body: JSON.stringify(params)`;
  }

  const fetchResponseImplementation = `const res = await fetch(
    \`${route}\`,
    {${globalFetchOptions ? '\n' : ''}      ${globalFetchOptions}
      ${isRequestOptions ? '...options,' : ''}
      ${fetchMethodOption}${fetchBodyOption ? ',' : ''}
      ${fetchBodyOption}
    }
  )
  
  return res.json()
`;

  const implementationBody =
    `${bodyForm ? `  ${bodyForm}\n` : ''}` +
    `${mergeRequestBodyImplementation ? `  ${mergeRequestBodyImplementation}\n` : ''}` +
    `  ${fetchResponseImplementation}`;

  return `export const ${operationName} = async (${args}): ${retrunType} => {\n${implementationBody}}`;
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
  dependencies: getDependencies,
};

export const builder = () => () => fetchClientBuilder;

export default builder;
