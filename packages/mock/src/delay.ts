import type { GlobalMockOptions, NormalizedOverrideOutput } from '@orval/core';

export const getDelay = (
  override?: NormalizedOverrideOutput,
  options?: GlobalMockOptions,
): GlobalMockOptions['delay'] => {
  const overrideDelay = override?.mock?.delay ?? options?.delay;
  const delayFunctionLazyExecute =
    override?.mock?.delayFunctionLazyExecute ??
    options?.delayFunctionLazyExecute;
  switch (typeof overrideDelay) {
    case 'function': {
      return delayFunctionLazyExecute ? overrideDelay : overrideDelay();
    }
    case 'number':
    case 'boolean': {
      return overrideDelay;
    }
    default: {
      return false;
    }
  }
};
