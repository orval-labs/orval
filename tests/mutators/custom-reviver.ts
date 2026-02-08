import { isString } from '@orval/core';

const isoDateFormat =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d*)?(?:[-+]\d{2}:?\d{2}|Z)?$/;
const reviver = (key: string, value: unknown) => {
  if (value && isString(value) && isoDateFormat.test(value)) {
    return new Date(value);
  }
  return value;
};
export default reviver;
