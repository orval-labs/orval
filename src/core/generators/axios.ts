import { GeneratorOptions, GeneratorVerbOptions } from '../../types/generator';
import { generateFormData } from './formData';
import { generateOptions } from './options';

export const generateAxiosImports = () => ({
  definition: `import { AxiosPromise } from 'axios';\n`,
  implementation: `import { AxiosPromise, AxiosInstance } from 'axios';\n`,
  implementationMock: `import { AxiosPromise, AxiosInstance } from 'axios';\nimport faker from 'faker';\n`,
});

const generateAxiosDefinition = ({
  props,
  definitionName,
  response,
  summary,
}: GeneratorVerbOptions) => {
  let value = '';

  if (summary) {
    value += `\n  // ${summary}`;
  }

  value += `\n  ${definitionName}(\n    ${props.definition}\n  ): AxiosPromise<${response.definition}>;`;

  return value;
};

const generateAxiosImplementation = (
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

  return `  ${definitionName}(\n    ${
    props.implementation
  }\n  ): AxiosPromise<${response.definition}> {${mutator}${generateFormData(
    body,
  )}
    return axios.${verb}(${mutator ? `...mutator(${options})` : options});
  },
`;
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

export const generateAxiosHeader = (title: string) => ({
  definition: `export interface ${title} {`,
  implementation: `export const get${title} = (axios: AxiosInstance): ${title} => ({\n`,
  implementationMock: `export const get${title}Mock = (): ${title} => ({\n`,
});

export const generateAxiosFooter = () => {
  return {
    definition: '\n}\n',
    implementation: '});\n',
    implementationMock: '})\n',
  };
};

export const generateAxios = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  const imports = generateImports(verbOptions);
  const definition = generateAxiosDefinition(verbOptions);
  const implementation = generateAxiosImplementation(verbOptions, options);

  return { definition, implementation, imports };
};
