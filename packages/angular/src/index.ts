import {
  ClientBuilder,
  ClientDependenciesBuilder,
  ClientFooterBuilder,
  ClientGeneratorsBuilder,
  ClientHeaderBuilder,
  ClientTitleBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
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
  {
    exports: [{ name: 'DeepNonNullable' }],
    dependency: '@orval/core',
  },
];

const returnTypesToWrite: Map<string, string> = new Map();

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
}) => `
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

export const generateAngularFooter: ClientFooterBuilder = ({
  operationNames,
}) => {
  let footer = '};\n\n';

  operationNames.forEach((operationName) => {
    if (returnTypesToWrite.has(operationName)) {
      footer += returnTypesToWrite.get(operationName) + '\n';
    }
  });

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
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData.disabled === false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;
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
    `export type ${pascal(operationName)}ClientResult = ${
      dataType === 'null'
        ? 'never' // NonNullable<null> is the type never
        : `NonNullable<${dataType}>`
    };`,
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
          override?.requestOptions,
          mutator.hasThirdArg,
        )
      : '';

    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(`(\\w*):\\s?${body.definition}`),
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
    requestOptions: override?.requestOptions,
    isFormData,
    isFormUrlEncoded,
    paramsSerializer,
    paramsSerializerOptions: override?.paramsSerializerOptions,
    isAngular: true,
    isExactOptionalPropertyTypes,
    hasSignal: false,
  });

  const propsDefinition = toObjectString(props, 'definition');
  const isModelType = dataType !== 'Blob' && dataType !== 'string';
  let functionName = operationName;
  if (isModelType) functionName += `<TData = ${dataType}>`;

  const overloads = isRequestOptions
    ? `${functionName}(${propsDefinition} options?: HttpClientOptions & { observe?: 'body' }): Observable<${isModelType ? 'TData' : dataType}>;
 ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'events' }): Observable<HttpEvent<${isModelType ? 'TData' : dataType}>>;
 ${functionName}(${propsDefinition} options?: HttpClientOptions & { observe: 'response' }): Observable<AngularHttpResponse<${isModelType ? 'TData' : dataType}>>;`
    : '';

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
