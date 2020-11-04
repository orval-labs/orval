import {
  GeneratorClient,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
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

export const generateAngularTitle = (title: string) => {
  return {
    definition: `I${pascal(title)}Service`,
    implementation: `${pascal(title)}Service`,
    implementationMock: `${pascal(title)}MockService`,
  };
};

export const generateAngularHeader = (titles: {
  definition: string;
  implementation: string;
  implementationMock: string;
}) => {
  return {
    definition: `
  export abstract class ${titles.definition} {`,
    implementation: `
  @Injectable()
  export class ${titles.implementation} implements ${titles.definition} {
    constructor(
      private http: HttpClient,
    ) {}`,
    implementationMock: `
  @Injectable()
  export class ${titles.implementationMock} extends ${titles.definition} {`,
  };
};

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
  ...(queryParams ? [queryParams.schema.name] : []),
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
    return this.http.${verb}<${response.definition}>(${
    mutator ? `...mutator(${options})` : options
  });
  }
`;
};

export const generateAngular = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): GeneratorClient => {
  const imports = generateImports(verbOptions);
  const definition = generateDefinition(verbOptions);
  const implementation = generateImplementation(verbOptions, options);

  return { definition, implementation, imports };
};
