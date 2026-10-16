/**
 * Calls `callback` for every item with at most `concurrency` calls in flight.
 * After the first failure no further items start; the returned promise
 * rejects with that error once the calls already in flight have settled.
 */
export async function asyncForEach<T>(
  items: readonly T[],
  concurrency: number,
  callback: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  let failure: { error: unknown } | undefined;

  const worker = async () => {
    while (!failure && next < items.length) {
      try {
        await callback(items[next++]);
      } catch (error) {
        failure ??= { error };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );

  if (failure) {
    throw failure.error;
  }
}
