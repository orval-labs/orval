export const sortByPriority = <T>(
  arr: (T & { default?: unknown; required?: boolean })[],
) =>
  arr.toSorted((a, b) => {
    // A parameter carrying a default goes last, and `0`, `false` or an empty
    // string is a default like any other.
    const aHasDefault = a.default !== undefined;
    const bHasDefault = b.default !== undefined;
    if (aHasDefault !== bHasDefault) {
      return aHasDefault ? 1 : -1;
    }

    if (a.required && b.required) {
      return 0;
    }

    if (a.required) {
      return -1;
    }

    if (b.required) {
      return 1;
    }
    return 0;
  });

let naturalCompareCollator: Intl.Collator | undefined;

export function compareNatural(a: string, b: string): number {
  naturalCompareCollator ??= new Intl.Collator('en', { numeric: true });

  return naturalCompareCollator.compare(a, b);
}
