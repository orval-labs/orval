const unicodes = function (s: string, prefix: string) {
  prefix = prefix || '';
  return s.replace(/(^|-)/g, '$1\\u' + prefix).replace(/,/g, '\\u' + prefix);
};

const symbols = unicodes('20-26,28-2F,3A-40,5B-60,7B-7E,A0-BF,D7,F7', '00');
const lowers = 'a-z' + unicodes('DF-F6,F8-FF', '00');
const uppers = 'A-Z' + unicodes('C0-D6,D8-DE', '00');
const impropers =
  'A|An|And|As|At|But|By|En|For|If|In|Of|On|Or|The|To|Vs?\\.?|Via';

const regexps = {
  capitalize: new RegExp('(^|[' + symbols + '])([' + lowers + '])', 'g'),
  pascal: new RegExp('(^|[' + symbols + '])+([' + lowers + uppers + '])', 'g'),
  fill: new RegExp('[' + symbols + ']+(.|$)', 'g'),
  sentence: new RegExp(
    '(^\\s*|[\\?\\!\\.]+"?\\s+"?|,\\s+")([' + lowers + '])',
    'g',
  ),
  improper: new RegExp('\\b(' + impropers + ')\\b', 'g'),
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

const fill = (s: string, fillWith?: string, isDeapostrophe = false) => {
  if (fillWith != null) {
    s = s.replace(regexps.fill, function (m, next) {
      return next ? fillWith + next : '';
    });
  }
  if (isDeapostrophe) {
    s = deapostrophe(s);
  }
  return s;
};

const decap = (s: string) => {
  return low.call(s.charAt(0)) + s.slice(1);
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
  s = s == null ? '' : s + ''; // force to string
  if (!isUpper && regexps.upper.test(s)) {
    s = low.call(s);
  }
  if (!isFill && !regexps.hole.test(s)) {
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

export const pascal = (s: string) => {
  return fill(
    prep(s, false, true).replace(
      regexps.pascal,
      (m: string, border: string, letter: string) => {
        return up.call(letter);
      },
    ),
    '',
    true,
  );
};

export const camel = (s: string) => {
  return decap(pascal(s));
};

export const snake = (s: string) => {
  return lower(s, '_', true);
};

export const kebab = (s: string) => {
  return lower(s, '-', true);
};

export const upper = (
  s: string,
  fillWith?: string,
  isDeapostrophe?: boolean,
) => {
  return fill(
    up.call(prep(s, !!fillWith, false, true)),
    fillWith,
    isDeapostrophe,
  );
};
