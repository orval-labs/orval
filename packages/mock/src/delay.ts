import {
  isBoolean,
  isFunction,
  isNumber,
  type GlobalMockOptions,
  type NormalizedOverrideOutput,
} from '@orval/core';

export const getDelay = (
  override?: NormalizedOverrideOutput,
  options?: GlobalMockOptions,
): GlobalMockOptions['delay'] => {
  const overrideDelay = override?.mock?.delay ?? options?.delay;
  const delayFunctionLazyExecute =
    override?.mock?.delayFunctionLazyExecute ??
    options?.delayFunctionLazyExecute;
  if (isFunction(overrideDelay)) {
    return delayFunctionLazyExecute ? overrideDelay : overrideDelay();
  }
  if (isNumber(overrideDelay) || isBoolean(overrideDelay)) {
    return overrideDelay;
  }
  return false;
};
