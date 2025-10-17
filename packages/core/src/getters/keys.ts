import { keyword } from 'esutils';

export const getKey = (key: string) => {
  return keyword.isIdentifierNameES5(key) ? key : `'${key}'`;
};
