import { Verbs } from '../../types';
import { GeneratorOptions, GeneratorVerbOptions } from '../../types/generator';
import { camel } from '../../utils/case';
import { generateFormData } from './formData';
import { generateOptions } from './options';

export const generateReactQueryImports = () => ({
  definition: ``,
  implementation: `import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { useQuery, useMutation, QueryConfig, MutationConfig } from 'react-query';\n`,
  implementationMock: '',
});

const generateReactQueryImplementation = (
  {
    queryParams,
    definitionName,
    response,
    mutator,
    body,
    props,
    verb,
    params,
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

  if (verb === Verbs.GET) {
    return `export const ${camel(`use-${definitionName}`)} = (\n    ${
      props.implementation
    }\n queryConfig?: QueryConfig<AxiosResponse<${
      response.definition
    }>, AxiosError>\n  ) => {${mutator}${generateFormData(body)}
    return useQuery<AxiosResponse<${response.definition}>, AxiosError>(${
      mutator ? `mutator(${options})` : `[${options}]`
    }, ( path: string,
      options: Partial<AxiosRequestConfig>) => axios.get<${
        response.definition
      }>(path, options), ${
      params.length
        ? `{enabled: ${params
            .map(({ name }) => name)
            .join(' && ')}, ...queryConfig}`
        : 'queryConfig'
    } )
  }
`;
  }

  return `export const ${camel(`use-${definitionName}`)} = (\n    ${
    props.implementation
  }\n mutationConfig?: MutationConfig<AxiosResponse<${
    response.definition
  }>, AxiosError>\n  ) => {${mutator}${generateFormData(body)}
  return useMutation<AxiosResponse<${
    response.definition
  }>, AxiosError>(() => axios.${verb}<${response.definition}>(${
    mutator ? `...mutator(${options})` : options
  }), mutationConfig)
}
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

export const generateReactQueryTitle = (title: string) => {
  return {
    definition: ``,
    implementation: ``,
    implementationMock: ``,
  };
};

export const generateReactQueryHeader = (title: string) => {
  return {
    definition: ``,
    implementation: ``,
    implementationMock: ``,
  };
};

export const generateReactQueryFooter = () => {
  return {
    definition: '',
    implementation: '',
    implementationMock: '',
  };
};

export const generateReactQuery = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  const imports = generateImports(verbOptions);
  const implementation = generateReactQueryImplementation(verbOptions, options);

  return { definition: '', implementation, imports };
};
