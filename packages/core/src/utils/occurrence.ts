export const count = (str: string = '', key: string) => {
  if (!str) {
    return 0;
  }

  return (str.match(new RegExp(key, 'g')) ?? []).length;
};
