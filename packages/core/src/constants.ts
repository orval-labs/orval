import type { OpenAPIV3_2 } from '@scalar/openapi-types';

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

/**
 * Every Path Item Object key that holds an Operation Object, up to OpenAPI 3.2
 * (`query`). A superset of {@link Verbs}: `trace` operations are valid in a
 * spec but orval does not generate clients for them. Use this when walking a
 * document, and `Verbs` when deciding what to generate.
 */
export const OPERATION_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
  'query',
] as const satisfies readonly OpenAPIV3_2.HttpMethods[];

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
