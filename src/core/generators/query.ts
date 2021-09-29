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
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
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
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
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
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
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

    return `export const ${operationName} = (\n    ${toObjectString(
      props,
      'implementation',
    )}\n ${
      isRequestOptions && isMutatorHasSecondArg
        ? `options?: SecondParameter<typeof ${mutator.name}>`
        : ''
    }) => {${formDataImplementation}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
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

  return `export const ${operationName} = (\n    ${toObjectString(
    props,
    'implementation',
  )} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${formDataImplementation}
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
  operationName,
  definitions,
  mutator,
  isRequestOptions,
  isMutatorHasSecondArg,
  type,
}: {
  operationName: string;
  definitions: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
  type?: QueryType;
  isMutatorHasSecondArg: boolean;
}) => {
  const definition = type
    ? `Use${pascal(
        type,
      )}Options<AsyncReturnType<typeof ${operationName}>, TError, TData>`
    : `UseMutationOptions<AsyncReturnType<typeof ${operationName}>, TError,${
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

  const isMutatorHasSecondArg = !!mutator && mutator.mutatorFn.length > 1;

  return `
export const ${camel(
    `use-${name}`,
  )} = <TData = AsyncReturnType<typeof ${operationName}>, TError = ${
    response.definition.errors || 'unknown'
  }>(\n ${queryProps} ${generateQueryArguments({
    operationName,
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
  const queryFn: QueryFunction<AsyncReturnType<typeof ${operationName}>> = (${
    queryParam && props.some(({ type }) => type === 'queryParam')
      ? `{ pageParam }`
      : ''
  }) => ${operationName}(${httpFunctionProps}${httpFunctionProps ? ', ' : ''}${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : isMutatorHasSecondArg
        ? 'requestOptions'
        : ''
      : ''
  });

  const query = ${camel(
    `use-${type}`,
  )}<AsyncReturnType<typeof ${operationName}>, TError, TData>(queryKey, queryFn, ${generateQueryOptions(
    {
      params,
      options,
      type,
    },
  )})

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
    operationId,
  }: GeneratorVerbOptions,
  { route, override: { operations = {} } }: GeneratorOptions,
) => {
  const query = override?.query;
  const isRequestOptions = override?.requestOptions !== false;
  const operationQueryOptions = operations[operationId]?.query;

  if (
    verb === Verbs.GET ||
    operationQueryOptions?.useInfinite ||
    operationQueryOptions?.useQuery
  ) {
    const properties = props
      .map(({ name, type }) =>
        type === GetterPropType.BODY ? body.implementation : name,
      )
      .join(',');

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
    }${body.implementation ? `, ${body.implementation}` : ''}];

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

  const isMutatorHasSecondArg = !!mutator && mutator.mutatorFn.length > 1;

  const properties = props
    .map(({ name, type }) => (type === GetterPropType.BODY ? 'data' : name))
    .join(',');

  return `
    export const ${camel(`use-${operationName}`)} = <TError = ${
    response.definition.errors || 'unknown'
  },
    ${!definitions ? `TVariables = void,` : ''}
    TContext = unknown>(${generateQueryArguments({
      operationName,
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

      const mutationFn: MutationFunction<AsyncReturnType<typeof ${operationName}>, ${
    definitions ? `{${definitions}}` : 'TVariables'
  }> = (${properties ? 'props' : ''}) => {
          ${properties ? `const {${properties}} = props || {}` : ''};

          return  ${operationName}(${properties}${properties ? ',' : ''}${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : isMutatorHasSecondArg
        ? 'requestOptions'
        : ''
      : ''
  })
        }

      return useMutation<AsyncReturnType<typeof ${operationName}>, TError, ${
    definitions ? `{${definitions}}` : 'TVariables'
  }, TContext>(mutationFn, mutationOptions)
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
T extends (...args: any) => Promise<any>
> = T extends (...args: any) => Promise<infer R> ? R : any;\n\n
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
