/**
 * A lexer for the *source text* of a generated JavaScript template literal
 * (everything that goes between the backticks).
 *
 * Orval emits routes and URLs as template-literal source, mixing escaped
 * static text from the OpenAPI specification with `${...}` interpolations it
 * generates itself. Later passes need to rewrite only the interpolations
 * (URL-encoding a path parameter, rewriting it to an Angular signal call,
 * splitting a route into query-key segments) while leaving static text alone.
 *
 * Doing that with a regular expression is unsound: `\${foo}` is escaped static
 * text, `${foo}` is an interpolation, and `\\${foo}` is an escaped backslash
 * followed by a real interpolation. Character-adjacency lookbehinds such as
 * `(?<!\\)` get all three wrong for at least one input, and each new escaping
 * rule adds another way to get them wrong (#3703).
 *
 * This module replaces those heuristics with an actual scanner: it walks the
 * source once, consuming backslash escapes as indivisible pairs and matching
 * `${` to its closing `}` by brace depth (skipping over string literals inside
 * the expression). The result is an exact token list, so callers never have to
 * infer intent from neighbouring characters.
 */

export type TemplateLiteralPart =
  /** Static text, still in its escaped template-literal source form. */
  | { kind: 'literal'; source: string }
  /** The expression inside a `${...}` block, without the delimiters. */
  | { kind: 'expression'; source: string };

/**
 * Scans the expression that starts at `source[start]` (the `$` of a `${`) and
 * returns the index just past its closing `}`, or `-1` when the block is
 * unterminated. Nested braces and quoted strings inside the expression are
 * tracked so `${a ? '{' : '}'}` and `${ {a: 1}.a }` terminate correctly.
 */
function findExpressionEnd(source: string, start: number): number {
  let depth = 0;
  let index = start + 1; // at the `{`

  while (index < source.length) {
    const char = source[index];

    if (char === '\\') {
      index += 2;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      index++;
      while (index < source.length && source[index] !== quote) {
        index += source[index] === '\\' ? 2 : 1;
      }
      // Skip the closing quote; if it is missing we fall out of the outer loop.
      index++;
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) return index + 1;
    }

    index++;
  }

  return -1;
}

/**
 * Splits template-literal source into static and interpolated parts.
 *
 * Escapes are preserved verbatim in `literal` parts (the output is meant to be
 * spliced straight back into generated source), and an unterminated or
 * backslash-escaped `${` stays literal rather than being guessed at.
 */
export function parseTemplateLiteral(source: string): TemplateLiteralPart[] {
  const parts: TemplateLiteralPart[] = [];
  let literal = '';
  let index = 0;

  const flushLiteral = () => {
    if (literal) {
      parts.push({ kind: 'literal', source: literal });
      literal = '';
    }
  };

  while (index < source.length) {
    const char = source[index];

    // A backslash escape is one indivisible unit: `\${x}` is static text and
    // `\\${x}` is an escaped backslash followed by a real interpolation.
    if (char === '\\') {
      literal += source.slice(index, index + 2);
      index += 2;
      continue;
    }

    if (char === '$' && source[index + 1] === '{') {
      const end = findExpressionEnd(source, index);
      if (end !== -1) {
        flushLiteral();
        parts.push({
          kind: 'expression',
          source: source.slice(index + 2, end - 1),
        });
        index = end;
        continue;
      }
    }

    literal += char;
    index++;
  }

  flushLiteral();
  return parts;
}

/** Re-assembles parts produced by {@link parseTemplateLiteral} losslessly. */
export function stringifyTemplateLiteral(
  parts: readonly TemplateLiteralPart[],
): string {
  return parts
    .map((part) =>
      part.kind === 'literal' ? part.source : `\${${part.source}}`,
    )
    .join('');
}

/**
 * Rewrites every `${...}` expression in template-literal source, leaving
 * static text (including escaped `\${...}` sequences) untouched.
 *
 * Returning the expression unchanged is a no-op, so this is the safe
 * replacement for `route.replaceAll(TEMPLATE_TAG_REGEX, ...)`.
 */
export function mapTemplateExpressions(
  source: string,
  mapper: (expression: string) => string,
): string {
  return stringifyTemplateLiteral(
    parseTemplateLiteral(source).map((part) =>
      part.kind === 'expression'
        ? { kind: 'expression', source: mapper(part.source) }
        : part,
    ),
  );
}
