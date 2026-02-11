import { isFunction } from './assertion';

export async function asyncReduce<IterationItem, AccValue>(
  array: IterationItem[],
  reducer: (
    accumulate: AccValue,
    current: IterationItem,
  ) => AccValue | Promise<AccValue>,
  initValue: AccValue,
): Promise<AccValue> {
  const shouldClone =
    initValue === null ||
    (initValue === Object(initValue) && !isFunction(initValue));
  let accumulate: AccValue = shouldClone
    ? (Object.create(initValue as unknown as object) as AccValue)
    : initValue;

  for (const item of array) {
    accumulate = await reducer(accumulate, item);
  }

  return accumulate;
}
