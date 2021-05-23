import omitBy from 'lodash.omitby';
import { Verbs } from '../../types';
import {
  GeneratorDependency,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { GetterParams, GetterProps, GetterPropType } from '../../types/getters';
import { camel, pascal } from '../../utils/case';
import { isObject } from '../../utils/is';
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

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      queryParams,
      response,
      verb,
    });

    const requestOptions = isRequestOptions
      ? isObject(override?.requestOptions)
        ? ` // eslint-disable-next-line\n// @ts-ignore\n {${stringify(
            override?.requestOptions,
          )?.slice(1, -1)} ...options}`
        : '// eslint-disable-next-line\n// @ts-ignore\n options'
      : '';
   
    const mutatorTyping = response.definition ? `<Data extends unknown ? ${ response.definition} : Data>` : '<Data>';
    
    return `export const ${operationName} = <Data = unknown>(\n    ${toObjectString(
      props,
      'implementation',
    )}\n ${
      isRequestOptions
        ? `options?: SecondParameter<typeof ${mutator.name}>`
        : ''
    }) => {
      return ${mutator.name}${mutatorTyping}(
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
  });

  return `export const ${operationName} = <Data = unknown>(\n    ${toObjectString(
    props,
    'implementation',
  )} ${isRequestOptions ? `options?: AxiosRequestConfig\n` : ''} ) => {${
    body.formData
  }
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

const generateQueryOptions = ({
  params,
  options,
  type,
}: {
  params: GetterParams;
  options?: object | boolean;
  type: QueryType;
}) => {
  if (options === false) {
    return '';
  }

  const queryConfig = isObject(options)
    ? ` ${stringify(
        omitBy(options, (_, key) => {
          if (
            type !== QueryType.INFINITE &&
            INFINITE_QUERY_PROPERTIES.includes(key)
          ) {
            return true;
          }
          return false;
        }),
      )?.slice(1, -1)}`
    : '';

  if (!params.length) {
    if (options) {
      return `{${queryConfig} ...queryOptions}`;
    }

    return 'queryOptions';
  }

  return `{${
    !isObject(options) || !options.hasOwnProperty('enabled')
      ? `enabled: !!(${params.map(({ name }) => name).join(' && ')}),`
      : ''
  }${queryConfig} ...queryOptions}`;
};

const generateReactQueryArguments = ({
  operationName,
  definitions,
  mutator,
  isRequestOptions,
  type,
}: {
  operationName: string;
  definitions: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
  type?: QueryType;
}) => {
  const definition = type
    ? `Use${pascal(
        type,
      )}Options<AsyncReturnType<typeof ${operationName}>, Error>`
    : `UseMutationOptions<AsyncReturnType<typeof ${operationName}>, Error${
        definitions ? `, {${definitions}}` : ''
      }, unknown>`;

  if (!isRequestOptions) {
    return `${type ? 'queryOptions' : 'mutationOptions'}?: ${definition}`;
  }

  return `options?: { ${type ? 'query' : 'mutation'}?:${definition}, ${
    !mutator
      ? `axios?: AxiosRequestConfig`
      : `request?: SecondParameter<typeof ${mutator.name}>`
  }}\n`;
};

const generateQueryImplementation = ({
  queryOption: { name, queryParam, options, type },
  operationName,
  queryProps,
  queryKeyFnName,
  properties,
  params,
  props,
  mutator,
  isRequestOptions,
}: {
  queryOption: {
    name: string;
    options?: object | boolean;
    type: QueryType;
    queryParam?: string;
  };
  isRequestOptions: boolean;
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
>(\n ${queryProps} ${generateReactQueryArguments({
    operationName,
    definitions: '',
    mutator,
    isRequestOptions,
    type,
  })}\n  ) => {
  const queryKey = ${queryKeyFnName}(${properties});
  ${
    isRequestOptions
      ? `const {query: queryOptions${
          !mutator ? `, axios: axiosOptions` : ', request: requestOptions'
        }} = options || {}`
      : ''
  }

  const query = ${camel(
    `use-${type}`,
  )}<AsyncReturnType<typeof ${operationName}>, Error>(queryKey, (${
    queryParam && props.some(({ type }) => type === 'queryParam')
      ? `{ pageParam }`
      : ''
  }) => ${operationName}<Data>(${httpFunctionProps}${
    httpFunctionProps ? ', ' : ''
  }${
    isRequestOptions ? (!mutator ? `axiosOptions` : 'requestOptions') : ''
  }), ${generateQueryOptions({
    params,
    options,
    type,
  })} )

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
    override,
    mutator,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const properties = props
    .map(({ name, type }) => (type === GetterPropType.BODY ? 'data' : name))
    .join(',');

  const query = override?.query;
  const isRequestOptions = override?.requestOptions !== false;

  if (verb === Verbs.GET) {
    const queries = [
      ...(query?.useInfinite
        ? [
            {
              name: camel(`${operationName}-infinite`),
              options: query?.options,
              type: QueryType.INFINITE,
              queryParam: query?.useInfiniteQueryParam,
            },
          ]
        : []),
      ...((!query?.useQuery && !query?.useInfinite) || query?.useQuery
        ? [
            {
              name: operationName,
              options: query?.options,
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
          isRequestOptions,
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
    >(${generateReactQueryArguments({
      operationName,
      definitions,
      mutator,
      isRequestOptions,
    })}) => {
      ${
        isRequestOptions
          ? `const {mutation: mutationOptions${
              !mutator ? `, axios: axiosOptions` : ', request: requestOptions'
            }} = options || {}`
          : ''
      }

      return useMutation<AsyncReturnType<typeof ${operationName}>, Error${
    definitions ? `, {${definitions}}` : ''
  }>((${properties ? 'props' : ''}) => {
        ${properties ? `const {${properties}} = props || {}` : ''};

        return  ${operationName}<Data>(${properties}${properties ? ',' : ''}${
    isRequestOptions ? (!mutator ? `axiosOptions` : 'requestOptions') : ''
  })
      }, mutationOptions)
    }
    `;
};

export const generateReactQueryTitle = () => '';

export const generateReactQueryHeader = ({
  isRequestOptions,
  isMutator,
}: {
  isRequestOptions: boolean;
  isMutator: boolean;
}) => `type AsyncReturnType<
T extends (...args: any) => Promise<any>
> = T extends (...args: any) => Promise<infer R> ? R : any;\n\n
${
  isRequestOptions && isMutator
    ? `type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P extends unknown
  ? Record<string, any>
  : P
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
