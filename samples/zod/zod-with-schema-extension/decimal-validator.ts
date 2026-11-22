/**
 * Validates the spelling of a decimal string, including trailing zeroes in
 * the precision count (e.g. "1.200" has three fractional digits).
 *
 * This helper is imported by both orval.config.ts (for TypeScript checking)
 * and the generated Zod module (via bindings.$imports).
 */
export const isDecimalWithPrecision = (
  value: string,
  maxPrecision: number,
): boolean => {
  if (!/^[+-]?(?:\d+(\.\d*)?|\.\d+)$/.test(value)) {
    return false;
  }

  const precision = value.split('.')[1]?.length ?? 0;
  return precision === 0 || precision <= maxPrecision;
};
