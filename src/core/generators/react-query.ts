import { omitBy } from 'lodash';
import { OperationOptions, Verbs } from '../../types';
import {
  GeneratorImport,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { GetterParams, GetterProps, GetterPropType } from '../../types/getters';
import { camel, pascal } from '../../utils/case';
import { mergeDeep } from '../../utils/mergeDeep';
import { stringify, toObjectString } from '../../utils/string';
import { generateFormData } from './formData';
import { generateAxiosConfig, generateOptions } from './options';

const REACT_QUERY_DEPENDENCIES = [
  {
    exports: [{ name: 'axios', default: true }],
    dependency: 'axios',
  },
  {
    exports: [
      { name: 'useQuery' },
      { name: 'useInfiniteQuery' },
      { name: 'useMutation' },
      { name: 'UseQueryOptions' },
      { name: 'UseInfiniteQueryOptions' },
      { name: 'UseMutationOptions' },
    ],
    dependency: 'react-query',
  },
];

export const getReactQueryDependencies = () => REACT_QUERY_DEPENDENCIES;

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

type QueryType = 'infiniteQuery' | 'query';

const QueryType = {
  INFINITE: 'infiniteQuery' as QueryType,
  QUERY: 'query' as QueryType,
};

const INFINITE_QUERY_PROPERTIES = ['getNextPageParam', 'getPreviousPageParam'];

const generateQueryImplementation = ({
  queryOption: { name, queryParam, config, type },
  definitionName,
  queryProps,
  queryKeyFnName,
  properties,
  params,
  props,
}: {
  queryOption: {
    name: string;
    config?: object;
    type: QueryType;
    queryParam?: string;
  };
  definitionName: string;
  queryProps: string;
  queryKeyFnName: string;
  properties: string;
  params: GetterParams;
  props: GetterProps;
}) => {
  return `export const ${camel(
    `use-${name}`,
  )} = <Error = unknown>(\n    ${queryProps}\n queryConfig?: Use${pascal(
    type,
  )}Options<AsyncReturnType<typeof ${definitionName}>, Error>\n  ) => {
  const queryKey = ${queryKeyFnName}(${properties});

  const query = ${camel(
    `use-${type}`,
  )}<AsyncReturnType<typeof ${definitionName}>, Error>(queryKey, (${
    queryParam && props.some(({ type }) => type === 'queryParam')
      ? `{ pageParam }`
      : ''
  }) => ${definitionName}(${
    queryParam
      ? props
          .map(({ name }) =>
            name === 'params'
              ? `{ ${queryParam}: pageParam, ...params }`
              : name,
          )
          .join(',')
      : properties
  }), ${
    params.length
      ? `{${
          !config?.hasOwnProperty('enabled')
            ? `enabled: !!(${params.map(({ name }) => name).join(' && ')}),`
            : ''
        }${
          config
            ? ` ${stringify(
                omitBy(config, (_, key) => {
                  if (
                    type !== QueryType.INFINITE &&
                    INFINITE_QUERY_PROPERTIES.includes(key)
                  ) {
                    return true;
                  }
                  return false;
                }),
              )?.slice(1, -1)}`
            : ''
        } ...queryConfig}`
      : 'queryConfig'
  } )

  return {
    queryKey,
    ...query
  }
}\n`;
};

const generateReactQueryImplementation = (
  {
    queryParams,
    definitionName,
    body,
    props,
    verb,
    params,
    operationId,
    tags,
  }: GeneratorVerbOptions,
  { route, override = {} }: GeneratorOptions,
) => {
  const properties = props
    .map(({ name, type }) => (type === GetterPropType.BODY ? 'data' : name))
    .join(',');

  if (verb === Verbs.GET) {
    const overrideOperation = override.operations?.[operationId!];
    const overrideTag = Object.entries(override.tags || {}).reduce<
      OperationOptions | undefined
    >(
      (acc, [tag, options]) =>
        tags.includes(tag) ? mergeDeep(acc, options) : acc,
      undefined,
    );
    const query =
      overrideOperation?.query || overrideTag?.query || override.query;

    const queries = [
      ...(query?.useInfinite
        ? [
            {
              name: camel(`${definitionName}-infinite`),
              config: query?.config,
              type: QueryType.INFINITE,
              queryParam: query?.useInfiniteQueryParam,
            },
          ]
        : []),
      ...((!query?.useQuery && !query?.useInfinite) || query?.useQuery
        ? [
            {
              name: definitionName,
              config: query?.config,
              type: QueryType.QUERY,
            },
          ]
        : []),
    ];

    const queryKeyFnName = camel(`get-${definitionName}-queryKey`);
    const queryProps = toObjectString(props, 'implementation');

    return `export const ${queryKeyFnName} = (${queryProps}) => [\`${route}\`${
      queryParams ? ', ...(params ? [params]: [])' : ''
    }]

    ${queries.reduce(
      (acc, queryOption) =>
        acc +
        generateQueryImplementation({
          queryOption,
          definitionName,
          queryProps,
          queryKeyFnName,
          properties,
          params,
          props,
        }),
      '',
    )}
`;
  }

  const definitions = props
    .map(({ definition, type }) =>
      type === GetterPropType.BODY ? `data: ${body.definition}` : definition,
    )
    .join(';');

  return `export const ${camel(
    `use-${definitionName}`,
  )} = <Error = unknown>(\n    mutationConfig?: UseMutationOptions<AsyncReturnType<typeof ${definitionName}>, Error${
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
