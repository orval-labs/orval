import {
  type GeneratorImport,
  type GeneratorOperation,
  type GeneratorSchema,
  DefaultTag,
} from '../types';
import { kebab } from '../utils';

export const SHARED_DIR = '.';

export function buildSchemaTagMap(
  operations: ReadonlyArray<Pick<GeneratorOperation, 'imports' | 'tags'>>,
  schemas: GeneratorSchema[],
): Map<string, string> {
  const schemaNames = new Set(schemas.map((s) => s.name));

  const schemaToTags = new Map<string, Set<string>>();

  for (const schema of schemas) {
    if (!schemaToTags.has(schema.name)) {
      schemaToTags.set(schema.name, new Set());
    }
  }

  for (const operation of operations) {
    const tag = kebab(operation.tags[0] ?? DefaultTag);
    for (const imp of operation.imports) {
      if (!imp.importPath && schemaNames.has(imp.name)) {
        addTag(schemaToTags, imp.name, tag);
      }
    }
  }

  const schemaByName = new Map(schemas.map((s) => [s.name, s]));
  propagateTransitiveTags(schemaToTags, schemaByName);

  const result = new Map<string, string>();
  for (const [name, tags] of schemaToTags) {
    if (tags.size === 0 || tags.size > 1) {
      result.set(name, SHARED_DIR);
    } else {
      result.set(name, [...tags][0]);
    }
  }

  return result;
}

function addTag(
  schemaToTags: Map<string, Set<string>>,
  schemaName: string,
  tag: string,
) {
  if (!schemaToTags.has(schemaName)) {
    schemaToTags.set(schemaName, new Set());
  }
  schemaToTags.get(schemaName)!.add(tag);
}

function propagateTransitiveTags(
  schemaToTags: Map<string, Set<string>>,
  schemaByName: Map<string, GeneratorSchema>,
) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, tags] of schemaToTags) {
      const schema = schemaByName.get(name);
      if (!schema) continue;

      for (const imp of schema.imports) {
        if (!isSchemaImport(imp)) continue;
        if (!schemaByName.has(imp.name)) continue;

        const targetTags = schemaToTags.get(imp.name);
        if (!targetTags) continue;

        for (const tag of tags) {
          if (!targetTags.has(tag)) {
            targetTags.add(tag);
            changed = true;
          }
        }
      }
    }
  }
}

function isSchemaImport(imp: GeneratorImport): boolean {
  return !imp.importPath;
}
