import {
  camel,
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
  getAngularFilteredParamsCallExpression,
  getAngularFilteredParamsHelperBody,
  getDefaultContentType,
  isBoolean,
  pascal,
  toObjectString,
} from '@orval/core';

import { ANGULAR_HTTP_CLIENT_DEPENDENCIES } from './constants';
import { HTTP_CLIENT_OPTIONS_TEMPLATE, THIRD_PARAMETER_TEMPLATE } from './types';
import { createReturnTypesRegistry } from './utils';

const returnTypesRegistry = createReturnTypesRegistry();

const PRIMITIVE_RESPONSE_TYPES = [
  'string',
  'number',
  'boolean',
  'void',
  'unknown',
] as const;

const isPrimitiveResponseType = (typeName: string | undefined): boolean =>
  typeName != undefined &&
  (PRIMITIVE_RESPONSE_TYPES as readonly string[]).includes(typeName);

const hasSchemaImport = (
  imports: readonly { name: string }[],
  typeName: string | undefined,
): boolean =>
  typeName != undefined && imports.some((imp) => imp.name === typeName);

const getSchemaValueRef = (typeName: string): string =>
  typeName === 'Error' ? 'ErrorSchema' : typeName;

export const getAngularDependencies: ClientDependenciesBuilder = () => [
  ...ANGULAR_HTTP_CLIENT_DEPENDENCIES,
];

export const generateAngularHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideIn,
  verbOptions,
  tag,
}) => {
  returnTypesRegistry.reset();

  const stringTag = tag as string | undefined;
  const relevantVerbs = stringTag
    ? Object.values(verbOptions).filter((v) =>
        v.tags.some((t) => camel(t) === camel(stringTag)),
      )
    : Object.values(verbOptions);
  const hasQueryParams = relevantVerbs.some((v) => v.queryParams);

  return `
${
  isRequestOptions && !isGlobalMutator
    ? `${HTTP_CLIENT_OPTIONS_TEMPLATE}

${hasQueryParams ? getAngularFilteredParamsHelperBody() : ''}`
    : ''
}

${isRequestOptions && isMutator ? THIRD_PARAMETER_TEMPLATE : ''}

@Injectable(${provideIn ? `{ providedIn: '${isBoolean(provideIn) ? 'root' : provideIn}' }` : ''})
export class ${title} {
  private readonly http = inject(HttpClient);
`;
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
  const isPrimitiveType = isPrimitiveResponseType(dataType);
  const hasSchema = hasSchemaImport(response.imports, dataType);
  const isZodOutput =
    typeof context.output.schemas === 'object' &&
    context.output.schemas.type === 'zod';
  const shouldValidateResponse =
    override.angular.runtimeValidation &&
    isZodOutput &&
    !isPrimitiveType &&
    hasSchema;
  const schemaValueRef = shouldValidateResponse
    ? getSchemaValueRef(dataType)
    : dataType;
  const validationPipe = shouldValidateResponse
    ? `.pipe(map(data => ${schemaValueRef}.parse(data) as TData))`
    : '';

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
      isAngular: true,
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
            new RegExp(String.raw`(\\w*):\\s?${body.definition}`),
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

  const optionsBase = {
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
  } as const;

  const propsDefinition = toObjectString(props, 'definition');

  const successTypes = response.types.success;
  const uniqueContentTypes = [
    ...new Set(successTypes.map((t) => t.contentType).filter(Boolean)),
  ];
  const hasMultipleContentTypes = uniqueContentTypes.length > 1;

  const needsObserveBranching = isRequestOptions && !hasMultipleContentTypes;
  const angularParamsRef =
    needsObserveBranching && queryParams ? 'filteredParams' : undefined;

  let paramsDeclaration = '';
  if (angularParamsRef && queryParams) {
    const callExpr = getAngularFilteredParamsCallExpression(
      '{...params, ...options?.params}',
      queryParams.requiredNullableKeys ?? [],
    );
    paramsDeclaration = paramsSerializer
      ? `const ${angularParamsRef} = ${paramsSerializer.name}(${callExpr});\n\n    `
      : `const ${angularParamsRef} = ${callExpr};\n\n    `;
  }

  const optionsInput = {
    ...optionsBase,
    ...(angularParamsRef ? { angularParamsRef } : {}),
  } as const;

  const options = generateOptions(optionsInput);

  const defaultContentType = hasMultipleContentTypes
    ? uniqueContentTypes.includes('text/plain')
      ? 'text/plain'
      : getDefaultContentType(uniqueContentTypes)
    : (uniqueContentTypes[0] ?? 'application/json');

  const getContentTypeReturnType = (
    contentType: string | undefined,
    value: string,
  ): string => {
    if (!contentType) return value;
    if (contentType.includes('json') || contentType.includes('+json')) {
      return value;
    }
    if (contentType.startsWith('text/') || contentType.includes('xml')) {
      return 'string';
    }
    return 'Blob';
  };

  const jsonSuccessValues = [
    ...new Set(
      successTypes
        .filter(
          ({ contentType }) =>
            !!contentType &&
            (contentType.includes('json') || contentType.includes('+json')),
        )
        .map(({ value }) => value),
    ),
  ];

  const jsonReturnType =
    jsonSuccessValues.length > 0 ? jsonSuccessValues.join(' | ') : 'unknown';

  let jsonValidationPipe = shouldValidateResponse
    ? `.pipe(map(data => ${schemaValueRef}.parse(data)))`
    : '';
  if (
    hasMultipleContentTypes &&
    !shouldValidateResponse &&
    override.angular.runtimeValidation &&
    isZodOutput &&
    jsonSuccessValues.length === 1
  ) {
    const jsonType = jsonSuccessValues[0];
    const jsonIsPrimitive = isPrimitiveResponseType(jsonType);
    const jsonHasSchema = hasSchemaImport(response.imports, jsonType);
    if (!jsonIsPrimitive && jsonHasSchema) {
      const jsonSchemaRef = getSchemaValueRef(jsonType);
      jsonValidationPipe = `.pipe(map(data => ${jsonSchemaRef}.parse(data)))`;
    }
  }

  const multiImplementationReturnType = `Observable<${jsonReturnType} | string | Blob>`;

  const observeOptions = needsObserveBranching
    ? {
        body: generateOptions({ ...optionsInput, angularObserve: 'body' }),
        events: generateOptions({ ...optionsInput, angularObserve: 'events' }),
        response: generateOptions({
          ...optionsInput,
          angularObserve: 'response',
        }),
      }
    : undefined;

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
        const returnType = getContentTypeReturnType(contentType, value);
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
        return `${operationName}(${allParams}, options?: HttpClientOptions): Observable<${returnType}>;`;
      })
      .join('\n  ');

    const requiredPart = requiredProps.map((p) => p.definition).join(',\n    ');
    const optionalPart = optionalProps.map((p) => p.definition).join(',\n    ');
    const allParams = [requiredPart, 'accept?: string', optionalPart]
      .filter(Boolean)
      .join(',\n    ');
    contentTypeOverloads += `\n  ${operationName}(${allParams}, options?: HttpClientOptions): ${multiImplementationReturnType};`;
  }

  const observeOverloads =
    isRequestOptions && !hasMultipleContentTypes
      ? `${functionName}(${propsDefinition} options?: HttpClientOptions & { observe?: 'body' }): Observable<${isModelType ? 'TData' : dataType}>;\n ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'events' }): Observable<HttpEvent<${isModelType ? 'TData' : dataType}>>;\n ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'response' }): Observable<AngularHttpResponse<${isModelType ? 'TData' : dataType}>>;`
      : '';

  const overloads = contentTypeOverloads || observeOverloads;

  const observableDataType = isModelType ? 'TData' : dataType;
  const singleImplementationReturnType = isRequestOptions
    ? `Observable<${observableDataType} | HttpEvent<${observableDataType}> | AngularHttpResponse<${observableDataType}>>`
    : `Observable<${observableDataType}>`;

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
  ): ${multiImplementationReturnType} {${bodyForm}
    const headers = options?.headers instanceof HttpHeaders
      ? options.headers.set('Accept', accept)
      : { ...(options?.headers ?? {}), Accept: accept };

    if (accept.includes('json') || accept.includes('+json')) {
      return this.http.${verb}<${jsonReturnType}>(\`${route}\`, {
        ...options,
        responseType: 'json',
        headers,
      })${jsonValidationPipe};
    } else if (accept.startsWith('text/') || accept.includes('xml')) {
      return this.http.${verb}(\`${route}\`, {
        ...options,
        responseType: 'text',
        headers,
      }) as Observable<string>;
    } else {
      return this.http.${verb}(\`${route}\`, {
        ...options,
        responseType: 'blob',
        headers,
      }) as Observable<Blob>;
    }
  }
`;
  }

  const observeImplementation = isRequestOptions
    ? `${paramsDeclaration}if (options?.observe === 'events') {
      return this.http.${verb}${isModelType ? '<TData>' : ''}(${observeOptions?.events ?? options});
    }

    if (options?.observe === 'response') {
      return this.http.${verb}${isModelType ? '<TData>' : ''}(${observeOptions?.response ?? options});
    }

    return this.http.${verb}${isModelType ? '<TData>' : ''}(${observeOptions?.body ?? options})${validationPipe};`
    : `return this.http.${verb}${isModelType ? '<TData>' : ''}(${options})${validationPipe};`;

  return ` ${overloads}
  ${functionName}(
    ${toObjectString(props, 'implementation')} ${
      isRequestOptions
        ? `options?: HttpClientOptions & { observe?: 'body' | 'events' | 'response' }`
        : ''
    }): ${singleImplementationReturnType} {${bodyForm}
    ${observeImplementation}
  }
`;
};

export const generateAngular: ClientBuilder = (verbOptions, options) => {
  const isZodOutput =
    typeof options.context.output.schemas === 'object' &&
    options.context.output.schemas.type === 'zod';
  const responseType = verbOptions.response.definition.success;
  const isPrimitiveResponse = isPrimitiveResponseType(responseType);
  const shouldUseRuntimeValidation =
    verbOptions.override.angular.runtimeValidation && isZodOutput;

  const normalizedVerbOptions = (() => {
    if (!shouldUseRuntimeValidation) return verbOptions;

    let result = verbOptions;

    if (
      !isPrimitiveResponse &&
      hasSchemaImport(result.response.imports, responseType)
    ) {
      result = {
        ...result,
        response: {
          ...result.response,
          imports: result.response.imports.map((imp) =>
            imp.name === responseType ? { ...imp, values: true } : imp,
          ),
        },
      };
    }

    const successTypes = result.response.types.success;
    const uniqueContentTypes = [
      ...new Set(successTypes.map((t) => t.contentType).filter(Boolean)),
    ];
    if (uniqueContentTypes.length > 1) {
      const jsonSchemaNames = [
        ...new Set(
          successTypes
            .filter(
              ({ contentType }) =>
                !!contentType &&
                (contentType.includes('json') ||
                  contentType.includes('+json')),
            )
            .map(({ value }) => value),
        ),
      ];
      if (jsonSchemaNames.length === 1) {
        const jsonType = jsonSchemaNames[0];
        const jsonIsPrimitive = isPrimitiveResponseType(jsonType);
        if (!jsonIsPrimitive && hasSchemaImport(result.response.imports, jsonType)) {
          result = {
            ...result,
            response: {
              ...result.response,
              imports: result.response.imports.map((imp) =>
                imp.name === jsonType ? { ...imp, values: true } : imp,
              ),
            },
          };
        }
      }
    }

    return result;
  })();

  const implementation = generateHttpClientImplementation(
    normalizedVerbOptions,
    options,
  );

  const imports = [
    ...generateVerbImports(normalizedVerbOptions),
    ...(implementation.includes('.pipe(map(')
      ? [{ name: 'map', values: true, importPath: 'rxjs' }]
      : []),
  ];

  return { implementation, imports };
};

export const getHttpClientReturnTypes = (operationNames: string[]) =>
  returnTypesRegistry.getFooter(operationNames);

export const resetHttpClientReturnTypes = () => {
  returnTypesRegistry.reset();
};

export { generateAngularTitle } from './utils';
