import { describe, expect, it } from 'vite-plus/test';

import {
  mapTemplateExpressions,
  parseTemplateLiteral,
  stringifyTemplateLiteral,
} from './template-literal';

// A `${...}` written inside a template literal interpolates even under
// `String.raw`, so the fixtures below are assembled from plain strings.

/** `${name}` — an interpolation, as it appears in generated source. */
const tag = (name: string) => '${' + name + '}';
/** `\${name}` — escaped static text that must never be read as a tag. */
const escapedTag = (name: string) => '\\${' + name + '}';

describe('parseTemplateLiteral', () => {
  it('returns a single literal part for static source', () => {
    expect(parseTemplateLiteral('/pets/list')).toEqual([
      { kind: 'literal', source: '/pets/list' },
    ]);
  });

  it('returns nothing for empty source', () => {
    expect(parseTemplateLiteral('')).toEqual([]);
  });

  it('splits interpolations out of surrounding text', () => {
    expect(parseTemplateLiteral('/pets/' + tag('petId') + '/tags')).toEqual([
      { kind: 'literal', source: '/pets/' },
      { kind: 'expression', source: 'petId' },
      { kind: 'literal', source: '/tags' },
    ]);
  });

  it('keeps adjacent interpolations separate', () => {
    expect(parseTemplateLiteral(tag('a') + tag('b'))).toEqual([
      { kind: 'expression', source: 'a' },
      { kind: 'expression', source: 'b' },
    ]);
  });

  // The three cases below are what a `(?<!\\)` lookbehind cannot all get
  // right at once (#3703).
  it('treats an escaped ${ as literal text', () => {
    expect(parseTemplateLiteral('/foo' + escapedTag('petId'))).toEqual([
      { kind: 'literal', source: '/foo' + escapedTag('petId') },
    ]);
  });

  it('reads an interpolation that follows an escaped backslash', () => {
    expect(parseTemplateLiteral('/foo\\\\' + tag('petId'))).toEqual([
      { kind: 'literal', source: '/foo\\\\' },
      { kind: 'expression', source: 'petId' },
    ]);
  });

  it('reads an interpolation that follows an escaped ${', () => {
    expect(parseTemplateLiteral(escapedTag('a') + tag('b'))).toEqual([
      { kind: 'literal', source: escapedTag('a') },
      { kind: 'expression', source: 'b' },
    ]);
  });

  it('matches the closing brace by depth, not by the first }', () => {
    expect(parseTemplateLiteral(tag(' {a: 1}.a ') + '!')).toEqual([
      { kind: 'expression', source: ' {a: 1}.a ' },
      { kind: 'literal', source: '!' },
    ]);
  });

  it('ignores braces inside string literals in the expression', () => {
    for (const quote of ["'", '"', '`']) {
      const expression = `a ? ${quote}}${quote} : ${quote}{${quote}`;
      expect(parseTemplateLiteral(tag(expression))).toEqual([
        { kind: 'expression', source: expression },
      ]);
    }
  });

  it('ignores an escaped quote inside a string literal in the expression', () => {
    const expression = String.raw`a ?? 'it\'s }'`;
    expect(parseTemplateLiteral(tag(expression))).toEqual([
      { kind: 'expression', source: expression },
    ]);
  });

  it('leaves an unterminated ${ as literal text', () => {
    expect(parseTemplateLiteral('/pets/${petId')).toEqual([
      { kind: 'literal', source: '/pets/${petId' },
    ]);
  });

  it('leaves a trailing backslash alone', () => {
    expect(parseTemplateLiteral('/pets\\')).toEqual([
      { kind: 'literal', source: '/pets\\' },
    ]);
  });
});

describe('stringifyTemplateLiteral', () => {
  it('round-trips every parse losslessly', () => {
    for (const source of [
      '',
      '/pets/list',
      '/pets/' + tag('petId') + '/tags',
      tag('a') + tag('b'),
      '/foo' + escapedTag('petId'),
      '/foo\\\\' + tag('petId'),
      escapedTag('a') + tag('b'),
      tag(' {a: 1}.a ') + '!',
      tag("a ?? 'x/y'"),
      '/pets/${petId',
      '/tick\\`quote/' + tag('petId'),
    ]) {
      expect(stringifyTemplateLiteral(parseTemplateLiteral(source))).toBe(
        source,
      );
    }
  });
});

describe('mapTemplateExpressions', () => {
  it('rewrites interpolations only', () => {
    expect(
      mapTemplateExpressions(
        '/pets/' + tag('petId') + '/tags',
        (e) => `enc(${e})`,
      ),
    ).toBe('/pets/' + tag('enc(petId)') + '/tags');
  });

  it('leaves escaped static text untouched', () => {
    const source = '/foo' + escapedTag('petId');
    expect(mapTemplateExpressions(source, (e) => `enc(${e})`)).toBe(source);
  });

  it('rewrites an interpolation after an escaped backslash', () => {
    expect(
      mapTemplateExpressions('/foo\\\\' + tag('petId'), (e) => `enc(${e})`),
    ).toBe('/foo\\\\' + tag('enc(petId)'));
  });
});
