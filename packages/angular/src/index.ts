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
  VERBS_WITH_BODY,
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
    exports: [{ name: 'Injectable', values: true }],
    dependency: '@angular/core',
  },
  {
    exports: [{ name: 'Observable', values: true }],
    dependency: 'rxjs',
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
    ? `type HttpClientOptions = {
  headers?: HttpHeaders | {
      [header: string]: string | string[];
  };
  context?: HttpContext;
  observe?: any;
  params?: HttpParams | {
    [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean>;
  };
  reportProgress?: boolean;
  responseType?: any;
  withCredentials?: boolean;
};`
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
  constructor(
    private http: HttpClient,
  ) {}`;

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
  const isFormData = override?.formData !== false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;
  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);
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
      isBodyVerb,
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
  const overloads = isRequestOptions
    ? `${operationName}<TData = ${dataType}>(\n    ${propsDefinition} options?: Omit<HttpClientOptions, 'observe'> & { observe?: 'body' }\n  ): Observable<TData>;
    ${operationName}<TData = ${dataType}>(\n    ${propsDefinition} options?: Omit<HttpClientOptions, 'observe'> & { observe?: 'response' }\n  ): Observable<AngularHttpResponse<TData>>;
    ${operationName}<TData = ${dataType}>(\n    ${propsDefinition} options?: Omit<HttpClientOptions, 'observe'> & { observe?: 'events' }\n  ): Observable<HttpEvent<TData>>;`
    : '';

  return ` ${overloads}${operationName}<TData = ${dataType}>(\n    ${toObjectString(
    props,
    'implementation',
  )} ${
    isRequestOptions ? `options?: HttpClientOptions\n` : ''
  }  ): Observable<TData>  {${bodyForm}
    return this.http.${verb}<TData>(${options});
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
