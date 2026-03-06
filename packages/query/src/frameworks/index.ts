import {
  getRouteAsArray,
  type GetterProp,
  type GetterProps,
  GetterPropType,
  isObject,
  type OutputClient,
  OutputClient as OutputClientConst,
  type OutputClientFunc,
  type PackageJson,
  toObjectString,
} from '@orval/core';

import { getQueryArgumentsRequestType } from '../client';
import {
  isQueryV5,
  isQueryV5WithDataTagError,
  isQueryV5WithInfiniteQueryOptionsError,
  isQueryV5WithMutationContextOnSuccess,
  isQueryV5WithRequiredContextOnSuccess,
  isSolidQueryWithUsePrefix,
  isSvelteQueryV3,
  isSvelteQueryV6,
  isVueQueryV3,
} from '../dependencies';
import type {
  FrameworkAdapter,
  FrameworkAdapterConfig,
  MutationOnSuccessContext,
} from '../framework-adapter';
import { getQueryOptionsDefinition } from '../query-options';
import { createAngularAdapter } from './angular';
import { createReactAdapter } from './react';
import { createSolidAdapter } from './solid';
import { createSvelteAdapter } from './svelte';
import { createVueAdapter } from './vue';

/** Fill in defaults for fields that most adapters leave empty or share a common implementation. */
const withDefaults = (adapter: FrameworkAdapterConfig): FrameworkAdapter => ({
  // --- Original defaults (false / empty string) ---
  isAngularHttp: false,
  getHttpFirstParam: () => '',
  getMutationHttpPrefix: () => '',
  getUnrefStatements: () => '',
  getQueryInvocationSuffix: () => '',

  // --- Identity / pass-through defaults ---
  transformProps: (props) => props,
  getHttpFunctionQueryProps: (qp) => qp,
  getQueryType: (type) => type,

  // --- Boolean defaults ---
  shouldDestructureNamedPathParams: () => true,
  shouldAnnotateQueryKey: () => true,
  shouldGenerateOverrideTypes: () => false,
  shouldCastQueryResult: () => true,
  shouldCastQueryOptions: () => true,

  // --- String defaults ---
  getQueryKeyPrefix: () => 'queryOptions?.queryKey ?? ',
  getQueryOptionsDefinitionPrefix: () => 'Use',

  // --- Common implementation defaults ---
  getHookPropsDefinitions: (props) => toObjectString(props, 'implementation'),

  getQueryKeyRouteString(route, shouldSplitQueryKey) {
    if (shouldSplitQueryKey) {
      return getRouteAsArray(route);
    }
    return `\`${route}\``;
  },

  generateEnabledOption(params, options) {
    if (!isObject(options) || !Object.hasOwn(options, 'enabled')) {
      return `enabled: !!(${params.map(({ name }) => name).join(' && ')}),`;
    }
    return '';
  },

  getQueryPropertyForProp(prop: GetterProp, body: { implementation: string }) {
    if (prop.type === GetterPropType.NAMED_PATH_PARAMS)
      return prop.destructured;
    return prop.type === GetterPropType.BODY ? body.implementation : prop.name;
  },

  getInfiniteQueryHttpProps(props: GetterProps, queryParam: string) {
    return props
      .map((param) => {
        if (param.type === GetterPropType.NAMED_PATH_PARAMS)
          return param.destructured;
        return param.name === 'params'
          ? `{...params, '${queryParam}': pageParam || params?.['${queryParam}']}`
          : param.name;
      })
      .join(',');
  },

  generateQueryInit({ queryOptionsFnName, queryProperties, isRequestOptions }) {
    const queryOptionsVarName = isRequestOptions ? 'queryOptions' : 'options';
    return `const ${queryOptionsVarName} = ${queryOptionsFnName}(${queryProperties}${
      queryProperties ? ',' : ''
    }${isRequestOptions ? 'options' : 'queryOptions'})`;
  },

  generateQueryInvocationArgs({
    queryOptionsVarName,
    optionalQueryClientArgument,
  }) {
    return `${queryOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''}`;
  },

  getOptionalQueryClientArgument() {
    return adapter.hasQueryV5 ? ', queryClient?: QueryClient' : '';
  },

  generateQueryArguments({
    operationName,
    definitions,
    mutator,
    isRequestOptions,
    type,
    queryParams,
    queryParam,
    initialData,
    httpClient,
    hasInvalidation,
  }) {
    const prefix = adapter.getQueryOptionsDefinitionPrefix?.() ?? 'Use';
    const definition = getQueryOptionsDefinition({
      operationName,
      mutator,
      definitions,
      type,
      prefix,
      hasQueryV5: adapter.hasQueryV5,
      hasQueryV5WithInfiniteQueryOptionsError:
        adapter.hasQueryV5WithInfiniteQueryOptionsError,
      queryParams,
      queryParam,
      isReturnType: false,
      initialData,
    });

    if (!isRequestOptions) {
      return `${type ? 'queryOptions' : 'mutationOptions'}${
        initialData === 'defined' ? '' : '?'
      }: ${definition}`;
    }

    const requestType = getQueryArgumentsRequestType(httpClient, mutator);
    const isQueryRequired = initialData === 'defined';
    const skipInvalidationProp =
      !type && hasInvalidation ? 'skipInvalidation?: boolean, ' : '';
    const optionsType = `{ ${
      type ? 'query' : 'mutation'
    }${isQueryRequired ? '' : '?'}:${definition}, ${skipInvalidationProp}${requestType}}`;

    return `options${isQueryRequired ? '' : '?'}: ${optionsType}\n`;
  },

  generateMutationOnSuccess({
    operationName,
    definitions,
    isRequestOptions,
    generateInvalidateCall,
    uniqueInvalidates,
  }: MutationOnSuccessContext): string {
    const invalidateCalls = uniqueInvalidates
      .map((t) => generateInvalidateCall(t))
      .join('\n');
    if (adapter.hasQueryV5WithMutationContextOnSuccess) {
      if (isRequestOptions) {
        return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, onMutateResult: TContext, context: MutationFunctionContext) => {
        if (!options?.skipInvalidation) {
    ${invalidateCalls}
        }
        mutationOptions?.onSuccess?.(data, variables, onMutateResult, context);
      };`;
      }
      return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, onMutateResult: TContext, context: MutationFunctionContext) => {
    ${invalidateCalls}
        mutationOptions?.onSuccess?.(data, variables, onMutateResult, context);
      };`;
    } else {
      if (isRequestOptions) {
        return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, context: TContext${adapter.hasQueryV5WithRequiredContextOnSuccess ? '' : ' | undefined'}) => {
        if (!options?.skipInvalidation) {
    ${invalidateCalls}
        }
        mutationOptions?.onSuccess?.(data, variables, context);
      };`;
      }
      return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, context: TContext${adapter.hasQueryV5WithRequiredContextOnSuccess ? '' : ' | undefined'}) => {
    ${invalidateCalls}
        mutationOptions?.onSuccess?.(data, variables, context);
      };`;
    }
  },
  ...adapter,
});

export type QueryClientType =
  | 'react-query'
  | 'vue-query'
  | 'svelte-query'
  | 'angular-query'
  | 'solid-query';

/**
 * Create a FrameworkAdapter for the given output client, resolving version flags
 * from the packageJson and query config.
 */
export const createFrameworkAdapter = ({
  outputClient,
  packageJson,
  queryVersion,
}: {
  outputClient: OutputClient | OutputClientFunc;
  packageJson?: PackageJson;
  queryVersion?: number;
}): FrameworkAdapter => {
  const clientType = outputClient as QueryClientType;

  const _hasQueryV5 = queryVersion === 5 || isQueryV5(packageJson, clientType);

  const _hasQueryV5WithDataTagError =
    queryVersion === 5 || isQueryV5WithDataTagError(packageJson, clientType);

  const _hasQueryV5WithInfiniteQueryOptionsError =
    queryVersion === 5 ||
    isQueryV5WithInfiniteQueryOptionsError(packageJson, clientType);
  const _hasQueryV5WithMutationContextOnSuccess =
    isQueryV5WithMutationContextOnSuccess(packageJson, clientType);
  const _hasQueryV5WithRequiredContextOnSuccess =
    isQueryV5WithRequiredContextOnSuccess(packageJson, clientType);

  switch (outputClient) {
    case OutputClientConst.VUE_QUERY: {
      const hasVueQueryV4 = !isVueQueryV3(packageJson) || queryVersion === 4;
      return withDefaults(
        createVueAdapter({
          hasVueQueryV4,
          hasQueryV5: _hasQueryV5,
          hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
          hasQueryV5WithInfiniteQueryOptionsError:
            _hasQueryV5WithInfiniteQueryOptionsError,
          hasQueryV5WithMutationContextOnSuccess:
            _hasQueryV5WithMutationContextOnSuccess,
          hasQueryV5WithRequiredContextOnSuccess:
            _hasQueryV5WithRequiredContextOnSuccess,
        }),
      );
    }

    case OutputClientConst.SVELTE_QUERY: {
      const hasSvelteQueryV4 =
        !isSvelteQueryV3(packageJson) || queryVersion === 4;
      const _hasSvelteQueryV6 = isSvelteQueryV6(packageJson);
      return withDefaults(
        createSvelteAdapter({
          hasSvelteQueryV4,
          hasSvelteQueryV6: _hasSvelteQueryV6,
          hasQueryV5: _hasQueryV5,
          hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
          hasQueryV5WithInfiniteQueryOptionsError:
            _hasQueryV5WithInfiniteQueryOptionsError,
          hasQueryV5WithMutationContextOnSuccess:
            _hasQueryV5WithMutationContextOnSuccess,
          hasQueryV5WithRequiredContextOnSuccess:
            _hasQueryV5WithRequiredContextOnSuccess,
        }),
      );
    }

    case OutputClientConst.ANGULAR_QUERY: {
      return withDefaults(
        createAngularAdapter({
          hasQueryV5: _hasQueryV5,
          hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
          hasQueryV5WithInfiniteQueryOptionsError:
            _hasQueryV5WithInfiniteQueryOptionsError,
          hasQueryV5WithMutationContextOnSuccess:
            _hasQueryV5WithMutationContextOnSuccess,
          hasQueryV5WithRequiredContextOnSuccess:
            _hasQueryV5WithRequiredContextOnSuccess,
        }),
      );
    }

    case OutputClientConst.SOLID_QUERY: {
      const hasSolidQueryWithUsePrefix = isSolidQueryWithUsePrefix(packageJson);
      return withDefaults(
        createSolidAdapter({
          hasQueryV5: _hasQueryV5,
          hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
          hasQueryV5WithInfiniteQueryOptionsError:
            _hasQueryV5WithInfiniteQueryOptionsError,
          hasQueryV5WithMutationContextOnSuccess:
            _hasQueryV5WithMutationContextOnSuccess,
          hasQueryV5WithRequiredContextOnSuccess:
            _hasQueryV5WithRequiredContextOnSuccess,
          hasSolidQueryUsePrefix: hasSolidQueryWithUsePrefix,
        }),
      );
    }

    default: {
      // react-query is the default
      return withDefaults(
        createReactAdapter({
          hasQueryV5: _hasQueryV5,
          hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
          hasQueryV5WithInfiniteQueryOptionsError:
            _hasQueryV5WithInfiniteQueryOptionsError,
          hasQueryV5WithMutationContextOnSuccess:
            _hasQueryV5WithMutationContextOnSuccess,
          hasQueryV5WithRequiredContextOnSuccess:
            _hasQueryV5WithRequiredContextOnSuccess,
        }),
      );
    }
  }
};
