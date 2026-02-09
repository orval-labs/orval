import { isObject } from '@orval/core';

export const stripNill = (object: unknown) =>
  isObject(object)
    ? Object.fromEntries(
        Object.entries(object).filter(
          ([_, value]) => value !== null && value !== undefined,
        ),
      )
    : object;
