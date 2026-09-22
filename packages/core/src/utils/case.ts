import { NamingConvention } from '../types';

const SYMBOLS = String.raw`\u0020-\u0026\u0028-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E\u00A0-\u00BF\u00D7\u00F7`;
const LOWERS = String.raw`a-z\u00DF-\u00F6\u00F8-\u00FF`;
const UPPERS = String.raw`A-Z\u00C0-\u00D6\u00D8-\u00DE`;

const allUpperRe = new RegExp(`^[^${LOWERS}]+$`);
const hasSymbolRe = new RegExp(`[${SYMBOLS}]`);
const fillRe = new RegExp(`[${SYMBOLS}]+(.|$)`, 'g');
// "getHTTPResponse" -> "get HTTP Response"; only applied when the input has
// no separator characters at all.
const acronymRe = new RegExp(
  `([^${UPPERS}])([${UPPERS}]*)([${UPPERS}])(?=[^${UPPERS}]|$)`,
  'g',
);

const lower = (s: string, fillWith: string) => {
  if (allUpperRe.test(s)) s = s.toLowerCase();
  if (!hasSymbolRe.test(s)) {
    s = s.replace(
      acronymRe,
      (_, before: string, acronym: string, caps: string) =>
        `${before} ${acronym ? `${acronym} ` : ''}${caps}`,
    );
  }
  return s
    .toLowerCase()
    .replace(fillRe, (_, next: string) => (next ? fillWith + next : ''))
    .replaceAll("'", '');
};

// Caches the previously converted strings to improve performance.
// A Map, not an object literal: the keys are names taken from the OpenAPI
// document, and a schema is free to call a property `toString` or
// `constructor`. On an object those read back off `Object.prototype`, so the
// lookup would return a function instead of a string.
const pascalMemory = new Map<string, string>();

export function pascal(s = '') {
  const cached = pascalMemory.get(s);
  if (cached !== undefined) {
    return cached;
  }

  const isStartWithUnderscore = s.startsWith('_');
  const cacheKey = s;

  if (allUpperRe.test(s)) {
    s = s.toLowerCase();
  }

  const pascalString = (s.match(/[a-zA-Z0-9\u00C0-\u017F]+/g) ?? [])
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  const pascalWithUnderscore = isStartWithUnderscore
    ? `_${pascalString}`
    : pascalString;

  pascalMemory.set(cacheKey, pascalWithUnderscore);

  return pascalWithUnderscore;
}

export function camel(s = '') {
  const isStartWithUnderscore = s.startsWith('_');
  const at = isStartWithUnderscore ? 1 : 0;
  const p = pascal(s);
  const camelString = p.charAt(at).toLowerCase() + p.slice(at + 1);
  return isStartWithUnderscore ? `_${camelString}` : camelString;
}

export function snake(s = '') {
  return lower(s, '_');
}

export function kebab(s = '') {
  return lower(s, '-');
}

export function conventionName(name: string, convention: NamingConvention) {
  let nameConventionTransform = camel;
  switch (convention) {
    case NamingConvention.PASCAL_CASE: {
      nameConventionTransform = pascal;

      break;
    }
    case NamingConvention.SNAKE_CASE: {
      nameConventionTransform = snake;

      break;
    }
    case NamingConvention.KEBAB_CASE: {
      nameConventionTransform = kebab;

      break;
    }
    // No default
  }

  return nameConventionTransform(name);
}
