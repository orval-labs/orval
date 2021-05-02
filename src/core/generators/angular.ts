import {
  GeneratorClient,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { sanitize, toObjectString } from '../../utils/string';
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

export const generateAngularHeader = (title: string) => `
type HttpClientOptions = {
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
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      queryParams,
      response,
      verb,
    });

    return ` ${operationName} = <Data = unknown>(\n    ${toObjectString(
      props,
      'implementation',
    )}\n  ) => {
      return ${mutator.name}<Data extends unknown ? ${
      response.definition
    } : Data>(${mutatorConfig}, this.http);
    }
  `;
  }

  const options = generateOptions({
    route,
    body,
    queryParams,
    response,
    verb,
  });

  return ` ${operationName} = <Data = unknown>(\n    ${toObjectString(
    props,
    'implementation',
  )} config?: HttpClientOptions\n  ) => {${body.formData}
    return this.http.${verb}<Data extends unknown ? ${
    response.definition
  } : Data>(${options});
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
