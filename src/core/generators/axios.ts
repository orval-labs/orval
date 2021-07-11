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

const AXIOS_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'axios', default: true, values: true },
      { name: 'AxiosRequestConfig' },
      { name: 'AxiosResponse' },
    ],
    dependency: 'axios',
  },
];

export const getAxiosDependencies = () => AXIOS_DEPENDENCIES;

const generateAxiosImplementation = (
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

    return `const ${operationName} = <TData = ${response.definition.success || 'unknown'}>(\n    ${toObjectString(
      props,
      'implementation',
    )}\n ${
      isRequestOptions
        ? `options?: SecondParameter<typeof ${mutator.name}>`
        : ''
    }) => {${isFormData ? body.formData : ''}
      return ${mutator.name}<TData>(
      ${mutatorConfig},
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

  return `const ${operationName} = <TData = AxiosResponse<${
    response.definition.success || 'unknown'
  }>>(\n    ${toObjectString(props, 'implementation')} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<TData> => {${isFormData ? body.formData : ''}
    return axios.${verb}(${options});
  }
`;
};

export const generateAxiosTitle = (title: string) => {
  const sanTitle = sanitize(title);
  return `get${pascal(sanTitle)}`;
};

export const generateAxiosHeader = ({
  title,
  isRequestOptions,
  isMutator,
  noFunction,
}: {
  title: string;
  isRequestOptions: boolean;
  isMutator: boolean;
  noFunction?: boolean;
}) => `${
  isRequestOptions && isMutator
    ? `type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;\n\n`
    : ''
}
  ${!noFunction ? `export const ${title} = () => {\n` : ''}`;

export const generateAxiosFooter = (operationNames: string[] = []) =>
  `return {${operationNames.join(',')}}};\n`;

export const generateAxios = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): GeneratorClient => {
  const imports = generateVerbImports(verbOptions);
  const implementation = generateAxiosImplementation(verbOptions, options);

  return { implementation, imports };
};
