/**
 * Custom query-parameter filter for issue #3326 integration coverage.
 *
 * Replaces the built-in Angular `filterParams` helper. Flattens object-valued
 * params into bracketed keys (`filters[color]=red`) and strips nullish values,
 * while leaving primitives untouched.
 */
export const flattenParamsFilter = (
  params: Record<string, unknown>,
): Record<string, string | number | boolean> => {
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
