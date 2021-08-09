import omitBy from 'lodash.omitby';
import { Verbs } from '../../types';
import {
  GeneratorDependency,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import {
  GetterBody,
  GetterParams,
  GetterProps,
  GetterPropType,
  GetterResponse,
} from '../../types/getters';
import { camel, pascal } from '../../utils/case';
import { isObject } from '../../utils/is';
import { stringify, toObjectString } from '../../utils/string';
import { generateVerbImports } from './imports';
import {
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
} from './options';

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

const SVELTE_QUERY_DEPENDENCIES: GeneratorDependency[] = [
  ...AXIOS_DEPENDENCIES,
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
    dependency: '@sveltestack/svelte-query',
  },
];

export const getSvelteQueryDependencies = () => SVELTE_QUERY_DEPENDENCIES;

const REACT_QUERY_DEPENDENCIES: GeneratorDependency[] = [
  ...AXIOS_DEPENDENCIES,
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
const VUE_QUERY_DEPENDENCIES: GeneratorDependency[] = [
  ...AXIOS_DEPENDENCIES,
  {
    exports: [
      { name: 'useQuery', values: true },
      { name: 'useInfiniteQuery', values: true },
      { name: 'useMutation', values: true },
    ],
    dependency: 'vue-query',
  },
  {
    exports: [
      { name: 'UseQueryOptions' },
      { name: 'UseInfiniteQueryOptions' },
      { name: 'UseMutationOptions' },
    ],
    dependency: 'vue-query/types',
  },
];

export const getVueQueryDependencies = () => VUE_QUERY_DEPENDENCIES;

const generateQueryFormDataFunction = ({
  isFormData,
  formData,
  body,
}: {
  body: GetterBody;
  formData: GeneratorMutator | undefined;
  isFormData: boolean;
}) => {
  if (!isFormData) {
    return '';
  }

  if (formData && body.formData) {
    return `const formData = ${formData.name}(${body.implementation})`;
  }

  return body.formData;
};

const generateQueryRequestFunction = (
  {
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    formData,
    override,
  }: GeneratorVerbOptions,
  { route }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;

  const formDataImplementation = generateQueryFormDataFunction({
    isFormData,
    formData,
    body,
  });

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      queryParams,
      response,
      verb,
      isFormData,
    });

    const isMutatorHasSecondArg = mutator.mutatorFn.length > 1;
    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override?.requestOptions,
          isMutatorHasSecondArg,
        )
      : '';

    return `export const ${operationName} = <TData = ${
      response.definition.success || 'unknown'
    }>(\n    ${toObjectString(props, 'implementation')}\n ${
      isRequestOptions && isMutatorHasSecondArg
        ? `options?: SecondParameter<typeof ${mutator.name}>`
        : ''
    }) => {${formDataImplementation}
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
    isFormData,
  });

  return `export const ${operationName} = <TData = AxiosResponse<${
    response.definition.success || 'unknown'
  }>>(\n    ${toObjectString(props, 'implementation')} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<TData> => {${formDataImplementation}
    return axios.${verb}(${options});
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

const generateQueryArguments = ({
  definitions,
  mutator,
  isRequestOptions,
  isMutatorHasSecondArg,
  type,
}: {
  definitions: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
  type?: QueryType;
  isMutatorHasSecondArg: boolean;
}) => {
  const definition = type
    ? `Use${pascal(type)}Options<TQueryFnData, TError, TData>`
    : `UseMutationOptions<TData, TError,${
        definitions ? `{${definitions}}` : 'TVariables'
      }, TContext>`;

  if (!isRequestOptions) {
    return `${type ? 'queryOptions' : 'mutationOptions'}?: ${definition}`;
  }

  return `options?: { ${type ? 'query' : 'mutation'}?:${definition}, ${
    !mutator
      ? `axios?: AxiosRequestConfig`
      : isMutatorHasSecondArg
      ? `request?: SecondParameter<typeof ${mutator.name}>`
      : ''
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
  response,
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
  response: GetterResponse;
  mutator?: GeneratorMutator;
}) => {
  const httpFunctionProps = queryParam
    ? props
        .map(({ name }) =>
          name === 'params' ? `{ ${queryParam}: pageParam, ...params }` : name,
        )
        .join(',')
    : properties;

  const tData = !mutator
    ? `AxiosResponse<${response.definition.success || 'unknown'}>`
    : response.definition.success || 'unknown';

  const isMutatorHasSecondArg = !!mutator && mutator.mutatorFn.length > 1;

  return `
export const ${camel(
    `use-${name}`,
  )} = <TQueryFnData = AsyncReturnType<typeof ${operationName}, ${tData}>, TError = ${
    response.definition.errors || 'unknown'
  }, TData = TQueryFnData>(\n ${queryProps} ${generateQueryArguments({
    definitions: '',
    mutator,
    isRequestOptions,
    isMutatorHasSecondArg,
    type,
  })}\n  ) => {

  ${
    isRequestOptions
      ? `const {query: queryOptions${
          !mutator
            ? `, axios: axiosOptions`
            : isMutatorHasSecondArg
            ? ', request: requestOptions'
            : ''
        }} = options || {}`
      : ''
  }

  const queryKey = queryOptions?.queryKey ?? ${queryKeyFnName}(${properties});

  const query = ${camel(
    `use-${type}`,
  )}<TQueryFnData, TError, TData>(queryKey, (${
    queryParam && props.some(({ type }) => type === 'queryParam')
      ? `{ pageParam }`
      : ''
  }) => ${operationName}<TQueryFnData>(${httpFunctionProps}${
    httpFunctionProps ? ', ' : ''
  }${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : isMutatorHasSecondArg
        ? 'requestOptions'
        : ''
      : ''
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

const generateQueryHook = (
  {
    queryParams,
    operationName,
    body,
    props,
    verb,
    params,
    override,
    mutator,
    response,
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
          response,
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

  const tData = !mutator
    ? `AxiosResponse<${response.definition.success || 'unknown'}>`
    : response.definition.success || 'unknown';

  const isMutatorHasSecondArg = !!mutator && mutator.mutatorFn.length > 1;

  return `
    export const ${camel(
      `use-${operationName}`,
    )} = <TData = AsyncReturnType<typeof ${operationName},${tData}>,
    TError = ${response.definition.errors || 'unknown'},
    ${!definitions ? `TVariables = void,` : ''}
    TContext = unknown>(${generateQueryArguments({
      isMutatorHasSecondArg,
      definitions,
      mutator,
      isRequestOptions,
    })}) => {
      ${
        isRequestOptions
          ? `const {mutation: mutationOptions${
              !mutator
                ? `, axios: axiosOptions`
                : isMutatorHasSecondArg
                ? ', request: requestOptions'
                : ''
            }} = options || {}`
          : ''
      }

      return useMutation<TData, TError, ${
        definitions ? `{${definitions}}` : 'TVariables'
      }, TContext>((${properties ? 'props' : ''}) => {
        ${properties ? `const {${properties}} = props || {}` : ''};

        return  ${operationName}<TData>(${properties}${properties ? ',' : ''}${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : isMutatorHasSecondArg
        ? 'requestOptions'
        : ''
      : ''
  })
      }, mutationOptions)
    }
    `;
};

export const generateQueryTitle = () => '';

export const generateQueryHeader = ({
  isRequestOptions,
  isMutator,
}: {
  isRequestOptions: boolean;
  isMutator: boolean;
}) => `type AsyncReturnType<
T extends (...args: any) => Promise<any>,
U = unknown
> = T extends (...args: any) => Promise<infer R> ? (U extends R ? U : R) : any;\n\n
${
  isRequestOptions && isMutator
    ? `type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;\n\n`
    : ''
}`;

export const generateQueryFooter = () => '';

export const generateQuery = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  const imports = generateVerbImports(verbOptions);
  const functionImplementation = generateQueryRequestFunction(
    verbOptions,
    options,
  );
  const hookImplementation = generateQueryHook(verbOptions, options);

  return {
    implementation: `${functionImplementation}\n\n${hookImplementation}`,
    imports,
  };
};
