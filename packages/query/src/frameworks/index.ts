import {
  type OutputClient,
  OutputClient as OutputClientConst,
  type OutputClientFunc,
  type PackageJson,
} from '@orval/core';

import {
  isQueryV5,
  isQueryV5WithDataTagError,
  isQueryV5WithInfiniteQueryOptionsError,
  isSvelteQueryV3,
  isSvelteQueryV6,
  isVueQueryV3,
} from '../dependencies';
import type { FrameworkAdapter } from '../framework-adapter';
import { createAngularAdapter } from './angular';
import { createReactAdapter } from './react';
import { createSolidAdapter } from './solid';
import { createSvelteAdapter } from './svelte';
import { createVueAdapter } from './vue';

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
      return createVueAdapter({
        hasVueQueryV4,
        hasQueryV5: _hasQueryV5,
        hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
        hasQueryV5WithInfiniteQueryOptionsError:
          _hasQueryV5WithInfiniteQueryOptionsError,
      });
    }

    case OutputClientConst.SVELTE_QUERY: {
      const hasSvelteQueryV4 =
        !isSvelteQueryV3(packageJson) || queryVersion === 4;
      const _hasSvelteQueryV6 = isSvelteQueryV6(packageJson);
      return createSvelteAdapter({
        hasSvelteQueryV4,
        hasSvelteQueryV6: _hasSvelteQueryV6,
        hasQueryV5: _hasQueryV5,
        hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
        hasQueryV5WithInfiniteQueryOptionsError:
          _hasQueryV5WithInfiniteQueryOptionsError,
      });
    }

    case OutputClientConst.ANGULAR_QUERY: {
      return createAngularAdapter({
        hasQueryV5: _hasQueryV5,
        hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
        hasQueryV5WithInfiniteQueryOptionsError:
          _hasQueryV5WithInfiniteQueryOptionsError,
      });
    }

    case OutputClientConst.SOLID_QUERY: {
      return createSolidAdapter({
        hasQueryV5: _hasQueryV5,
        hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
        hasQueryV5WithInfiniteQueryOptionsError:
          _hasQueryV5WithInfiniteQueryOptionsError,
      });
    }

    default: {
      // react-query is the default
      return createReactAdapter({
        hasQueryV5: _hasQueryV5,
        hasQueryV5WithDataTagError: _hasQueryV5WithDataTagError,
        hasQueryV5WithInfiniteQueryOptionsError:
          _hasQueryV5WithInfiniteQueryOptionsError,
      });
    }
  }
};
