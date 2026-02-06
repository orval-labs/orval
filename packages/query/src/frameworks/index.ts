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

import {
  isQueryV5,
  isQueryV5WithDataTagError,
  isQueryV5WithInfiniteQueryOptionsError,
  isSvelteQueryV3,
  isSvelteQueryV6,
  isVueQueryV3,
} from '../dependencies';
import type {
  FrameworkAdapter,
  FrameworkAdapterConfig,
} from '../framework-adapter';
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
        }),
      );
    }

    case OutputClientConst.SOLID_QUERY: {
      return withDefaults(
        createSolidAdapter({
          hasQueryV5: _hasQueryV5,
          hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
          hasQueryV5WithInfiniteQueryOptionsError:
            _hasQueryV5WithInfiniteQueryOptionsError,
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
        }),
      );
    }
  }
};
