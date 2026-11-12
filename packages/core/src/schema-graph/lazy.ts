/** Computes a value on first use and keeps it. */
export const lazy = <T>(compute: () => T): (() => T) => {
  let cached: { value: T } | undefined;
  return () => {
    cached ??= { value: compute() };
    return cached.value;
  };
};
