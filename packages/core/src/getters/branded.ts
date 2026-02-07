import type {
  BrandedTypeDefinition,
  BrandedTypeRegistry,
  OpenApiSchemaObject,
} from '../types';
import { pascal, sanitize } from '../utils';

// Types that can be branded (primitives only)
// Includes 'integer' for OpenAPI schema compatibility (converted to 'number' in TypeScript)
export const BRANDABLE_TYPES = [
  'string',
  'number',
  'boolean',
  'integer',
] as const;

export function extractBrandName(
  schema: OpenApiSchemaObject,
): string | undefined {
  const xBrand = schema['x-brand'];

  if (!xBrand || typeof xBrand !== 'string') {
    return undefined;
  }

  const pascalName = pascal(xBrand);

  return sanitize(pascalName, {
    es5keyword: true,
    es5IdentifierName: true,
  });
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

export function createBrandedTypeRegistry(): BrandedTypeRegistry {
  return new Map<string, BrandedTypeDefinition>();
}

/**
 * Register a branded type in the registry.
 * Throws an error if:
 * - The brand name is already registered with a different base type
 * - The brand name conflicts with an existing schema name
 */
export function registerBrandedType(
  registry: BrandedTypeRegistry,
  brandName: string,
  baseType: string,
  schemaNames?: Set<string>,
): void {
  const existing = registry.get(brandName);

  if (existing && existing.baseType !== baseType) {
    throw new Error(
      `Branded type conflict: "${brandName}" is used with different base types: ` +
        `"${existing.baseType}" and "${baseType}". ` +
        `Each brand name must map to exactly one base type.`,
    );
  }

  if (schemaNames?.has(brandName)) {
    throw new Error(
      `Branded type name collision: "${brandName}" conflicts with an existing schema name. ` +
        `Please rename either the schema or the x-brand value.`,
    );
  }

  if (!existing) {
    registry.set(brandName, {
      name: brandName,
      baseType,
      brand: brandName,
    });
  }
}
