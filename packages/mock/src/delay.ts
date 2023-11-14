import { GlobalMockOptions, NormalizedOverrideOutput } from '@orval/core';

export const getDelay = (
  override?: NormalizedOverrideOutput,
  options?: GlobalMockOptions,
): number => {
  const overrideDelay =
    typeof override?.mock?.delay === 'number'
      ? override?.mock?.delay
      : options?.delay;
  switch (typeof overrideDelay) {
    case 'function':
      return overrideDelay();
    case 'number':
      return overrideDelay;
    default:
      return 1000;
  }
};
