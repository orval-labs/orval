import { keyword } from 'esutils';

import { jsStringLiteralEscape } from '../utils';

export function getKey(key: string) {
  return keyword.isIdentifierNameES5(key)
    ? key
    : `'${jsStringLiteralEscape(key)}'`;
}

/**
 * Emits a property access for a possibly non-identifier name: dot access for
 * valid identifier names (`.petId`), quoted bracket access otherwise
 * (`['scope.id']`).
 */
export function getPropertyAccessor(name: string) {
  return keyword.isIdentifierNameES5(name) ? `.${name}` : `[${getKey(name)}]`;
}
