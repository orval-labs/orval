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

const AXIOS_DEPENDENCIES = [
  {
    exports: [{ name: 'axios', default: true }],
    dependency: 'axios',
  },
];

export const getAxiosDependencies = () => AXIOS_DEPENDENCIES;

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
        ? `${mutator.name}<${response.definition}>(${axiosConfig})`
        : `axios.${verb}<${response.definition}>(${options})`
    };
  },
`;
};

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

export const generateAxiosTitle = (title: string) => {
  const sanTitle = sanitize(title);
  return `get${pascal(sanTitle)}`;
};

export const generateAxiosHeader = (title: string) =>
  `export const ${title} = () => ({\n`;

export const generateAxiosFooter = () => '});\n';

export const generateAxios = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): GeneratorClient => {
  const imports = generateImports(verbOptions);
  const implementation = generateAxiosImplementation(verbOptions, options);

  return { implementation, imports };
};
