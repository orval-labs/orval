import {
  camelPathParamName,
  jsStringLiteralEscape,
  toColonRoutePath,
} from '@orval/core';

// MSW route params are camelized to match the generated mock function args.
//
// The result is a *source fragment*, not a plain value: the `\\:` below is two
// literal backslashes so the emitted single-quoted literal compiles to MSW's
// `\:` escape for a colon that is not a param. Because of that, the spec text
// has to be escaped for the literal here — before the colon escape is spliced
// in — rather than at the emit site, where escaping again would double these
// intentional backslashes.
export const getRouteMSW = (route: string, baseUrl = '*') =>
  `${jsStringLiteralEscape(baseUrl)}${toColonRoutePath(
    jsStringLiteralEscape(route).replaceAll(':', String.raw`\\:`),
    camelPathParamName,
  )}`;
