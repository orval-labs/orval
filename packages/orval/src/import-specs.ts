import {
  isObject,
  isString,
  type NormalizedOptions,
  type OpenApiDocument,
  type WriteSpecBuilder,
} from '@orval/core';
import { bundle } from '@scalar/json-magic/bundle';
import {
  fetchUrls,
  parseJson,
  parseYaml,
  readFiles,
} from '@scalar/json-magic/bundle/plugins/node';
import { upgrade, validate as validateSpec } from '@scalar/openapi-parser';
import { isNullish } from 'remeda';

import { importOpenApi } from './import-open-api.ts';

async function resolveSpec(
  input: string | Record<string, unknown>,
  parserOptions?: {
    headers?: {
      domains: string[];
      headers: Record<string, string>;
    }[];
  },
): Promise<OpenApiDocument> {
  const data = await bundle(input, {
    plugins: [
      readFiles(),
      fetchUrls({
        headers: parserOptions?.headers,
      }),
      parseJson(),
      parseYaml(),
    ],
    treeShake: false,
  });
  const dereferencedData = dereferenceExternalRef(
    data as Record<string, unknown>,
  );
  const { valid, errors } = await validateSpec(dereferencedData);
  if (!valid) {
    throw new Error('Validation failed', { cause: errors });
  }

  const { specification } = upgrade(dereferencedData);

  return specification;
}

export async function importSpecs(
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
): Promise<WriteSpecBuilder> {
  const { input, output } = options;

  const spec = await resolveSpec(input.target, input.parserOptions);

  return importOpenApi({
    spec,
    input,
    output,
    target: input.target,
    workspace,
    projectName,
  });
}

/**
 * The plugins from `@scalar/json-magic` does not dereference $ref.
 * Instead it fetches them and puts them under x-ext, and changes the $ref to point to #x-ext/<name>.
 * This function:
 * 1. Merges external schemas into main spec's components.schemas (with collision handling)
 * 2. Replaces x-ext refs with standard component refs or inlined content
 */
export function dereferenceExternalRef(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const extensions = (data['x-ext'] ?? {}) as Record<string, unknown>;

  // Step 1: Merge external schemas into main spec with collision handling
  const schemaNameMappings = mergeExternalSchemas(data, extensions);

  // Step 2: Replace all x-ext refs throughout the document
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'x-ext') {
      result[key] = replaceXExtRefs(value, extensions, schemaNameMappings);
    }
  }

  return result;
}

/**
 * Merge external document schemas into main spec's components.schemas
 * Returns mapping of original schema names to final names (with suffixes for collisions)
 */
function mergeExternalSchemas(
  data: Record<string, unknown>,
  extensions: Record<string, unknown>,
): Record<string, Record<string, string>> {
  const schemaNameMappings: Record<string, Record<string, string>> = {};

  data.components ??= {};
  const mainComponents = data.components as Record<string, unknown>;
  mainComponents.schemas ??= {};
  const mainSchemas = mainComponents.schemas as Record<string, unknown>;

  // Merge schemas from each external doc
  // Collision handling:
  // - If schema already exists in main spec, add x-ext key as suffix (e.g., User -> User_external1)
  // - x-ext refs in main spec get replaced by actual schema from external doc
  for (const [extKey, extDoc] of Object.entries(extensions)) {
    schemaNameMappings[extKey] = {};

    if (isObject(extDoc) && 'components' in extDoc) {
      const extComponents = (extDoc as Record<string, unknown>)
        .components as Record<string, unknown>;
      if (isObject(extComponents) && 'schemas' in extComponents) {
        const extSchemas = extComponents.schemas as Record<string, unknown>;
        for (const [schemaName, schema] of Object.entries(extSchemas)) {
          // Check if main schema is just an x-ext ref - if so, replace it without suffix
          const existingSchema = mainSchemas[schemaName];
          const isXExtRef =
            isObject(existingSchema) &&
            '$ref' in existingSchema &&
            isString((existingSchema as Record<string, unknown>).$ref) &&
            (
              (existingSchema as Record<string, unknown>).$ref as string
            ).startsWith('#/x-ext/');

          let finalSchemaName = schemaName;

          if (schemaName in mainSchemas && !isXExtRef) {
            // Collision: add suffix to external schema
            const suffix = extKey.replaceAll(/[^a-zA-Z0-9]/g, '_');
            finalSchemaName = `${schemaName}_${suffix}`;
            schemaNameMappings[extKey][schemaName] = finalSchemaName;
          } else {
            // No collision or replacing x-ext ref
            schemaNameMappings[extKey][schemaName] = schemaName;
          }

          mainSchemas[finalSchemaName] = scrubUnwantedKeys(schema);
        }
      }
    }
  }

  // Apply internal ref updates to all schemas from external docs
  for (const [extKey, mapping] of Object.entries(schemaNameMappings)) {
    for (const [, finalName] of Object.entries(mapping)) {
      const schema = mainSchemas[finalName];
      if (schema) {
        mainSchemas[finalName] = updateInternalRefs(
          schema,
          extKey,
          schemaNameMappings,
        ) as Record<string, unknown>;
      }
    }
  }

  return schemaNameMappings;
}

/**
 * Remove unwanted keys like $schema and $id from objects
 */
function scrubUnwantedKeys(obj: unknown): unknown {
  const UNWANTED_KEYS = new Set(['$schema', '$id']);

  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((x) => scrubUnwantedKeys(x));
  if (isObject(obj)) {
    const rec = obj as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (UNWANTED_KEYS.has(k)) continue;
      out[k] = scrubUnwantedKeys(v);
    }
    return out;
  }
  return obj;
}

/**
 * Update internal refs within an external schema to use suffixed names
 */
function updateInternalRefs(
  obj: unknown,
  extKey: string,
  schemaNameMappings: Record<string, Record<string, string>>,
): unknown {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map((element) =>
      updateInternalRefs(element, extKey, schemaNameMappings),
    );
  }

  if (isObject(obj)) {
    const record = obj as Record<string, unknown>;

    // Check if this is a $ref to #/components/schemas/...
    if ('$ref' in record && isString(record.$ref)) {
      const refValue = record.$ref;
      if (refValue.startsWith('#/components/schemas/')) {
        const schemaName = refValue.replace('#/components/schemas/', '');
        // If this schema was mapped to a suffixed name, update the ref
        const mappedName = schemaNameMappings[extKey][schemaName];
        if (mappedName) {
          return {
            $ref: `#/components/schemas/${mappedName}`,
          };
        }
      }
    }

    // Recursively process all properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = updateInternalRefs(value, extKey, schemaNameMappings);
    }
    return result;
  }

  return obj;
}

/**
 * Replace x-ext refs with either standard component refs or inlined content
 */
function replaceXExtRefs(
  obj: unknown,
  extensions: Record<string, unknown>,
  schemaNameMappings: Record<string, Record<string, string>>,
): unknown {
  if (isNullish(obj)) return obj;

  if (Array.isArray(obj)) {
    return obj.map((element) =>
      replaceXExtRefs(element, extensions, schemaNameMappings),
    );
  }

  if (isObject(obj)) {
    const record = obj;

    // Check if this object is a $ref to x-ext
    if ('$ref' in record && isString(record.$ref)) {
      const refValue = record.$ref;
      if (refValue.startsWith('#/x-ext/')) {
        // Parse the x-ext ref
        const pathStr = refValue.replace('#/x-ext/', '');
        const parts = pathStr.split('/');
        const extKey = parts.shift();

        if (extKey) {
          // Check if this is a ref to components/schemas - if so, replace with standard ref
          if (
            parts.length >= 3 &&
            parts[0] === 'components' &&
            parts[1] === 'schemas'
          ) {
            const schemaName = parts.slice(2).join('/');
            // Use the mapped name (which may include suffix for collisions)
            const finalName =
              schemaNameMappings[extKey][schemaName] || schemaName;
            return { $ref: `#/components/schemas/${finalName}` };
          }

          // Otherwise, inline the referenced content
          const extDoc = extensions[extKey];
          let refObj: unknown = extDoc;
          for (const p of parts) {
            if (
              refObj &&
              (isObject(refObj) || Array.isArray(refObj)) &&
              p in (refObj as Record<string, unknown>)
            ) {
              refObj = (refObj as Record<string, unknown>)[p];
            } else {
              refObj = undefined;
              break;
            }
          }

          if (refObj) {
            const cleaned = scrubUnwantedKeys(refObj);
            return replaceXExtRefs(cleaned, extensions, schemaNameMappings);
          }
        }
      }
    }

    // Recursively process all properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = replaceXExtRefs(value, extensions, schemaNameMappings);
    }
    return result;
  }

  return obj;
}
