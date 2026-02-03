import type { BrandInfo, OpenApiSchemaObject, ScalarValue } from '../types';
import { sanitize } from '../utils';

// Types that can be branded (primitives only)
// Includes 'integer' for OpenAPI schema compatibility (converted to 'number' in TypeScript)
export const BRANDABLE_TYPES = [
  'string',
  'number',
  'boolean',
  'integer',
] as const;

/**
 * Extract and validate brand info from schema
 */
export function extractBrandInfo(
  schema: OpenApiSchemaObject,
): BrandInfo | null {
  const xBrand = schema['x-brand'];
  if (!xBrand || typeof xBrand !== 'string') {
    return null;
  }

  const sanitizedBrand = sanitize(xBrand, {
    es5keyword: true,
    es5IdentifierName: true,
  });

  if (!sanitizedBrand) {
    return null;
  }

  return {
    brandName: sanitizedBrand,
    baseType: '',
  };
}

/**
 * Check if a scalar value type can be branded
 */
export function isBrandableType(scalarValue: ScalarValue): boolean {
  return BRANDABLE_TYPES.includes(
    scalarValue.type as (typeof BRANDABLE_TYPES)[number],
  );
}

/**
 * Check if a schema type can be branded
 */
export function isBrandableSchemaType(schema: OpenApiSchemaObject): boolean {
  const schemaType = schema.type;
  if (!schemaType || Array.isArray(schemaType)) {
    return false;
  }
  return BRANDABLE_TYPES.includes(
    schemaType as (typeof BRANDABLE_TYPES)[number],
  );
}
