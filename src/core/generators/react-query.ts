import { Verbs } from '../../types';
import { GeneratorOptions, GeneratorVerbOptions } from '../../types/generator';
import { GetterPropType } from '../../types/getters';
import { camel } from '../../utils/case';
import { toObjectString } from '../../utils/string';
import { generateFormData } from './formData';
import { generateOptions } from './options';

export const generateReactQueryImports = () => ({
  definition: ``,
  implementation: `import axios, { AxiosRequestConfig, AxiosResponse, AxiosError, AxiosPromise } from 'axios';
import { useQuery, useMutation, QueryConfig, MutationConfig } from 'react-query';\n`,
  implementationMock: '',
});

const generateAxiosFunction = (
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

  return `export const ${definitionName} = (\n    ${toObjectString(
    props,
    'implementation',
  )}\n  ): AxiosPromise<${
    response.definition
  }> => {${mutator}${generateFormData(body)}
    return axios.${verb}(${mutator ? `...mutator(${options})` : options});
  }
`;
};

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
  const properties = props
    .map(({ name, type }) => (type === GetterPropType.BODY ? 'data' : name))
    .join(',');

  if (verb === Verbs.GET) {
    return `export const ${camel(
      `use-${definitionName}`,
    )} = (\n    ${toObjectString(
      props,
      'implementation',
    )}\n queryConfig?: QueryConfig<AxiosResponse<${
      response.definition
    }>, AxiosError>\n  ) => {
    return useQuery<AxiosResponse<${
      response.definition
    }>, AxiosError>([\`${route}\`${
      queryParams ? ', params' : ''
    }], () => ${definitionName}(${properties}), ${
      params.length
        ? `{enabled: ${params
            .map(({ name }) => name)
            .join(' && ')}, ...queryConfig}`
        : 'queryConfig'
    } )
  }
`;
  }

  const definitions = props
    .map(({ definition, type }) =>
      type === GetterPropType.BODY ? `data: ${body.definition}` : definition,
    )
    .join(';');

  return `export const ${camel(
    `use-${definitionName}`,
  )} = (\n    mutationConfig?: MutationConfig<AxiosResponse<${
    response.definition
  }>, AxiosError${definitions ? `, {${definitions}}` : ''}>\n  ) => {
  return useMutation<AxiosResponse<${response.definition}>, AxiosError${
    definitions ? `, {${definitions}}` : ''
  }>((${properties ? 'props' : ''}) => {
    ${properties ? `const {${properties}} = props || {}` : ''};

    return  ${definitionName}(${properties})
  }, mutationConfig)
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

export const generateReactQueryHeader = (title: {
  definition: string;
  implementation: string;
  implementationMock: string;
}) => {
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
  const functionImplementation = generateAxiosFunction(verbOptions, options);
  const hookImplementation = generateReactQueryImplementation(
    verbOptions,
    options,
  );

  return {
    definition: '',
    implementation: `${functionImplementation}\n\n${hookImplementation}`,
    imports,
  };
};
