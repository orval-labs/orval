import { GeneratorOptions, GeneratorVerbOptions } from '../../types/generator';
import { generateFormData } from './formData';
import { generateOptions } from './options';

export const generateAngularImports = () => ({
  definition: `import { Observable } from 'rxjs';\n`,
  implementation: `import { HttpClient } from '@angular/common/http';
  import { Injectable } from '@angular/core';
  import { Observable } from 'rxjs';\n`,
  implementationMock: `import { HttpClient } from '@angular/common/http';
  import { Injectable } from '@angular/core';
  import { of, Observable } from 'rxjs';
  import { delay } from 'rxjs/operators';
  import faker from 'faker';\n`,
});

export const generateAngularHeader = (title: string) => ({
  definition: `
  export abstract class I${title}ApiService {`,
  implementation: `
  @Injectable()
  export class ${title}ApiService implements I${title}ApiService {
    constructor(
      private http: HttpClient,
    ) {}`,
  implementationMock: `
  @Injectable()
  export class ${title}ApiMockService extends I${title}ApiService {`,
});

export const generateAngularFooter = () => {
  return {
    definition: '\n}\n',
    implementation: '};\n',
    implementationMock: '}\n',
  };
};

const generateImports = ({
  response,
  body,
  queryParams,
}: GeneratorVerbOptions) => [
  ...response.imports,
  ...body.imports,
  ...(queryParams ? [queryParams.name] : []),
];

const generateDefinition = ({
  props,
  definitionName,
  response,
  summary,
}: GeneratorVerbOptions) => {
  let value = '';

  if (summary) {
    value += `\n  // ${summary}`;
  }

  value += `\n  abstract ${definitionName}(\n    ${props.definition}\n  ): Observable<${response.definition}>;`;

  return value;
};

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
  const options = generateOptions({
    route,
    body,
    queryParams,
    response,
    verb,
  });

  return `  ${definitionName}(\n    ${props.implementation}\n  ): Observable<${
    response.definition
  }> {${mutator}${generateFormData(body)}
    return this.http.${verb}(${mutator ? `...mutator(${options})` : options});
  }
`;
};

export const generateAngular = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  const imports = generateImports(verbOptions);
  const definition = generateDefinition(verbOptions);
  const implementation = generateImplementation(verbOptions, options);

  return { definition, implementation, imports };
};
