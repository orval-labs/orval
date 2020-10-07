import {
  GeneratorClient,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
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
  ...(queryParams ? [queryParams.schema.name] : []),
];

export const generateAxiosTitle = (title: string) => {
  return {
    definition: `${pascal(title)}Api`,
    implementation: `get${pascal(title)}Api`,
    implementationMock: `get${pascal(title)}ApiMock`,
  };
};

export const generateAxiosHeader = (title: string) => {
  const axiosTitle = generateAxiosTitle(title);
  return {
    definition: `export interface ${axiosTitle.definition} {`,
    implementation: `export const ${axiosTitle.implementation} = (axios: AxiosInstance): ${axiosTitle.definition} => ({\n`,
    implementationMock: `export const ${axiosTitle.implementationMock} = (): ${axiosTitle.definition} => ({\n`,
  };
};

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
): GeneratorClient => {
  const imports = generateImports(verbOptions);
  const definition = generateAxiosDefinition(verbOptions);
  const implementation = generateAxiosImplementation(verbOptions, options);

  return { definition, implementation, imports };
};
