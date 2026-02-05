import type { BrandedTypeRegistry, GeneratorSchema } from '../types';

/**
 * Generate type definitions for branded types collected during schema resolution.
 * Each branded type becomes its own GeneratorSchema for proper import handling.
 */
export function generateBrandedDefinition(
  registry: BrandedTypeRegistry | undefined,
): GeneratorSchema[] {
  if (!registry || registry.size === 0) {
    return [];
  }

  const schemas: GeneratorSchema[] = [];

  for (const [name, definition] of registry) {
    schemas.push({
      name,
      model: `export type ${name} = Branded<${definition.baseType}, "${definition.brand}">;\n`,
      imports: [],
      dependencies: [],
    });
  }

  return schemas;
}
