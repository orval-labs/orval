import {
  GeneratorClient,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { sanitize, toObjectString } from '../../utils/string';
import { generateFormData } from './formData';
import { generateAxiosConfig, generateOptions } from './options';

export const generateAxiosImports = (isMutator: boolean) => ({
  implementation: !isMutator
    ? `import axios,{ AxiosPromise, AxiosInstance } from 'axios';\n`
    : '',
});

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
        ? `${mutator.name}<${response.definition}>(${axiosConfig}, axios)`
        : `axios.${verb}<${response.definition}>(${options})`
    };
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
  const sanTitle = sanitize(title);
  return {
    implementation: `get${pascal(sanTitle)}`,
  };
};

export const generateAxiosHeader = (titles: { implementation: string }) => {
  return {
    implementation: `export const ${titles.implementation} = (axios: AxiosInstance) => ({\n`,
  };
};

export const generateAxiosFooter = () => {
  return {
    implementation: '});\n',
  };
};

export const generateAxios = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): GeneratorClient => {
  const imports = generateImports(verbOptions);
  const implementation = generateAxiosImplementation(verbOptions, options);

  return { implementation, imports };
};
