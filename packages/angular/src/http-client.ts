import {
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientFooterBuilder,
  type ClientHeaderBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getDefaultContentType,
  pascal,
  toObjectString,
} from '@orval/core';

import { ANGULAR_HTTP_CLIENT_DEPENDENCIES } from './constants';
import { buildServiceClassOpen, createReturnTypesRegistry } from './utils';

const returnTypesRegistry = createReturnTypesRegistry();

export const getAngularDependencies: ClientDependenciesBuilder = () => [
  ...ANGULAR_HTTP_CLIENT_DEPENDENCIES,
];

export const generateAngularHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideIn,
}) => {
  returnTypesRegistry.reset();

  return buildServiceClassOpen({
    title,
    isRequestOptions,
    isMutator,
    isGlobalMutator,
    provideIn,
  });
};

export const generateAngularFooter: ClientFooterBuilder = ({
  operationNames,
}) => {
  let footer = '};\n\n';

  const returnTypes = returnTypesRegistry.getFooter(operationNames);
  if (returnTypes) {
    footer += `${returnTypes}\n`;
  }

  return footer;
};

export const generateHttpClientImplementation = (
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

  returnTypesRegistry.set(
    operationName,
    `export type ${pascal(
      operationName,
    )}ClientResult = NonNullable<${dataType}>`,
  );

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

    return ` ${operationName}<TData = ${dataType}>(\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasThirdArg
        ? `options?: ThirdParameter<typeof ${mutator.name}>`
        : ''
    }) {${bodyForm}
      return ${mutator.name}<TData>(
      ${mutatorConfig},
      this.http,
      ${requestOptions});
    }
  `;
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
    isAngular: true,
    isExactOptionalPropertyTypes,
    hasSignal: false,
  });

  const propsDefinition = toObjectString(props, 'definition');

  // Check for multiple content types in success responses
  const successTypes = response.types.success;
  const uniqueContentTypes = [
    ...new Set(successTypes.map((t) => t.contentType).filter(Boolean)),
  ];
  const hasMultipleContentTypes = uniqueContentTypes.length > 1;

  // For multiple content types, determine the default
  const jsonContentType = uniqueContentTypes.find((contentType) =>
    contentType.includes('json'),
  );
  const defaultContentType =
    jsonContentType ??
    (hasMultipleContentTypes
      ? getDefaultContentType(uniqueContentTypes)
      : (uniqueContentTypes[0] ?? 'application/json'));
  const defaultType = hasMultipleContentTypes
    ? successTypes.find((t) => t.contentType === defaultContentType)
    : undefined;
  const defaultReturnType = defaultType?.value ?? dataType;

  const isModelType = dataType !== 'Blob' && dataType !== 'string';
  let functionName = operationName;
  if (isModelType && !hasMultipleContentTypes) {
    functionName += `<TData = ${dataType}>`;
  }

  let contentTypeOverloads = '';
  if (hasMultipleContentTypes && isRequestOptions) {
    const requiredProps = props.filter((p) => p.required && !p.default);
    const optionalProps = props.filter((p) => !p.required || p.default);

    contentTypeOverloads = successTypes
      .filter((t) => t.contentType)
      .map(({ contentType, value }) => {
        const requiredPart = requiredProps
          .map((p) => p.definition)
          .join(',\n    ');
        const acceptPart = `accept: '${contentType}'`;
        const optionalPart = optionalProps
          .map((p) => p.definition)
          .join(',\n    ');

        const allParams = [requiredPart, acceptPart, optionalPart]
          .filter(Boolean)
          .join(',\n    ');
        return `${operationName}(${allParams}, options?: HttpClientOptions): Observable<${value}>;`;
      })
      .join('\n  ');

    const requiredPart = requiredProps.map((p) => p.definition).join(',\n    ');
    const optionalPart = optionalProps.map((p) => p.definition).join(',\n    ');
    const allParams = [requiredPart, 'accept?: string', optionalPart]
      .filter(Boolean)
      .join(',\n    ');
    contentTypeOverloads += `\n  ${operationName}(${allParams}, options?: HttpClientOptions): Observable<${defaultReturnType}>;`;
  }

  const observeOverloads =
    isRequestOptions && !hasMultipleContentTypes
      ? `${functionName}(${propsDefinition} options?: HttpClientOptions & { observe?: 'body' }): Observable<${isModelType ? 'TData' : dataType}>;\n ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'events' }): Observable<HttpEvent<${isModelType ? 'TData' : dataType}>>;\n ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'response' }): Observable<AngularHttpResponse<${isModelType ? 'TData' : dataType}>>;`
      : '';

  const overloads = contentTypeOverloads || observeOverloads;

  if (hasMultipleContentTypes) {
    const requiredProps = props.filter((p) => p.required && !p.default);
    const optionalProps = props.filter((p) => !p.required || p.default);

    const requiredPart = requiredProps
      .map((p) => p.implementation)
      .join(',\n    ');
    const optionalPart = optionalProps
      .map((p) => p.implementation)
      .join(',\n    ');
    const allParams = [
      requiredPart,
      `accept: string = '${defaultContentType}'`,
      optionalPart,
    ]
      .filter(Boolean)
      .join(',\n    ');

    return ` ${overloads}
  ${operationName}(
    ${allParams},
    ${isRequestOptions ? 'options?: HttpClientOptions' : ''}
  ): Observable<any> {${bodyForm}
    if (accept.includes('json') || accept.includes('+json')) {
      return this.http.${verb}<any>(\`${route}\`, {
        ...options,
        responseType: 'json',
        headers: { Accept: accept, ...options?.headers },
      });
    } else if (accept.startsWith('text/') || accept.includes('xml')) {
      return this.http.${verb}(\`${route}\`, {
        ...options,
        responseType: 'text',
        headers: { Accept: accept, ...options?.headers },
      }) as any;
    } else {
      return this.http.${verb}(\`${route}\`, {
        ...options,
        responseType: 'blob',
        headers: { Accept: accept, ...options?.headers },
      }) as any;
    }
  }
`;
  }

  return ` ${overloads}
  ${functionName}(
    ${toObjectString(props, 'implementation')} ${
      isRequestOptions ? `options?: HttpClientOptions & { observe?: any }` : ''
    }): Observable<any> {${bodyForm}
    return this.http.${verb}${isModelType ? '<TData>' : ''}(${options});
  }
`;
};

export const generateAngular: ClientBuilder = (verbOptions, options) => {
  const imports = generateVerbImports(verbOptions);
  const implementation = generateHttpClientImplementation(verbOptions, options);

  return { implementation, imports };
};

export const getHttpClientReturnTypes = (operationNames: string[]) =>
  returnTypesRegistry.getFooter(operationNames);

export const resetHttpClientReturnTypes = () => {
  returnTypesRegistry.reset();
};

export { generateAngularTitle } from './utils';
