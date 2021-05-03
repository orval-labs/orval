import omitBy from 'lodash.omitby';
import { OperationOptions, Verbs } from '../../types';
import {
  GeneratorDependency,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { GetterParams, GetterProps, GetterPropType } from '../../types/getters';
import { camel, pascal } from '../../utils/case';
import { mergeDeep } from '../../utils/mergeDeep';
import { stringify, toObjectString } from '../../utils/string';
import { generateVerbImports } from './imports';
import { generateMutatorConfig, generateOptions } from './options';

const REACT_QUERY_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'axios', default: true, values: true },
      { name: 'AxiosRequestConfig' },
    ],
    dependency: 'axios',
  },
  {
    exports: [
      { name: 'useQuery', values: true },
      { name: 'useInfiniteQuery', values: true },
      { name: 'useMutation', values: true },
      { name: 'UseQueryOptions' },
      {
        name: 'UseInfiniteQueryOptions',
      },
      { name: 'UseMutationOptions' },
    ],
    dependency: 'react-query',
  },
];

export const getReactQueryDependencies = () => REACT_QUERY_DEPENDENCIES;

const generateAxiosFunction = (
  {
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      queryParams,
      response,
      verb,
    });

    return `export const ${operationName} = <Data = unknown>(\n    ${toObjectString(
      props,
      'implementation',
    )}\n options?: SecondParameter<typeof ${mutator.name}>) => {
      return ${mutator.name}<Data extends unknown ? ${
      response.definition
    } : Data>(
      ${mutatorConfig},
      // eslint-disable-next-line
      // @ts-ignore
      options);
    }
  `;
  }

  const options = generateOptions({
    route,
    body,
    queryParams,
    response,
    verb,
  });

  return `export const ${operationName} = <Data = unknown>(\n    ${toObjectString(
    props,
    'implementation',
  )} options?: AxiosRequestConfig\n  ) => {${body.formData}
    return axios.${verb}<Data extends unknown ? ${
    response.definition
  } : Data>(${options});
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
  operationName,
  queryProps,
  queryKeyFnName,
  properties,
  params,
  props,
  mutator,
}: {
  queryOption: {
    name: string;
    config?: object;
    type: QueryType;
    queryParam?: string;
  };
  operationName: string;
  queryProps: string;
  queryKeyFnName: string;
  properties: string;
  params: GetterParams;
  props: GetterProps;
  mutator?: GeneratorMutator;
}) => {
  const httpFunctionProps = queryParam
    ? props
        .map(({ name }) =>
          name === 'params' ? `{ ${queryParam}: pageParam, ...params }` : name,
        )
        .join(',')
    : properties;

  return `
export const ${camel(`use-${name}`)} = <
  Data extends unknown = unknown,
  Error extends unknown = unknown
>(\n ${queryProps}\n options?: { query?: Use${pascal(
    type,
  )}Options<AsyncReturnType<typeof ${operationName}>, Error>${
    !mutator
      ? `, axios?: AxiosRequestConfig`
      : `, request?: SecondParameter<typeof ${mutator.name}>`
  }}\n  ) => {
  const queryKey = ${queryKeyFnName}(${properties});
  const {query: queryOptions${
    !mutator ? `, axios: axiosOptions` : ', request: requestOptions'
  }} = options || {}

  const query = ${camel(
    `use-${type}`,
  )}<AsyncReturnType<typeof ${operationName}>, Error>(queryKey, (${
    queryParam && props.some(({ type }) => type === 'queryParam')
      ? `{ pageParam }`
      : ''
  }) => ${operationName}<Data>(${httpFunctionProps}${
    httpFunctionProps ? ', ' : ''
  }${!mutator ? `axiosOptions` : 'requestOptions'}), ${
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
        } ...queryOptions}`
      : 'queryOptions'
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
    operationName,
    body,
    props,
    verb,
    params,
    operationId,
    tags,
    mutator,
  }: GeneratorVerbOptions,
  { route, override = {} }: GeneratorOptions,
) => {
  const properties = props
    .map(({ name, type }) => (type === GetterPropType.BODY ? 'data' : name))
    .join(',');

  if (verb === Verbs.GET) {
    const overrideOperation = override.operations?.[operationId!];
    const overrideTag = Object.entries(
      override.tags || {},
    ).reduce<OperationOptions>(
      (acc, [tag, options]) =>
        tags.includes(tag) ? mergeDeep(acc, options) : acc,
      {},
    );
    const query =
      overrideOperation?.query || overrideTag?.query || override.query;

    const queries = [
      ...(query?.useInfinite
        ? [
            {
              name: camel(`${operationName}-infinite`),
              config: query?.config,
              type: QueryType.INFINITE,
              queryParam: query?.useInfiniteQueryParam,
            },
          ]
        : []),
      ...((!query?.useQuery && !query?.useInfinite) || query?.useQuery
        ? [
            {
              name: operationName,
              config: query?.config,
              type: QueryType.QUERY,
            },
          ]
        : []),
    ];

    const queryKeyFnName = camel(`get-${operationName}-queryKey`);
    const queryProps = toObjectString(props, 'implementation');

    return `export const ${queryKeyFnName} = (${queryProps}) => [\`${route}\`${
      queryParams ? ', ...(params ? [params]: [])' : ''
    }]

    ${queries.reduce(
      (acc, queryOption) =>
        acc +
        generateQueryImplementation({
          queryOption,
          operationName,
          queryProps,
          queryKeyFnName,
          properties,
          params,
          props,
          mutator,
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

  return `
    export const ${camel(`use-${operationName}`)} = <
      Data extends unknown = unknown,
      Error extends unknown = unknown
    >(\n     options?: { mutation?: UseMutationOptions<AsyncReturnType<typeof ${operationName}>, Error${
    definitions ? `, {${definitions}}` : ''
  }, unknown>${
    !mutator
      ? `, axios?: AxiosRequestConfig`
      : `, request?: SecondParameter<typeof ${mutator.name}>`
  }}\n  ) => {
      const {mutation: mutationOptions${
        !mutator ? `, axios: axiosOptions` : ', request: requestOptions'
      }} = options || {}

      return useMutation<AsyncReturnType<typeof ${operationName}>, Error${
    definitions ? `, {${definitions}}` : ''
  }>((${properties ? 'props' : ''}) => {
        ${properties ? `const {${properties}} = props || {}` : ''};

        return  ${operationName}<Data>(${properties}${properties ? ',' : ''}${
    !mutator ? `axiosOptions` : 'requestOptions'
  })
      }, mutationOptions)
    }
    `;
};

export const generateReactQueryTitle = () => '';

export const generateReactQueryHeader = ({
  hasMutator,
}: {
  hasMutator: boolean;
}) => `type AsyncReturnType<
T extends (...args: any) => Promise<any>
> = T extends (...args: any) => Promise<infer R> ? R : any;\n\n
${
  hasMutator
    ? `type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;\n\n`
    : ''
}`;

export const generateReactQueryFooter = () => '';

export const generateReactQuery = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  const imports = generateVerbImports(verbOptions);
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
