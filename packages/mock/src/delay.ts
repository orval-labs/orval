import {
  type GlobalMockOptions,
  isBoolean,
  isFunction,
  isMswMock,
  isNumber,
  type MswMockOptions,
  type NormalizedOverrideOutput,
} from '@orval/core';

export const getDelay = (
  override?: NormalizedOverrideOutput,
  options?: GlobalMockOptions,
): MswMockOptions['delay'] => {
  // `delay` and `delayFunctionLazyExecute` are MSW-only. Narrow the
  // discriminated `GlobalMockOptions` union (and the partial override
  // counterpart) before reading them.
  const mswOptions = options && isMswMock(options) ? options : undefined;
  const overrideMock = override?.mock as Partial<MswMockOptions> | undefined;
  const overrideDelay = overrideMock?.delay ?? mswOptions?.delay;
  const delayFunctionLazyExecute =
    overrideMock?.delayFunctionLazyExecute ??
    mswOptions?.delayFunctionLazyExecute;
  if (isFunction(overrideDelay)) {
    return delayFunctionLazyExecute ? overrideDelay : overrideDelay();
  }
  if (isNumber(overrideDelay) || isBoolean(overrideDelay)) {
    return overrideDelay;
  }
  return false;
};
