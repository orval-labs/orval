import { NamingConvention } from '../types';

const unicodes = function (s: string, prefix: string) {
  prefix = prefix || '';
  return s
    .replaceAll(/(^|-)/g, String.raw`$1\u` + prefix)
    .replaceAll(',', String.raw`\u` + prefix);
};

const symbols = unicodes('20-26,28-2F,3A-40,5B-60,7B-7E,A0-BF,D7,F7', '00');
const lowers = 'a-z' + unicodes('DF-F6,F8-FF', '00');
const uppers = 'A-Z' + unicodes('C0-D6,D8-DE', '00');
const impropers = String.raw`A|An|And|As|At|But|By|En|For|If|In|Of|On|Or|The|To|Vs?\.?|Via`;

const regexps = {
  capitalize: new RegExp('(^|[' + symbols + '])([' + lowers + '])', 'g'),
  pascal: new RegExp('(^|[' + symbols + '])+([' + lowers + uppers + '])', 'g'),
  fill: new RegExp('[' + symbols + ']+(.|$)', 'g'),
  sentence: new RegExp(
    String.raw`(^\s*|[\?\!\.]+"?\s+"?|,\s+")([` + lowers + '])',
    'g',
  ),
  improper: new RegExp(String.raw`\b(` + impropers + String.raw`)\b`, 'g'),
  relax: new RegExp(
    '([^' +
      uppers +
      '])([' +
      uppers +
      ']*)([' +
      uppers +
      '])(?=[^' +
      uppers +
      ']|$)',
    'g',
  ),
  upper: new RegExp('^[^' + lowers + ']+$'),
  hole: /[^\s]\s[^\s]/,
  apostrophe: /'/g,
  room: new RegExp('[' + symbols + ']'),
};

const deapostrophe = (s: string) => {
  return s.replace(regexps.apostrophe, '');
};

const up = String.prototype.toUpperCase;
const low = String.prototype.toLowerCase;

const fill = (s: string, fillWith: string, isDeapostrophe = false) => {
  s = s.replace(regexps.fill, function (m, next) {
    return next ? fillWith + next : '';
  });

  if (isDeapostrophe) {
    s = deapostrophe(s);
  }
  return s;
};

const decap = (s: string, char = 0) => {
  return low.call(s.charAt(char)) + s.slice(char + 1);
};

const relax = (
  m: string,
  before: string,
  acronym: string | undefined,
  caps: string,
) => {
  return before + ' ' + (acronym ? acronym + ' ' : '') + caps;
};

const prep = (s: string, isFill = false, isPascal = false, isUpper = false) => {
  s = s == undefined ? '' : s + ''; // force to string
  if (!isUpper && regexps.upper.test(s)) {
    s = low.call(s);
  }
  if (!isFill && !regexps.hole.test(s)) {
    // eslint-disable-next-line no-var
    var holey = fill(s, ' ');
    if (regexps.hole.test(holey)) {
      s = holey;
    }
  }
  if (!isPascal && !regexps.room.test(s)) {
    s = s.replace(regexps.relax, relax);
  }
  return s;
};

const lower = (s: string, fillWith: string, isDeapostrophe: boolean) => {
  return fill(low.call(prep(s, !!fillWith)), fillWith, isDeapostrophe);
};

// Caches the previously converted strings to improve performance
const pascalMemory: Record<string, string> = {};

export const pascal = (s: string) => {
  if (pascalMemory[s]) {
    return pascalMemory[s];
  }

  const isStartWithUnderscore = s?.startsWith('_');

  if (regexps.upper.test(s)) {
    s = low.call(s);
  }

  const pascalString = (s?.match(/[a-zA-Z0-9\u00C0-\u017F]+/g) || [])
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  const pascalWithUnderscore = isStartWithUnderscore
    ? `_${pascalString}`
    : pascalString;

  pascalMemory[s] = pascalWithUnderscore;

  return pascalWithUnderscore;
};

export const camel = (s: string) => {
  const isStartWithUnderscore = s?.startsWith('_');
  const camelString = decap(pascal(s), isStartWithUnderscore ? 1 : 0);
  return isStartWithUnderscore ? `_${camelString}` : camelString;
};

export const snake = (s: string) => {
  return lower(s, '_', true);
};

export const kebab = (s: string) => {
  return lower(s, '-', true);
};

export const upper = (
  s: string,
  fillWith: string,
  isDeapostrophe?: boolean,
) => {
  return fill(
    up.call(prep(s, !!fillWith, false, true)),
    fillWith,
    isDeapostrophe,
  );
};

export const conventionName = (name: string, convention: NamingConvention) => {
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
};
