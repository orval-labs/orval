import {
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientHeaderBuilder,
  generateVerbImports,
  mergeDeep,
  type NormalizedOutputOptions,
  OutputHttpClient,
  OutputHttpClientInjection,
  type QueryOptions,
} from '@orval/core';

import { generateQueryRequestFunction, getQueryHeader } from './client';
import {
  getAngularQueryDependencies,
  getReactQueryDependencies,
  getSolidQueryDependencies,
  getSvelteQueryDependencies,
  getVueQueryDependencies,
} from './dependencies';
import { generateQueryHook } from './query-generator';
import { isVue, normalizeQueryOptions } from './utils';

export {
  getAngularQueryDependencies,
  getReactQueryDependencies,
  getSolidQueryDependencies,
  getSvelteQueryDependencies,
  getVueQueryDependencies,
} from './dependencies';

const getHttpClientInjectionHelpers = (params: Parameters<ClientHeaderBuilder>[0]): string => {
  const isReactQueryMeta =
    params.output.httpClientInjection === OutputHttpClientInjection.REACT_QUERY_META;
  const isAxios = params.output.httpClient === OutputHttpClient.AXIOS;

  if (!isReactQueryMeta || !isAxios) {
    return '';
  }

  return `
const getQueryAxiosInstance = (queryClient: QueryClient): AxiosInstance => {
  try {
    const instance = queryClient.getDefaultOptions()?.queries?.meta?.axiosInstance;
    return (instance as AxiosInstance) ?? axios.default;
  } catch {
    return axios.default;
  }
};

const getMutationAxiosInstance = (queryClient: QueryClient): AxiosInstance => {
  try {
    const instance = queryClient.getDefaultOptions()?.mutations?.meta?.axiosInstance;
    return (instance as AxiosInstance) ?? axios.default;
  } catch {
    return axios.default;
  }
};

`;
};

export const generateQueryHeader: ClientHeaderBuilder = (params) => {
  return `${
    params.hasAwaitedType
      ? ''
      : `type AwaitedInput<T> = PromiseLike<T> | T;\n
      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;\n\n`
  }
${
  params.isRequestOptions && params.isMutator
    ? `type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];\n\n`
    : ''
}
${getHttpClientInjectionHelpers(params)}
${getQueryHeader(params)}
`;
};

export const generateQuery: ClientBuilder = async (
  verbOptions,
  options,
  outputClient,
) => {
  const imports = generateVerbImports(verbOptions);
  const functionImplementation = generateQueryRequestFunction(
    verbOptions,
    options,
    isVue(outputClient),
  );
  const { implementation: hookImplementation, mutators } =
    await generateQueryHook(verbOptions, options, outputClient);

  return {
    implementation: `${functionImplementation}\n\n${hookImplementation}`,
    imports,
    mutators,
  };
};

const dependenciesBuilder: Record<
  | 'react-query'
  | 'vue-query'
  | 'svelte-query'
  | 'angular-query'
  | 'solid-query',
  ClientDependenciesBuilder
> = {
  'react-query': getReactQueryDependencies,
  'vue-query': getVueQueryDependencies,
  'svelte-query': getSvelteQueryDependencies,
  'angular-query': getAngularQueryDependencies,
  'solid-query': getSolidQueryDependencies,
};

export const builder =
  ({
    type = 'react-query',
    options: queryOptions,
    output,
  }: {
    type?:
      | 'react-query'
      | 'vue-query'
      | 'svelte-query'
      | 'angular-query'
      | 'solid-query';
    options?: QueryOptions;
    output?: NormalizedOutputOptions;
  } = {}) =>
  () => {
    const client: ClientBuilder = (verbOptions, options, outputClient) => {
      if (
        options.override.useNamedParameters &&
        (type === 'vue-query' || outputClient === 'vue-query')
      ) {
        throw new Error(
          `vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686`,
        );
      }

      if (queryOptions) {
        const normalizedQueryOptions = normalizeQueryOptions(
          queryOptions,
          options.context.workspace,
        );
        verbOptions.override.query = mergeDeep(
          normalizedQueryOptions,
          verbOptions.override.query,
        );
        options.override.query = mergeDeep(
          normalizedQueryOptions,
          verbOptions.override.query,
        );
      }
      return generateQuery(verbOptions, options, outputClient, output);
    };

    return {
      client: client,
      header: generateQueryHeader,
      dependencies: dependenciesBuilder[type],
    };
  };

export default builder;
