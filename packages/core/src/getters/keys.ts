import { keyword } from 'esutils';

import { jsStringLiteralEscape } from '../utils';

export function getKey(key: string) {
  return keyword.isIdentifierNameES5(key)
    ? key
    : `'${jsStringLiteralEscape(key)}'`;
}
