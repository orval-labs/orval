import { VERBS_WITH_BODY } from '../../constants';
import {
  GeneratorClient,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { isBoolean } from '../../utils/is';
import { sanitize, toObjectString } from '../../utils/string';
import { generateVerbImports } from './imports';
import {
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
} from './options';

const ANGULAR_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'HttpClient', values: true },
      { name: 'HttpHeaders' },
      { name: 'HttpParams' },
      { name: 'HttpContext' },
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

let returnTypesToWrite: string[] = [];

export const getAngularDependencies = () => ANGULAR_DEPENDENCIES;

export const generateAngularTitle = (title: string) => {
  const sanTitle = sanitize(title);
  return `${pascal(sanTitle)}Service`;
};

export const generateAngularHeader = ({
  title,
  isRequestOptions,
  isMutator,
  isGlobalMutator,
  provideInRoot,
  provideIn,
}: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator?: boolean;
  provideInRoot: boolean;
  provideIn: boolean | 'root' | 'any';
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

export const generateAngularFooter = () => {
  const footer = `};\n\n${returnTypesToWrite.join('\n')}`;
  // quick fix to clear global state
  returnTypesToWrite = [];
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
  }: GeneratorVerbOptions,
  { route, context }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);
  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  const dataType = response.definition.success || 'unknown';

  returnTypesToWrite.push(
    `export type ${pascal(
      operationName,
    )}ClientResult = NonNullable<${dataType}>`,
  );

  if (mutator) {
    const isExactOptionalPropertyTypes =
      !!context.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;

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
    isAngular: true,
  });

  return ` ${operationName}<TData = ${dataType}>(\n    ${toObjectString(
    props,
    'implementation',
  )} ${
    isRequestOptions ? `options?: HttpClientOptions\n` : ''
  }  ): Observable<TData>  {${bodyForm}
    return this.http.${verb}<TData>(${options});
  }
`;
};

export const generateAngular = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): GeneratorClient => {
  const imports = generateVerbImports(verbOptions);
  const implementation = generateImplementation(verbOptions, options);

  return { implementation, imports };
};
