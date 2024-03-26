import { GlobalMockOptions, NormalizedOverrideOutput } from '@orval/core';

export const getDelay = (
  override?: NormalizedOverrideOutput,
  options?: GlobalMockOptions,
): GlobalMockOptions['delay'] => {
  const overrideDelay =
    typeof override?.mock?.delay === 'number'
      ? override?.mock?.delay
      : options?.delay;
  const delayMockFunction =
    override?.mock?.delayMockFunction ?? options?.delayMockFunction;
  switch (typeof overrideDelay) {
    case 'function':
      return delayMockFunction ? overrideDelay : overrideDelay();
    case 'number':
      return overrideDelay;
    default:
      return 1000;
  }
};
