import {
  GeneratorClient,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { isObject } from '../../utils/is';
import { sanitize, stringify, toObjectString } from '../../utils/string';
import { generateVerbImports } from './imports';
import { generateMutatorConfig, generateOptions } from './options';

const ANGULAR_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'HttpClient', values: true },
      { name: 'HttpHeaders' },
      { name: 'HttpParams' },
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
}: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator?: boolean;
}) => `
${
  isRequestOptions && !isGlobalMutator
    ? `type HttpClientOptions = {
  headers?: HttpHeaders | {
      [header: string]: string | string[];
  };
  observe?: any;
  params?: HttpParams | {
      [param: string]: string | string[];
  };
  reportProgress?: boolean;
  responseType?: any;
  withCredentials?: boolean;
}`
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

@Injectable()
export class ${title} {
  constructor(
    private http: HttpClient,
  ) {}`;

export const generateAngularFooter = () => '};\n';

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
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      queryParams,
      response,
      verb,
      isFormData
    });

    const requestOptions = isRequestOptions
      ? isObject(override?.requestOptions)
        ? ` // eslint-disable-next-line\n// @ts-ignore\n {${stringify(
            override?.requestOptions,
          )?.slice(1, -1)} ...options}`
        : '// eslint-disable-next-line\n// @ts-ignore\n options'
      : '';

    return ` ${operationName}<TData = ${
      response.definition.success || 'unknown'
    }>(\n    ${toObjectString(props, 'implementation')}\n ${
      isRequestOptions ? `options?: ThirdParameter<typeof ${mutator.name}>` : ''
    }) {${isFormData ? body.formData : ''}
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
    isFormData
  });

  return ` ${operationName}<TData = ${
    response.definition.success || 'unknown'
  }>(\n    ${toObjectString(props, 'implementation')} ${
    isRequestOptions ? `options?: HttpClientOptions\n` : ''
  }  ): Observable<TData>  {${isFormData ? body.formData : ''}
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
