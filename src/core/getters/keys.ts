export const getKey = (key: string) => {
  return key.match(/[^\w\s]/g) !== null ? `'${key}'` : key;
};
