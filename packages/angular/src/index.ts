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

const ANGULAR_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'HttpClient', values: true },
      { name: 'HttpHeaders' },
      { name: 'HttpParams', values: true },
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
];

const returnTypesToWrite = new Map<string, string>();

export const getAngularDependencies: ClientDependenciesBuilder = () =>
  ANGULAR_DEPENDENCIES;

export const generateAngularTitle: ClientTitleBuilder = (title) => {
  const sanTitle = sanitize(title);
  return `${pascal(sanTitle)}Service`;
};

export const generateAngularHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideIn,
}) => {
  returnTypesToWrite.clear();
  return `
${
  isRequestOptions && !isGlobalMutator
    ? `interface HttpClientOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  params?:
        | HttpParams
        | Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>;
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

@Injectable(${
    provideIn
      ? `{ providedIn: '${isBoolean(provideIn) ? 'root' : provideIn}' }`
      : ''
  })
export class ${title} {
  private readonly http = inject(HttpClient);
`;
};

export const generateAngularFooter: ClientFooterBuilder = ({
  operationNames,
}) => {
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

const generateImplementation = (
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
  const defaultContentType = hasMultipleContentTypes
    ? uniqueContentTypes.includes('text/plain')
      ? 'text/plain'
      : getDefaultContentType(uniqueContentTypes)
    : (uniqueContentTypes[0] ?? 'application/json');
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
      ? `${functionName}(${propsDefinition} options?: HttpClientOptions & { observe?: 'body' }): Observable<${isModelType ? 'TData' : dataType}>;
 ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'events' }): Observable<HttpEvent<${isModelType ? 'TData' : dataType}>>;
 ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'response' }): Observable<AngularHttpResponse<${isModelType ? 'TData' : dataType}>>;`
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
  const implementation = generateImplementation(verbOptions, options);

  return { implementation, imports };
};

const angularClientBuilder: ClientGeneratorsBuilder = {
  client: generateAngular,
  header: generateAngularHeader,
  dependencies: getAngularDependencies,
  footer: generateAngularFooter,
  title: generateAngularTitle,
};

export const builder = () => () => angularClientBuilder;

export default builder;
