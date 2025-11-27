export async function asyncReduce<IterationItem, AccValue>(
  array: IterationItem[],
  reducer: (
    accumulate: AccValue,
    current: IterationItem,
  ) => AccValue | Promise<AccValue>,
  initValue: AccValue,
): Promise<AccValue> {
  let accumulate =
    typeof initValue === 'object'
      ? Object.create(initValue as unknown as object)
      : initValue;

  for (const item of array) {
    accumulate = await reducer(accumulate, item);
  }

  return accumulate;
}
