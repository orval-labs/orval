import { Verbs } from '../../types';
import { GeneratorOptions, GeneratorVerbOptions } from '../../types/generator';
import { GetterPropType } from '../../types/getters';
import { camel } from '../../utils/case';
import { toObjectString } from '../../utils/string';
import { generateFormData } from './formData';
import { generateAxiosConfig, generateOptions } from './options';

export const generateReactQueryImports = (isMutator: boolean) =>
  `${
    !isMutator ? `import axios from 'axios';\n` : ''
  }import { useQuery, useMutation, QueryConfig, MutationConfig } from 'react-query';\n`;

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

  return `export const ${definitionName} = (\n    ${toObjectString(
    props,
    'implementation',
  )}\n  ) => {${generateFormData(body)}
    return ${
      mutator
        ? `${mutator.name}<${response.definition}>(${axiosConfig})`
        : `axios.${verb}<${response.definition}>(${options})`
    };
  }
`;
};

const generateReactQueryImplementation = (
  {
    queryParams,
    definitionName,
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
    const queryKeyFnName = camel(`get-${definitionName}-queryKey`);
    const queryProps = toObjectString(props, 'implementation');

    return `export const ${queryKeyFnName} = (${queryProps}) => [\`${route}\`${
      queryParams ? ', ...(params ? [params]: [])' : ''
    }]

    export const ${camel(
      `use-${definitionName}`,
    )} = <Error = unknown>(\n    ${queryProps}\n queryConfig?: QueryConfig<AsyncReturnType<typeof ${definitionName}>, Error>\n  ) => {
    const queryKey = ${queryKeyFnName}(${properties});

    const query = useQuery<AsyncReturnType<typeof ${definitionName}>, Error>(queryKey, () => ${definitionName}(${properties}), ${
      params.length
        ? `{enabled: ${params
            .map(({ name }) => name)
            .join(' && ')}, ...queryConfig}`
        : 'queryConfig'
    } )

    return {
      queryKey,
      ...query
    }
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
  )} = <Error = unknown>(\n    mutationConfig?: MutationConfig<AsyncReturnType<typeof ${definitionName}>, Error${
    definitions ? `, {${definitions}}` : ''
  }>\n  ) => {
  return useMutation<AsyncReturnType<typeof ${definitionName}>, Error${
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

export const generateReactQueryTitle = () => '';

export const generateReactQueryHeader = () => `type AsyncReturnType<
T extends (...args: any) => Promise<any>
> = T extends (...args: any) => Promise<infer R> ? R : any;\n\n`;

export const generateReactQueryFooter = () => '';

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
    implementation: `${functionImplementation}\n\n${hookImplementation}`,
    imports,
  };
};
