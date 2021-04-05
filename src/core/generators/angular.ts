import {
  GeneratorClient,
  GeneratorImport,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { sanitize, toObjectString } from '../../utils/string';
import { generateFormData } from './formData';
import { generateAxiosConfig, generateOptions } from './options';

const ANGULAR_DEPENDENCIES = [
  {
    exports: [{ name: 'HttpClient' }],
    dependency: '@angular/common/http',
  },
  {
    exports: [{ name: 'Injectable' }],
    dependency: '@angular/core',
  },
  {
    exports: [{ name: 'Observable' }],
    dependency: 'rxjs',
  },
];

export const getAngularDependencies = () => ANGULAR_DEPENDENCIES;

export const generateAngularTitle = (title: string) => {
  const sanTitle = sanitize(title);
  return `${pascal(sanTitle)}Service`;
};

export const generateAngularHeader = (title: string) => `
@Injectable()
export class ${title} {
  constructor(
    private http: HttpClient,
  ) {}`;

export const generateAngularFooter = () => '};\n';

const generateImports = ({
  response,
  body,
  queryParams,
  params,
}: GeneratorVerbOptions): GeneratorImport[] => [
  ...response.imports,
  ...body.imports,
  ...params.reduce<GeneratorImport[]>(
    (acc, param) => [...acc, ...param.imports],
    [],
  ),
  ...(queryParams ? [{ name: queryParams.schema.name }] : []),
];

const generateImplementation = (
  {
    queryParams,
    definitionName,
    response,
    mutator,
    body,
    props,
    verb,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const axiosConfig = generateAxiosConfig({
    route,
    body,
    queryParams,
    response,
    verb,
  });

  const options = generateOptions({
    route,
    body,
    queryParams,
    response,
    verb,
  });

  return `  ${definitionName}(\n    ${toObjectString(
    props,
    'implementation',
  )}\n  ) {${generateFormData(body)}
  return ${
    mutator
      ? `${mutator.name}<${response.definition}>(${axiosConfig}, this.http)`
      : `this.http.${verb}<${response.definition}>(${options})`
  };
  }
`;
};

export const generateAngular = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): GeneratorClient => {
  const imports = generateImports(verbOptions);
  const implementation = generateImplementation(verbOptions, options);

  return { implementation, imports };
};
