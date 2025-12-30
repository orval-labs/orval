import { keyword } from 'esutils';

export function getKey(key: string) {
  return keyword.isIdentifierNameES5(key) ? key : `'${key}'`;
}
