import { keyword } from 'esutils';
import { isNullish } from 'remeda';

import {
  isBoolean,
  isFunction,
  isNumber,
  isObject,
  isString,
} from './assertion';

/**
 * Converts data to a string representation suitable for code generation.
 * Handles strings, numbers, booleans, functions, arrays, and objects.
 *
 * @param data - The data to stringify. Can be a string, array, object, number, boolean, function, null, or undefined.
 * @returns A string representation of the data, or undefined if data is null or undefined.
 * @example
 * stringify('hello') // returns "'hello'"
 * stringify(42) // returns "42"
 * stringify([1, 2, 3]) // returns "[1, 2, 3]"
 * stringify({ a: 1, b: 'test' }) // returns "{ a: 1, b: 'test', }"
 */
export function stringify(
  data?: string | any[] | Record<string, any>,
): string | undefined {
  if (isNullish(data)) {
    return;
  }

  if (isString(data)) {
    return `'${data.replaceAll("'", String.raw`\'`)}'`;
  }

  if (isNumber(data) || isBoolean(data) || isFunction(data)) {
    return `${data}`;
  }

  if (Array.isArray(data)) {
    return `[${data.map((item) => stringify(item)).join(', ')}]`;
  }

  return Object.entries(data).reduce((acc, [key, value], index, arr) => {
    const strValue = stringify(value);
    if (arr.length === 1) {
      return `{ ${key}: ${strValue}, }`;
    }

    if (!index) {
      return `{ ${key}: ${strValue}, `;
    }

    if (arr.length - 1 === index) {
      return acc + `${key}: ${strValue}, }`;
    }

    return acc + `${key}: ${strValue}, `;
  }, '');
}

/**
 * Sanitizes a string value by removing or replacing special characters and ensuring
 * it conforms to JavaScript identifier naming rules if needed.
 *
 * @param value - The string value to sanitize.
 * @param options - Configuration options for sanitization:
 *   - `whitespace` - Replacement string for whitespace characters, or `true` to keep them.
 *   - `underscore` - Replacement string for underscores, or `true` to keep them.
 *   - `dot` - Replacement string for dots, or `true` to keep them.
 *   - `dash` - Replacement string for dashes, or `true` to keep them.
 *   - `es5keyword` - If true, prefixes the value with underscore if it's an ES5 keyword.
 *   - `es5IdentifierName` - If true, ensures the value is a valid ES5 identifier name.
 *   - `special` - If true, preserves special characters that would otherwise be removed.
 * @returns The sanitized string value.
 * @example
 * sanitize('hello-world', { dash: '_' }) // returns "hello_world"
 * sanitize('class', { es5keyword: true }) // returns "_class"
 * sanitize('123abc', { es5IdentifierName: true }) // returns "N123abc"
 */
export function sanitize(
  value: string,
  options?: {
    whitespace?: string | true;
    underscore?: string | true;
    dot?: string | true;
    dash?: string | true;
    es5keyword?: boolean;
    es5IdentifierName?: boolean;
    special?: boolean;
  },
) {
  const {
    whitespace = '',
    underscore = '',
    dot = '',
    dash = '',
    es5keyword = false,
    es5IdentifierName = false,
    special = false,
  } = options ?? {};
  let newValue = value;

  if (!special) {
    newValue = newValue.replaceAll(/[!"`'#%&,:;<>=@{}~$()*+/\\?[\]^|]/g, '');
  }

  if (whitespace !== true) {
    newValue = newValue.replaceAll(/[\s]/g, whitespace);
  }

  if (underscore !== true) {
    newValue = newValue.replaceAll(/['_']/g, underscore);
  }

  if (dot !== true) {
    newValue = newValue.replaceAll(/[.]/g, dot);
  }

  if (dash !== true) {
    newValue = newValue.replaceAll(/[-]/g, dash);
  }

  if (es5keyword) {
    newValue = keyword.isKeywordES5(newValue, true) ? `_${newValue}` : newValue;
  }

  if (es5IdentifierName) {
    if (/^[0-9]/.test(newValue)) {
      newValue = `N${newValue}`;
    } else {
      newValue = keyword.isIdentifierNameES5(newValue)
        ? newValue
        : `_${newValue}`;
    }
  }

  return newValue;
}

/**
 * Converts an array of objects to a comma-separated string representation.
 * Optionally extracts a nested property from each object using a dot-notation path.
 *
 * @param props - Array of objects to convert to string.
 * @param path - Optional dot-notation path to extract a property from each object (e.g., "user.name").
 * @returns A comma-separated string of values, with each value on a new line indented.
 * @example
 * toObjectString([{ name: 'John' }, { name: 'Jane' }], 'name')
 * // returns "John,\n    Jane,"
 * toObjectString(['a', 'b', 'c'])
 * // returns "a,\n    b,\n    c,"
 */
export function toObjectString<T>(props: T[], path?: keyof T) {
  if (props.length === 0) {
    return '';
  }

  const arrayOfString = isString(path)
    ? props.map((prop) =>
        path
          .split('.')
          .reduce(
            (obj: any, key: string) =>
              obj && (isObject(obj) || Array.isArray(obj))
                ? obj[key]
                : undefined,
            prop,
          ),
      )
    : props;

  return arrayOfString.join(',\n    ') + ',';
}

const NUMBERS = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

/**
 * Converts a number to its word representation by translating each digit to its word form.
 *
 * @param num - The number to convert to words.
 * @returns A string containing the word representation of each digit concatenated together.
 * @example
 * getNumberWord(123) // returns "onetwothree"
 * getNumberWord(42) // returns "fourtwo"
 */
export function getNumberWord(num: number) {
  const arrayOfNumber = [...num.toString()] as (keyof typeof NUMBERS)[];
  return arrayOfNumber.reduce((acc, n) => acc + NUMBERS[n], '');
}

/**
 * Escapes a specific character in a string by prefixing it with a backslash.
 *
 * @param str - The string to escape, or null.
 * @param char - The character to escape. Defaults to single quote (').
 * @returns The escaped string, or null if the input is null.
 * @example
 * escape("don't") // returns "don\'t"
 * escape('say "hello"', '"') // returns 'say \\"hello\\"'
 */
export function escape(str: string | null, char = "'") {
  return str?.replace(char, `\\${char}`);
}

/**
 * Escape all characters not included in SingleStringCharacters and
 * DoubleStringCharacters on
 * http://www.ecma-international.org/ecma-262/5.1/#sec-7.8.4
 *
 * Based on https://github.com/joliss/js-string-escape/blob/master/index.js
 *
 * @param input String to escape
 */
export function jsStringEscape(input: string) {
  return input.replaceAll(/["'\\\n\r\u2028\u2029/*]/g, (character) => {
    switch (character) {
      case '"':
      case "'":
      case '\\':
      case '/':
      case '*': {
        return '\\' + character;
      }
      // Four possible LineTerminator characters need to be escaped:
      case '\n': {
        return String.raw`\n`;
      }
      case '\r': {
        return String.raw`\r`;
      }
      case '\u2028': {
        return String.raw`\u2028`;
      }
      case '\u2029': {
        return String.raw`\u2029`;
      }
      default: {
        return '';
      }
    }
  });
}

/**
 * Deduplicates a TypeScript union type string.
 * Handles types like "A | B | B" → "A | B" and "null | null" → "null".
 * Only splits on top-level | (not inside {} () [] <> or string literals).
 */
export function dedupeUnionType(unionType: string): string {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote = ''; // current open quote char, or '' if outside string
  let escaped = false; // true if previous char was unescaped \ inside string

  for (const c of unionType) {
    if (!escaped && (c === "'" || c === '"')) {
      if (!quote) quote = c;
      else if (quote === c) quote = '';
    }

    if (!quote) {
      if ('{([<'.includes(c)) depth++;
      if ('})]>'.includes(c)) depth--;
      if (c === '|' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += c;
    escaped = !!quote && !escaped && c === '\\';
  }
  if (current.trim()) parts.push(current.trim());

  return [...new Set(parts)].join(' | ');
}
