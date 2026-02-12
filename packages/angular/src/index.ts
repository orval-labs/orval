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
    exports: [{ name: 'Observable', values: true }],
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
  ({ title, isRequestOptions, isMutator, isGlobalMutator, provideIn }) => {
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
  timeout?: number;
}`
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

  const options = generateOptions(optionsBase);

  const propsDefinition = toObjectString(props, 'definition');

  // Check for multiple content types in success responses
  const successTypes = response.types.success;
  const uniqueContentTypes = [
    ...new Set(successTypes.map((t) => t.contentType).filter(Boolean)),
  ];
  const hasMultipleContentTypes = uniqueContentTypes.length > 1;

  // For multiple content types, determine the default
  const defaultContentType = hasMultipleContentTypes
    ? uniqueContentTypes.includes('text/plain')
      ? 'text/plain'
      : getDefaultContentType(uniqueContentTypes)
    : (uniqueContentTypes[0] ?? 'application/json');
  const defaultType = hasMultipleContentTypes
    ? successTypes.find((t) => t.contentType === defaultContentType)
    : undefined;
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

  const defaultReturnType = getContentTypeReturnType(
    defaultType?.contentType,
    defaultType?.value ?? dataType,
  );

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

  const observeOptions =
    isRequestOptions && !hasMultipleContentTypes
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
    contentTypeOverloads += `\n  ${operationName}(${allParams}, options?: HttpClientOptions): Observable<${defaultReturnType}>;`;
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
    const multiImplementationReturnType = `Observable<${jsonReturnType} | string | Blob>`;

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
      });
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
    ? `if (options?.observe === 'events') {
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
    });`
    : `return this.http.${verb}${isModelType ? '<TData>' : ''}(${options});`;

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
    const imports = generateVerbImports(verbOptions);
    const implementation = generateImplementation(
      returnTypesToWrite,
      verbOptions,
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
