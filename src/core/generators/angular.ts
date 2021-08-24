import {
  GeneratorClient,
  GeneratorDependency,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { GetterBody } from '../../types/getters';
import { pascal } from '../../utils/case';
import { sanitize, toObjectString } from '../../utils/string';
import { generateVerbImports } from './imports';
import {
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
}: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator?: boolean;
  provideInRoot: boolean;
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
    ? `type ThirdParameter<T extends (...args: any) => any> = T extends (
  config: any,
  httpClient: any,
  args: infer P,
) => any
  ? P
  : never;`
    : ''
}

@Injectable(${provideInRoot ? `{ providedIn: 'root' }` : ''})
export class ${title} {
  constructor(
    private http: HttpClient,
  ) {}`;

export const generateAngularFooter = () => '};\n';

const generateQueryFormDataFunction = ({
  isFormData,
  formData,
  body,
}: {
  body: GetterBody;
  formData: GeneratorMutator | undefined;
  isFormData: boolean;
}) => {
  if (!isFormData) {
    return '';
  }

  if (formData && body.formData) {
    return `const formData = ${formData.name}(${body.implementation})`;
  }

  return body.formData;
};

const generateImplementation = (
  {
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    override,
    formData,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;

  const formDataImplementation = generateQueryFormDataFunction({
    isFormData,
    formData,
    body,
  });

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      queryParams,
      response,
      verb,
      isFormData,
    });

    const isMutatorHasThirdArg = mutator.mutatorFn.length > 2;
    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override?.requestOptions,
          isMutatorHasThirdArg,
        )
      : '';

    return ` ${operationName}<TData = ${
      response.definition.success || 'unknown'
    }>(\n    ${toObjectString(props, 'implementation')}\n ${
      isRequestOptions && isMutatorHasThirdArg
        ? `options?: ThirdParameter<typeof ${mutator.name}>`
        : ''
    }) {${formDataImplementation}
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
    queryParams,
    response,
    verb,
    requestOptions: override?.requestOptions,
    isFormData,
  });

  return ` ${operationName}<TData = ${
    response.definition.success || 'unknown'
  }>(\n    ${toObjectString(props, 'implementation')} ${
    isRequestOptions ? `options?: HttpClientOptions\n` : ''
  }  ): Observable<TData>  {${formDataImplementation}
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
