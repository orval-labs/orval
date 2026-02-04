import type {
  BrandedTypeDefinition,
  BrandedTypeRegistry,
  BrandInfo,
  ContextSpec,
  OpenApiSchemaObject,
  ScalarValue,
} from '../types';
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
): BrandInfo | undefined {
  const xBrand = schema['x-brand'];
  if (!xBrand || typeof xBrand !== 'string') {
    return undefined;
  }

  const sanitizedBrand = sanitize(xBrand, {
    es5keyword: true,
    es5IdentifierName: true,
  });

  if (!sanitizedBrand) {
    return undefined;
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

  // Check for base type conflict
  if (existing && existing.baseType !== baseType) {
    throw new Error(
      `Branded type conflict: "${brandName}" is used with different base types: ` +
        `"${existing.baseType}" and "${baseType}". ` +
        `Each brand name must map to exactly one base type.`,
    );
  }

  // Check for schema name collision
  if (schemaNames?.has(brandName)) {
    throw new Error(
      `Branded type name collision: "${brandName}" conflicts with an existing schema name. ` +
        `Please rename either the schema or the x-brand value.`,
    );
  }

  // Register if not already present
  if (!existing) {
    registry.set(brandName, {
      name: brandName,
      baseType,
      brand: brandName,
    });
  }
}

/**
 * Generate type alias definitions for all registered branded types
 */
export function generateBrandedTypeDefinitions(
  registry: BrandedTypeRegistry,
): string {
  if (registry.size === 0) {
    return '';
  }

  const definitions = [...registry.values()]
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map(
      ({ name, baseType, brand }) =>
        `export type ${name} = Branded<${baseType}, "${brand}">;`,
    )
    .join('\n');

  return definitions;
}

/**
 * Get the branded type helper definition
 */
export function getBrandedHelperType(): string {
  return 'type Branded<BaseType, Brand> = BaseType & { readonly __brand: Brand };';
}

/**
 * Check if context has branded types feature enabled
 */
export function isBrandedTypesEnabled(context: ContextSpec): boolean {
  return context.output.override.generateBrandedTypes === true;
}
