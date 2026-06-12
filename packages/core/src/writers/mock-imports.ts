import type { GeneratorImport } from '../types';
import { pascal } from '../utils';

export interface KnownSchemaFactoryImportSets {
  factoryNames: ReadonlySet<string>;
  typeNames: ReadonlySet<string>;
}

/** Maps `components/schemas` names to consolidated index.faker import symbols. */
export function buildKnownSchemaFactoryImportSets(
  schemaNames: readonly string[],
): KnownSchemaFactoryImportSets {
  const factoryNames = new Set<string>();
  const typeNames = new Set<string>();

  for (const name of schemaNames) {
    const typeName = pascal(name);
    factoryNames.add(`get${typeName}Mock`);
    typeNames.add(`${typeName}Mock`);
  }

  return { factoryNames, typeNames };
}

/**
 * Recover schema-factory imports referenced in generated mock bodies but
 * missing from the collected import list (e.g. after shared-array import
 * aggregation on large specs). Scans for `get<Schema>Mock()` calls and
 * `as <Schema>Mock` casts emitted by strict schema delegation (#3590).
 *
 * When `knownSets` is provided, only symbols that exist in the consolidated
 * schemas faker file are recovered — this avoids importing one-off split
 * response helper factories that live in the tag file itself.
 */
export function collectSchemaFactoryImportsFromImplementation(
  implementation: string,
  knownSets?: KnownSchemaFactoryImportSets,
): GeneratorImport[] {
  const imports: GeneratorImport[] = [];
  const seen = new Set<string>();

  for (const match of implementation.matchAll(/\b(get[A-Za-z0-9]+Mock)\(\)/g)) {
    const factoryName = match[1];
    if (knownSets && !knownSets.factoryNames.has(factoryName)) {
      continue;
    }
    const key = `value::${factoryName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    imports.push({
      name: factoryName,
      values: true,
      schemaFactory: true,
    });
  }

  for (const match of implementation.matchAll(/\bas ([A-Za-z0-9]+Mock)\b/g)) {
    const typeName = match[1];
    if (knownSets && !knownSets.typeNames.has(typeName)) {
      continue;
    }
    const key = `type::${typeName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    imports.push({
      name: typeName,
      values: false,
      schemaFactory: true,
    });
  }

  return imports;
}

export function mergeGeneratorImports(
  ...groups: readonly (readonly GeneratorImport[])[]
): GeneratorImport[] {
  const merged = new Map<string, GeneratorImport>();

  for (const group of groups) {
    for (const imp of group) {
      const key = `${imp.name}::${imp.alias ?? ''}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, imp);
        continue;
      }
      if (!existing.values && imp.values) {
        merged.set(key, imp);
      }
    }
  }

  return [...merged.values()];
}

/** Recover missing index.faker imports when `schemas: true` is enabled. */
export function collectRecoveredSchemaFactoryImports(
  implementation: string,
  componentSchemaNames: readonly string[],
): GeneratorImport[] {
  return collectSchemaFactoryImportsFromImplementation(
    implementation,
    buildKnownSchemaFactoryImportSets(componentSchemaNames),
  );
}
