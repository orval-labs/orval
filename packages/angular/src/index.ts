import {
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientFooterBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  type ClientTitleBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getAngularFilteredParamsCallExpression,
  getAngularFilteredParamsHelperBody,
  getDefaultContentType,
  isBoolean,
  pascal,
  sanitize,
  toObjectString,
} from '@orval/core';

const ANGULAR_DEPENDENCIES = [
  {
    exports: [
      { name: 'HttpClient', values: true },
      { name: 'HttpHeaders', values: true },
      { name: 'HttpParams' },
      { name: 'HttpContext' },
      { name: 'HttpResponse', alias: 'AngularHttpResponse' }, // alias to prevent naming conflict with msw
      { name: 'HttpEvent' },
    ],
    dependency: '@angular/common/http',
  },
  {
    exports: [
      { name: 'Injectable', values: true },
      { name: 'inject', values: true },
    ],
    dependency: '@angular/core',
  },
  {
    exports: [
      { name: 'Observable', values: true },
      { name: 'map', values: true },
    ],
    dependency: 'rxjs',
  },
] as const satisfies readonly GeneratorDependency[];

type ReturnTypesToWrite = Map<string, string>;

export const getAngularDependencies: ClientDependenciesBuilder = () => [
  ...ANGULAR_DEPENDENCIES,
];

export const generateAngularTitle: ClientTitleBuilder = (title) => {
  const sanTitle = sanitize(title);
  return `${pascal(sanTitle)}Service`;
};

const createAngularHeader =
  (): ClientHeaderBuilder =>
  ({
    title,
    isRequestOptions,
    isMutator,
    isGlobalMutator,
    provideIn,
    verbOptions,
    tag,
  }) => {
    const relevantVerbs = tag
      ? Object.values(verbOptions).filter((v) => v.tags.includes(tag as string))
      : Object.values(verbOptions);
    const hasQueryParams = relevantVerbs.some((v) => v.queryParams);
    return `
${
  isRequestOptions && !isGlobalMutator
    ? `interface HttpClientOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  params?:
        | HttpParams
      | Record<string, string | number | boolean | Array<string | number | boolean>>;
  reportProgress?: boolean;
  withCredentials?: boolean;
  credentials?: RequestCredentials;
  keepalive?: boolean;
  priority?: RequestPriority;
  cache?: RequestCache;
  mode?: RequestMode;
  redirect?: RequestRedirect;
  referrer?: string;
  integrity?: string;
  referrerPolicy?: ReferrerPolicy;
  transferCache?: {includeHeaders?: string[]} | boolean;
}

${hasQueryParams ? getAngularFilteredParamsHelperBody() : ''}`
    : ''
}

${
  isRequestOptions && isMutator
    ? `// eslint-disable-next-line
    type ThirdParameter<T extends (...args: any) => any> = T extends (
  config: any,
  httpClient: any,
  args: infer P,
) => any
  ? P
  : never;`
    : ''
}

@Injectable(${provideIn ? `{ providedIn: '${isBoolean(provideIn) ? 'root' : provideIn}' }` : ''})
export class ${title} {
  private readonly http = inject(HttpClient);
`;
  };

export const generateAngularHeader: ClientHeaderBuilder = (params) =>
  createAngularHeader()(params);

const standaloneFooterReturnTypesToWrite = new Map<string, string>();

const createAngularFooter =
  (returnTypesToWrite: ReturnTypesToWrite): ClientFooterBuilder =>
  ({ operationNames }) => {
    let footer = '};\n\n';

    for (const operationName of operationNames) {
      if (returnTypesToWrite.has(operationName)) {
        // Map.has ensures Map.get will not return undefined, but TS still complains
        // bug https://github.com/microsoft/TypeScript/issues/13086
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        footer += returnTypesToWrite.get(operationName) + '\n';
      }
    }

    return footer;
  };

export const generateAngularFooter: ClientFooterBuilder = (params) =>
  createAngularFooter(standaloneFooterReturnTypesToWrite)(params);

const generateImplementation = (
  returnTypesToWrite: ReturnTypesToWrite,
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

  // Detect if Zod runtime validation should be applied
  const isPrimitiveType = [
    'string',
    'number',
    'boolean',
    'void',
    'unknown',
  ].includes(dataType);
  const hasSchema = response.imports.some((imp) => imp.name === dataType);
  const isZodOutput =
    typeof context.output.schemas === 'object' &&
    context.output.schemas.type === 'zod';
  const isValidateResponse =
    override.angular?.runtimeValidation &&
    isZodOutput &&
    !isPrimitiveType &&
    hasSchema;
  const schemaValueRef =
    isValidateResponse && dataType === 'Error' ? 'ErrorSchema' : dataType;
  // The observe-mode branches use <TData> generics, so cast the parse
  // result to keep TypeScript happy.  The multi-content-type branch uses
  // concrete types and does not need the cast (see jsonValidationPipe).
  const validationPipe = isValidateResponse
    ? `.pipe(map(data => ${schemaValueRef}.parse(data) as TData))`
    : '';

  returnTypesToWrite.set(
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

  // Check for multiple content types in success responses
  const successTypes = response.types.success;
  const uniqueContentTypes = [
    ...new Set(successTypes.map((t) => t.contentType).filter(Boolean)),
  ];
  const hasMultipleContentTypes = uniqueContentTypes.length > 1;

  // When observe branching is active AND there are query params, extract
  // the params computation to a local const to avoid duplicating it in
  // every observe branch.
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

  const options = generateOptions({
    ...optionsBase,
    ...(angularParamsRef ? { angularParamsRef } : {}),
  });

  // For multiple content types, determine the default
  const defaultContentType = hasMultipleContentTypes
    ? uniqueContentTypes.includes('text/plain')
      ? 'text/plain'
      : getDefaultContentType(uniqueContentTypes)
    : (uniqueContentTypes[0] ?? 'application/json');
  const getContentTypeReturnType = (
    contentType: string | undefined,
    value: string,
  ): string => {
    if (!contentType) {
      return value;
    }

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

  // For multi-content-type operations the overall dataType may be primitive
  // (e.g., 'string' when text/plain is the first content type) but the JSON
  // branch still needs validation against its own schema.  Multi-content-type
  // branches use concrete return types (not <TData>), so no generic cast.
  let jsonValidationPipe = isValidateResponse
    ? `.pipe(map(data => ${schemaValueRef}.parse(data)))`
    : '';
  if (
    hasMultipleContentTypes &&
    !isValidateResponse &&
    override.angular?.runtimeValidation &&
    isZodOutput
  ) {
    if (jsonSuccessValues.length === 1) {
      const jsonType = jsonSuccessValues[0];
      const jsonIsPrimitive = [
        'string',
        'number',
        'boolean',
        'void',
        'unknown',
      ].includes(jsonType);
      const jsonHasSchema = response.imports.some(
        (imp) => imp.name === jsonType,
      );
      if (!jsonIsPrimitive && jsonHasSchema) {
        const jsonSchemaRef = jsonType === 'Error' ? 'ErrorSchema' : jsonType;
        jsonValidationPipe = `.pipe(map(data => ${jsonSchemaRef}.parse(data)))`;
      }
    }
  }

  const multiImplementationReturnType = `Observable<${jsonReturnType} | string | Blob>`;

  const withObserveMode = (
    generatedOptions: string,
    observeMode: 'body' | 'events' | 'response',
  ): string => {
    const spreadPattern =
      "...(options as Omit<NonNullable<typeof options>, 'observe'>),";

    if (generatedOptions.includes(spreadPattern)) {
      return generatedOptions.replace(
        spreadPattern,
        `${spreadPattern}\n        observe: '${observeMode}',`,
      );
    }

    return generatedOptions.replace(
      "(options as Omit<NonNullable<typeof options>, 'observe'>)",
      `{ ...(options as Omit<NonNullable<typeof options>, 'observe'>), observe: '${observeMode}' }`,
    );
  };

  const observeOptions = needsObserveBranching
    ? {
        body: withObserveMode(options, 'body'),
        events: withObserveMode(options, 'events'),
        response: withObserveMode(options, 'response'),
      }
    : undefined;

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
      ? `${functionName}(${propsDefinition} options?: HttpClientOptions & { observe?: 'body' }): Observable<${isModelType ? 'TData' : dataType}>;
 ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'events' }): Observable<HttpEvent<${isModelType ? 'TData' : dataType}>>;
 ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'response' }): Observable<AngularHttpResponse<${isModelType ? 'TData' : dataType}>>;`
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
      return this.http.${verb}${isModelType ? '<TData>' : ''}(${
        observeOptions?.events ?? options
      });
    }

    if (options?.observe === 'response') {
      return this.http.${verb}${isModelType ? '<TData>' : ''}(${
        observeOptions?.response ?? options
      });
    }

    return this.http.${verb}${isModelType ? '<TData>' : ''}(${
      observeOptions?.body ?? options
    })${validationPipe};`
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

const createAngularClient =
  (returnTypesToWrite: ReturnTypesToWrite): ClientBuilder =>
  (verbOptions, options, _outputClient, _output) => {
    // Keep signature aligned with ClientBuilder without tripping TS noUnusedParameters
    void _outputClient;
    void _output;

    // Detect if Zod runtime validation should be applied
    const isZodOutput =
      typeof options.context.output.schemas === 'object' &&
      options.context.output.schemas.type === 'zod';
    const responseType = verbOptions.response.definition.success;
    const isPrimitiveResponse = [
      'string',
      'number',
      'boolean',
      'void',
      'unknown',
    ].includes(responseType);
    const shouldUseRuntimeValidation =
      verbOptions.override.angular?.runtimeValidation && isZodOutput;

    // Promote schema import from type-only to value import when runtime
    // validation is active, so the generated code can call Schema.parse()
    const normalizedVerbOptions = (() => {
      if (!shouldUseRuntimeValidation) return verbOptions;

      let result = verbOptions;

      // Promote the primary response schema
      if (
        !isPrimitiveResponse &&
        result.response.imports.some((imp) => imp.name === responseType)
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

      // For multi-content-type operations, also promote the JSON-specific
      // schema even when the primary content type is non-JSON (e.g.,
      // showPetById where text/plain is the default but application/json
      // returns Pet which needs .parse()).
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
          const jsonIsPrimitive = [
            'string',
            'number',
            'boolean',
            'void',
            'unknown',
          ].includes(jsonType);
          if (
            !jsonIsPrimitive &&
            result.response.imports.some((imp) => imp.name === jsonType)
          ) {
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

    const imports = generateVerbImports(normalizedVerbOptions);
    const implementation = generateImplementation(
      returnTypesToWrite,
      normalizedVerbOptions,
      options,
    );

    return { implementation, imports };
  };

const standaloneReturnTypesToWrite = new Map<string, string>();

export const generateAngular: ClientBuilder = (
  verbOptions,
  options,
  outputClient,
  output,
) =>
  createAngularClient(standaloneReturnTypesToWrite)(
    verbOptions,
    options,
    outputClient,
    output,
  );

const createAngularClientBuilder = (): ClientGeneratorsBuilder => {
  const returnTypesToWrite = new Map<string, string>();

  return {
    client: createAngularClient(returnTypesToWrite),
    header: createAngularHeader(),
    dependencies: getAngularDependencies,
    footer: createAngularFooter(returnTypesToWrite),
    title: generateAngularTitle,
  };
};

export const builder: () => () => ClientGeneratorsBuilder = () => {
  return () => createAngularClientBuilder();
};

export default builder;
