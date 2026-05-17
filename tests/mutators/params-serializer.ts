import type { HttpParams } from '@angular/common/http';

type AngularHttpParams =
  | HttpParams
  | Record<
      string,
      string | number | boolean | readonly (string | number | boolean)[]
    >;

/**
 * Custom query-parameter serializer for issue #3326 integration coverage.
 *
 * Because a `paramsSerializer` is configured, the built-in Angular
 * `filterParams` forwards schema-declared object params untouched (the
 * passthrough set) instead of dropping them. This serializer then receives
 * the raw object and flattens it into bracketed keys so the value actually
 * reaches the wire. See #3326.
 */
export const customParamsSerializer = (
  params: Record<string, unknown>,
): AngularHttpParams => {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [innerKey, innerValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (innerValue !== undefined && innerValue !== null) {
          result[`${key}[${innerKey}]`] = innerValue as
            | string
            | number
            | boolean;
        }
      }
      continue;
    }
    result[key] = value as string | number | boolean;
  }
  return result;
};
