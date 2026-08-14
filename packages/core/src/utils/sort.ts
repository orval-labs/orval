export const sortByPriority = <T>(
  arr: (T & { default?: unknown; required?: boolean })[],
) =>
  arr.toSorted((a, b) => {
    if (a.default) {
      return 1;
    }

    if (b.default) {
      return -1;
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
