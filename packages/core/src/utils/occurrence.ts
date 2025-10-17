export const count = (str = '', key: string) => {
  if (!str) {
    return 0;
  }

  return (str.match(new RegExp(key, 'g')) ?? []).length;
};
