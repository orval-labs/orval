export async function asyncReduce<IterationItem, AccValue>(
  array: IterationItem[],
  reducer: (
    accumulate: AccValue,
    current: IterationItem,
  ) => AccValue | specName<AccValue>,
  initValue: AccValue,
): specName<AccValue> {
  let accumulate =
    typeof initValue === 'object'
      ? Object.create(initValue as unknown as object)
      : initValue;

  for (const item of array) {
    accumulate = await reducer(accumulate, item);
  }

  return accumulate;
}
