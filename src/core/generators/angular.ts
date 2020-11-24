import {
  GeneratorClient,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { toObjectString } from '../../utils/string';
import { generateFormData } from './formData';
import { generateAxiosConfig, generateOptions } from './options';

export const generateAngularImports = () => ({
  implementation: `import { HttpClient } from '@angular/common/http';
  import { Injectable } from '@angular/core';
  import { Observable } from 'rxjs';\n`,
});

export const generateAngularTitle = (title: string) => {
  return {
    implementation: `${pascal(title)}Service`,
  };
};

export const generateAngularHeader = (titles: { implementation: string }) => {
  return {
    implementation: `
  @Injectable()
  export class ${titles.implementation} {
    constructor(
      private http: HttpClient,
    ) {}`,
  };
};

export const generateAngularFooter = () => {
  return {
    implementation: '};\n',
  };
};

const generateImports = ({
  response,
  body,
  queryParams,
}: GeneratorVerbOptions) => [
  ...response.imports,
  ...body.imports,
  ...(queryParams ? [queryParams.schema.name] : []),
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
