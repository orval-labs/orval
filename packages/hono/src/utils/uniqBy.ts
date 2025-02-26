export const uniqBy = <T>(arr: T[], key: keyof T): T[] => {
  const set = new Set();
  return arr.filter((a) => !set.has(a[key]) && set.add(a[key]));
};
