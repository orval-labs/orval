import {
  camel,
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientFooterBuilder,
  type ClientHeaderBuilder,
  type ContextSpec,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  type GeneratorVerbOptions,
  getAngularFilteredParamsCallExpression,
  getAngularFilteredParamsHelperBody,
  getDefaultContentType,
  getEnumImplementation,
  isBoolean,
  pascal,
  toObjectString,
} from '@orval/core';

import { ANGULAR_HTTP_CLIENT_DEPENDENCIES } from './constants';
import {
  HTTP_CLIENT_OBSERVE_OPTIONS_TEMPLATE,
  HTTP_CLIENT_OPTIONS_TEMPLATE,
  THIRD_PARAMETER_TEMPLATE,
} from './types';
import {
  createReturnTypesRegistry,
  isPrimitiveType,
  isZodSchemaOutput,
} from './utils';

/**
 * Narrowed context for `generateHttpClientImplementation`.
 *
 * The implementation only reads `context.output`, so callers don't need
 * to supply a full `ContextSpec` (which also requires `target`, `workspace`,
 * `spec`, etc.).
 */
export type HttpClientGeneratorContext = {
  route: string;
  context: Pick<ContextSpec, 'output'>;
};

// NOTE: Module-level singleton — reset() is called at the start of each
// header builder invocation (generateAngularHeader). Must stay in sync with
// the generation lifecycle.
const returnTypesRegistry = createReturnTypesRegistry();

const hasSchemaImport = (
  imports: readonly { name: string }[],
  typeName: string | undefined,
): boolean =>
  typeName != undefined && imports.some((imp) => imp.name === typeName);

const getSchemaValueRef = (typeName: string): string =>
  typeName === 'Error' ? 'ErrorSchema' : typeName;

const getSchemaOutputTypeRef = (typeName: string): string =>
  typeName === 'Error' ? 'ErrorOutput' : `${typeName}Output`;

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

export const getAngularDependencies: ClientDependenciesBuilder = () => [
  ...ANGULAR_HTTP_CLIENT_DEPENDENCIES,
];

export const getAcceptHelperName = (operationName: string) =>
  `${pascal(operationName)}Accept`;

export const getUniqueContentTypes = (
  successTypes: GeneratorVerbOptions['response']['types']['success'],
) => [...new Set(successTypes.map((t) => t.contentType).filter(Boolean))];

const toAcceptHelperKey = (contentType: string): string =>
  contentType
    .replaceAll(/[^A-Za-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .toLowerCase();

const buildAcceptHelper = (
  operationName: string,
  contentTypes: string[],
  output: ContextSpec['output'],
): string => {
  const acceptHelperName = getAcceptHelperName(operationName);
  const unionValue = contentTypes
    .map((contentType) => `'${contentType}'`)
    .join(' | ');
  const names = contentTypes.map(toAcceptHelperKey);
  const implementation = getEnumImplementation(
    unionValue,
    names,
    undefined,
    output.override.namingConvention.enum,
  );

  return `export type ${acceptHelperName} = typeof ${acceptHelperName}[keyof typeof ${acceptHelperName}];

export const ${acceptHelperName} = {
${implementation}} as const;`;
};

export const buildAcceptHelpers = (
  verbOptions: readonly GeneratorVerbOptions[],
  output: ContextSpec['output'],
): string =>
  verbOptions
    .flatMap((verbOption) => {
      const contentTypes = getUniqueContentTypes(
        verbOption.response.types.success,
      );
      if (contentTypes.length <= 1) return [];

      return [
        buildAcceptHelper(verbOption.operationName, contentTypes, output),
      ];
    })
    .join('\n\n');

export const generateAngularHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideIn,
  verbOptions,
  tag,
  output,
}) => {
  returnTypesRegistry.reset();

  const relevantVerbs = tag
    ? Object.values(verbOptions).filter((v) =>
        v.tags.some((t) => camel(t) === camel(tag)),
      )
    : Object.values(verbOptions);
  const hasQueryParams = relevantVerbs.some((v) => v.queryParams);
  const acceptHelpers = output ? buildAcceptHelpers(relevantVerbs, output) : '';

  return `
${
  isRequestOptions && !isGlobalMutator
    ? `${HTTP_CLIENT_OPTIONS_TEMPLATE}

${HTTP_CLIENT_OBSERVE_OPTIONS_TEMPLATE}

${hasQueryParams ? getAngularFilteredParamsHelperBody() : ''}`
    : ''
}

${isRequestOptions && isMutator ? THIRD_PARAMETER_TEMPLATE : ''}

${acceptHelpers}

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
  { route, context }: HttpClientGeneratorContext,
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
  const isPrimitive = isPrimitiveType(dataType);
  const hasSchema = hasSchemaImport(response.imports, dataType);
  const isZodOutput = isZodSchemaOutput(context.output);
  const shouldValidateResponse =
    override.angular.runtimeValidation &&
    isZodOutput &&
    !isPrimitive &&
    hasSchema;
  const parsedDataType = shouldValidateResponse
    ? getSchemaOutputTypeRef(dataType)
    : dataType;
  const getGeneratedResponseType = (
    value: string,
    contentType: string | undefined,
  ): string => {
    if (
      override.angular.runtimeValidation &&
      isZodOutput &&
      !!contentType &&
      (contentType.includes('json') || contentType.includes('+json')) &&
      !isPrimitiveType(value) &&
      hasSchemaImport(response.imports, value)
    ) {
      return getSchemaOutputTypeRef(value);
    }

    return getContentTypeReturnType(contentType, value);
  };
  const resultAliasType = mutator
    ? dataType
    : response.types.success.length <= 1
      ? parsedDataType
      : [
          ...new Set(
            response.types.success.map(({ value, contentType }) =>
              getGeneratedResponseType(value, contentType),
            ),
          ),
        ].join(' | ') || parsedDataType;
  const schemaValueRef = shouldValidateResponse
    ? getSchemaValueRef(dataType)
    : dataType;
  const validationPipe = shouldValidateResponse
    ? `.pipe(map(data => ${schemaValueRef}.parse(data) as TData))`
    : '';
  const responseValidationPipe = shouldValidateResponse
    ? `.pipe(map(response => response.clone({ body: ${schemaValueRef}.parse(response.body) as TData })))`
    : '';
  const eventValidationPipe = shouldValidateResponse
    ? `.pipe(map(event => event instanceof AngularHttpResponse ? event.clone({ body: ${schemaValueRef}.parse(event.body) as TData }) : event))`
    : '';

  returnTypesRegistry.set(
    operationName,
    `export type ${pascal(
      operationName,
    )}ClientResult = NonNullable<${resultAliasType}>`,
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
  const uniqueContentTypes = getUniqueContentTypes(successTypes);
  const hasMultipleContentTypes = uniqueContentTypes.length > 1;
  const acceptTypeName = hasMultipleContentTypes
    ? getAcceptHelperName(operationName)
    : undefined;

  const needsObserveBranching = isRequestOptions && !hasMultipleContentTypes;
  const angularParamsRef =
    isRequestOptions && queryParams ? 'filteredParams' : undefined;

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
    ? (successTypes.find(
        ({ contentType }) =>
          !!contentType &&
          (contentType.includes('json') || contentType.includes('+json')),
      )?.contentType ?? getDefaultContentType(uniqueContentTypes))
    : (uniqueContentTypes[0] ?? 'application/json');

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
  const parsedJsonReturnType =
    jsonSuccessValues.length === 1 &&
    override.angular.runtimeValidation &&
    isZodOutput &&
    !isPrimitiveType(jsonSuccessValues[0]) &&
    hasSchemaImport(response.imports, jsonSuccessValues[0])
      ? getSchemaOutputTypeRef(jsonSuccessValues[0])
      : jsonReturnType;

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
    const jsonIsPrimitive = isPrimitiveType(jsonType);
    const jsonHasSchema = hasSchemaImport(response.imports, jsonType);
    if (!jsonIsPrimitive && jsonHasSchema) {
      const jsonSchemaRef = getSchemaValueRef(jsonType);
      jsonValidationPipe = `.pipe(map(data => ${jsonSchemaRef}.parse(data)))`;
    }
  }

  const multiImplementationReturnType = `Observable<${parsedJsonReturnType} | string | Blob>`;
  const textSuccessTypes = successTypes.filter(
    ({ contentType, value }) =>
      !!contentType &&
      (contentType.startsWith('text/') ||
        contentType.includes('xml') ||
        value === 'string'),
  );
  const blobSuccessTypes = successTypes.filter(
    ({ contentType }) =>
      !!contentType &&
      !contentType.includes('json') &&
      !contentType.includes('+json') &&
      !contentType.startsWith('text/') &&
      !contentType.includes('xml'),
  );
  const multiReturnMembers = [
    parsedJsonReturnType,
    ...(textSuccessTypes.length > 0 ? ['string'] : []),
    ...(blobSuccessTypes.length > 0 ? ['Blob'] : []),
  ];
  const uniqueMultiReturnMembers = [...new Set(multiReturnMembers)];
  const refinedMultiImplementationReturnType = `Observable<${uniqueMultiReturnMembers.join(' | ')}>`;

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

  const isModelType =
    dataType !== 'Blob' && dataType !== 'string' && dataType !== 'ArrayBuffer';
  let functionName = operationName;
  if (isModelType && !hasMultipleContentTypes) {
    functionName += `<TData = ${parsedDataType}>`;
  }

  let contentTypeOverloads = '';
  if (hasMultipleContentTypes && isRequestOptions) {
    const requiredPart = props
      .filter((p) => p.required && !p.default)
      .map((p) => p.definition)
      .join(',\n    ');
    const optionalPart = props
      .filter((p) => !p.required || p.default)
      .map((p) => p.definition)
      .join(',\n    ');
    const branchOverloads = successTypes
      .filter(({ contentType }) => !!contentType)
      .map(({ contentType, value }) => {
        const returnType = getGeneratedResponseType(value, contentType);
        const overloadParams = [
          requiredPart,
          `accept: '${contentType}'`,
          optionalPart,
        ]
          .filter(Boolean)
          .join(',\n    ');

        return `${operationName}(${overloadParams}, options?: HttpClientOptions): Observable<${returnType}>;`;
      })
      .join('\n  ');
    const allParams = [
      requiredPart,
      `accept?: ${acceptTypeName ?? 'string'}`,
      optionalPart,
    ]
      .filter(Boolean)
      .join(',\n    ');
    contentTypeOverloads = `${branchOverloads}\n  ${operationName}(${allParams}, options?: HttpClientOptions): ${refinedMultiImplementationReturnType};`;
  }

  const observeOverloads =
    isRequestOptions && !hasMultipleContentTypes
      ? `${functionName}(${propsDefinition} options?: HttpClientBodyOptions): Observable<${isModelType ? 'TData' : parsedDataType}>;\n ${functionName}(${propsDefinition} options?: HttpClientEventOptions): Observable<HttpEvent<${isModelType ? 'TData' : parsedDataType}>>;\n ${functionName}(${propsDefinition} options?: HttpClientResponseOptions): Observable<AngularHttpResponse<${isModelType ? 'TData' : parsedDataType}>>;`
      : '';

  const overloads = contentTypeOverloads || observeOverloads;

  const observableDataType = isModelType ? 'TData' : parsedDataType;
  const singleImplementationReturnType = isRequestOptions
    ? `Observable<${observableDataType} | HttpEvent<${observableDataType}> | AngularHttpResponse<${observableDataType}>>`
    : `Observable<${observableDataType}>`;

  if (hasMultipleContentTypes) {
    const requiredPart = props
      .filter((p) => p.required && !p.default)
      .map((p) => p.implementation)
      .join(',\n    ');
    const optionalPart = props
      .filter((p) => !p.required || p.default)
      .map((p) => p.implementation)
      .join(',\n    ');
    const allParams = [
      requiredPart,
      `accept: ${acceptTypeName ?? 'string'} = '${defaultContentType}'`,
      optionalPart,
    ]
      .filter(Boolean)
      .join(',\n    ');

    return ` ${overloads}
  ${operationName}(
    ${allParams},
    ${isRequestOptions ? 'options?: HttpClientOptions' : ''}
  ): ${refinedMultiImplementationReturnType} {${bodyForm}
    ${paramsDeclaration}const headers = options?.headers instanceof HttpHeaders
      ? options.headers.set('Accept', accept)
      : { ...(options?.headers ?? {}), Accept: accept };

    if (accept.includes('json') || accept.includes('+json')) {
      return this.http.${verb}<${parsedJsonReturnType}>(\`${route}\`, {
        ...options,
        responseType: 'json',
        headers,
        ${angularParamsRef ? `params: ${angularParamsRef},` : ''}
      })${jsonValidationPipe};
    } else if (accept.startsWith('text/') || accept.includes('xml')) {
      return this.http.${verb}(\`${route}\`, {
        ...options,
        responseType: 'text',
        headers,
        ${angularParamsRef ? `params: ${angularParamsRef},` : ''}
      }) as Observable<string>;
    }${
      blobSuccessTypes.length > 0
        ? ` else {
      return this.http.${verb}(\`${route}\`, {
        ...options,
        responseType: 'blob',
        headers,
        ${angularParamsRef ? `params: ${angularParamsRef},` : ''}
      }) as Observable<Blob>;
    }`
        : `

    return this.http.${verb}<${parsedJsonReturnType}>(\`${route}\`, {
      ...options,
      responseType: 'json',
      headers,
      ${angularParamsRef ? `params: ${angularParamsRef},` : ''}
    })${jsonValidationPipe};`
    }
  }
`;
  }

  const observeImplementation = isRequestOptions
    ? `${paramsDeclaration}if (options?.observe === 'events') {
      return this.http.${verb}${isModelType ? '<TData>' : ''}(${observeOptions?.events ?? options})${eventValidationPipe};
    }

    if (options?.observe === 'response') {
      return this.http.${verb}${isModelType ? '<TData>' : ''}(${observeOptions?.response ?? options})${responseValidationPipe};
    }

    return this.http.${verb}${isModelType ? '<TData>' : ''}(${observeOptions?.body ?? options})${validationPipe};`
    : `return this.http.${verb}${isModelType ? '<TData>' : ''}(${options})${validationPipe};`;

  return ` ${overloads}
  ${functionName}(
    ${toObjectString(props, 'implementation')} ${
      isRequestOptions ? `options?: HttpClientObserveOptions` : ''
    }): ${singleImplementationReturnType} {${bodyForm}
    ${observeImplementation}
  }
`;
};

export const generateAngular: ClientBuilder = (verbOptions, options) => {
  const isZodOutput = isZodSchemaOutput(options.context.output);
  const responseType = verbOptions.response.definition.success;
  const isPrimitiveResponse = isPrimitiveType(responseType);
  const shouldUseRuntimeValidation =
    verbOptions.override.angular.runtimeValidation && isZodOutput;

  const normalizedVerbOptions = (() => {
    if (!shouldUseRuntimeValidation) return verbOptions;

    let result: GeneratorVerbOptions = {
      ...verbOptions,
      response: {
        ...verbOptions.response,
        imports: verbOptions.response.imports.map((imp) => ({
          ...imp,
          values: true,
        })),
      },
    };

    if (
      !isPrimitiveResponse &&
      hasSchemaImport(result.response.imports, responseType)
    ) {
      result = {
        ...result,
        response: {
          ...result.response,
          imports: [
            ...result.response.imports.map((imp) =>
              imp.name === responseType ? { ...imp, values: true } : imp,
            ),
            { name: getSchemaOutputTypeRef(responseType) },
          ],
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
                (contentType.includes('json') || contentType.includes('+json')),
            )
            .map(({ value }) => value),
        ),
      ];
      if (jsonSchemaNames.length === 1) {
        const jsonType = jsonSchemaNames[0];
        const jsonIsPrimitive = isPrimitiveType(jsonType);
        if (
          !jsonIsPrimitive &&
          hasSchemaImport(result.response.imports, jsonType)
        ) {
          result = {
            ...result,
            response: {
              ...result.response,
              imports: [
                ...result.response.imports.map((imp) =>
                  imp.name === jsonType ? { ...imp, values: true } : imp,
                ),
                { name: getSchemaOutputTypeRef(jsonType) },
              ],
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
