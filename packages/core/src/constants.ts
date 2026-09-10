import { Verbs } from './types';

export const generalJSTypes = [
  'number',
  'string',
  'null',
  'unknown',
  'undefined',
  'object',
  'blob',
];

export const generalJSTypesWithArray = generalJSTypes.flatMap((type) => [
  type,
  `Array<${type}>`,
  `${type}[]`,
]);

export const VERBS_WITH_BODY = [
  Verbs.POST,
  Verbs.PUT,
  Verbs.PATCH,
  Verbs.DELETE,
  Verbs.QUERY,
];

export const URL_REGEX =
  /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=.]+$/;

/**
 * Matches a `${thing}` tag in template-literal source.
 *
 * @deprecated Unsound on generated routes: it cannot tell an interpolation
 * from escaped static text, so it rewrites the `\${x}` produced for a spec
 * path like `/foo${x}` and stops at the first `}` inside an expression.
 * Use {@link parseTemplateLiteral} / {@link mapTemplateExpressions} instead
 * (#3703). Kept for backwards compatibility with custom client builders.
 */
export const TEMPLATE_TAG_REGEX = /\${(.+?)}/g;
