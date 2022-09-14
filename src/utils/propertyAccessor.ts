// inspired from dot-notation eslint rule
// https://github.com/eslint/eslint/blob/6ba269ed673f965d081287b769c12beeb5f98887/lib/rules/dot-notation.js#L18
const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/u;

/**
 * Generates property accessor for given property name using dot notation when possible and bracket notation otherwise
 */
export const generatePropertyAccessor = (key: string) =>
  validIdentifier.test(key) ? `.${key}` : `['${key}']`;
