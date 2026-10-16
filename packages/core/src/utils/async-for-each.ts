/**
 * Calls `callback` for every item with at most `concurrency` calls in flight.
 * After the first failure no further items start; once the calls already in
 * flight have settled, the returned promise rejects with the error of the
 * earliest item that failed, so the reported error does not depend on timing.
 */
export async function asyncForEach<T>(
  items: readonly T[],
  concurrency: number,
  callback: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failedIndex = Infinity;
  let failure: unknown;

  const worker = async () => {
    while (failedIndex === Infinity && next < items.length) {
      const index = next++;
      try {
        await callback(items[index]);
      } catch (error) {
        if (index < failedIndex) {
          failedIndex = index;
          failure = error;
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );

  if (failedIndex !== Infinity) {
    throw failure;
  }
}
