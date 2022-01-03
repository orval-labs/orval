export const asyncReduce = <
  Result extends unknown,
  Item extends unknown = unknown,
>(
  arr: Item[],
  func: (acc: Result, it: Item, index: number, arr: Item[]) => Promise<Result>,
  acc: Result,
): Promise<Result> =>
  arr.reduce<Promise<Result>>(
    async (acc, ...rest) => func(await acc, ...rest),
    Promise.resolve(acc),
  );
