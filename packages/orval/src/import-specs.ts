import {
  dynamicImport,
  isObject,
  isString,
  logWarning,
  type NormalizedOptions,
  type OpenApiDocument,
  type OverrideInput,
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

import { importOpenApi } from './import-open-api';

interface ResolveSpecOptions {
  parserOptions?: {
    headers?: {
      domains: string[];
      headers: Record<string, string>;
    }[];
  };
  transformer?: OverrideInput['transformer'];
  workspace: string;
  unsafeDisableValidation?: boolean;
}

async function resolveSpec(
  input: string | Record<string, unknown>,
  {
    parserOptions,
    transformer,
    workspace,
    unsafeDisableValidation = false,
  }: ResolveSpecOptions,
): Promise<OpenApiDocument> {
  const dereferencedData = await bundleAndDereferenceExternalRefs(
    input,
    parserOptions,
  );

  // Apply user-provided transformer before validation so users can repair
  // malformed specs in-place. The transformer is typed against
  // `OpenApiDocument`, but we pass the raw bundled object — repairing a spec
  // necessarily means it does not yet conform to the type at call time.
  let transformedData = dereferencedData;
  if (transformer) {
    const applied = await applyInputTransformer(
      dereferencedData,
      transformer,
      workspace,
    );
    // A transformer may inject NEW external $refs that were absent from the
    // original spec (e.g. `refs.yaml#/...`), so the initial bundle never
    // resolved them. Re-run the bundle + dereference pipeline on its output so
    // those refs are resolved too (#3327). External refs resolve relative to
    // the original spec file, so reuse the string target as the bundle origin;
    // an object input has no file base and cannot introduce relative refs.
    transformedData = hasExternalRef(applied)
      ? await bundleAndDereferenceExternalRefs(
          applied,
          parserOptions,
          isString(input) ? input : undefined,
        )
      : applied;
  }

  if (unsafeDisableValidation) {
    logWarning(
      `🚨 OpenAPI spec validation is disabled.\n` +
        `  Code generation with invalid specs is not guaranteed to work and may break in minor updates.\n` +
        `  Bug reports with validation disabled will not be accepted.`,
    );
  } else {
    validateComponentKeys(transformedData);

    const { valid, errors } = await validateSpec(transformedData);
    if (!valid) {
      throw new Error(
        `OpenAPI spec validation failed:\n${JSON.stringify(errors, undefined, 2)}`,
      );
    }
  }

  const { specification } = upgrade(transformedData);

  // upgrade() returns @scalar/openapi-types/3.1 Document (openapi: string);
  // OpenApiDocument uses the legacy OpenAPIV3_1 namespace (openapi version literals).
  return specification as OpenApiDocument;
}

async function applyInputTransformer(
  data: Record<string, unknown>,
  transformer: NonNullable<OverrideInput['transformer']>,
  workspace: string,
): Promise<Record<string, unknown>> {
  const transformerFn = await dynamicImport(transformer, workspace);
  const result: unknown = await transformerFn(
    data as unknown as OpenApiDocument,
  );
  if (!isObject(result)) {
    const source = isString(transformer)
      ? transformer
      : transformerFn.name || '<inline function>';
    throw new Error(
      `input.override.transformer must return an OpenAPI document object; ` +
        `got ${result === undefined ? 'undefined' : typeof result} from ${source}. ` +
        `Ensure your transformer returns the (possibly modified) spec.`,
    );
  }
  return result;
}

/**
 * Bundle external references into the document and then resolve the `x-ext`
 * entries that `@scalar/json-magic` produces. Shared by the initial pass and
 * the post-transformer pass (#3327); `origin` lets the second pass resolve refs
 * relative to the original spec file when the input is an in-memory object.
 */
async function bundleAndDereferenceExternalRefs(
  input: string | Record<string, unknown>,
  parserOptions: ResolveSpecOptions['parserOptions'],
  origin?: string,
): Promise<Record<string, unknown>> {
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
    ...(origin ? { origin } : {}),
  });
  return dereferenceExternalRef(data as Record<string, unknown>);
}

/**
 * Report whether any `$ref` in the document points to an external document.
 * Per the JSON Reference rules a ref is external when it does not start with
 * `#` (an in-document pointer). Used to decide whether a transformer introduced
 * new external refs that need a second bundle pass (#3327) — when it did not,
 * the already-bundled spec is returned untouched.
 */
function hasExternalRef(obj: unknown): boolean {
  if (Array.isArray(obj)) {
    return obj.some((item) => hasExternalRef(item));
  }
  if (isObject(obj)) {
    if ('$ref' in obj && isString(obj.$ref) && !obj.$ref.startsWith('#')) {
      return true;
    }
    return Object.values(obj).some((value) => hasExternalRef(value));
  }
  return false;
}

export async function importSpecs(
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
): Promise<WriteSpecBuilder> {
  const { input, output } = options;

  const spec = await resolveSpec(input.target, {
    parserOptions: input.parserOptions,
    transformer: input.override.transformer,
    workspace,
    unsafeDisableValidation: input.unsafeDisableValidation,
  });

  return importOpenApi({
    spec,
    input,
    output,
    target: isString(input.target) ? input.target : workspace,
    workspace,
    projectName,
  });
}

const COMPONENT_KEY_PATTERN = /^[a-zA-Z0-9.\-_]+$/;

const COMPONENT_SECTIONS = [
  'schemas',
  'responses',
  'parameters',
  'examples',
  'requestBodies',
  'headers',
  'securitySchemes',
  'links',
  'callbacks',
  'pathItems', // OAS 3.1.0+
] as const;

/**
 * Validate that all component keys conform to the OAS regex: ^[a-zA-Z0-9.\-_]+$
 * @see https://spec.openapis.org/oas/v3.0.3.html#fixed-fields-5
 * @see https://spec.openapis.org/oas/v3.1.0#fixed-fields-5
 */
export function validateComponentKeys(data: Record<string, unknown>): void {
  const components = data.components;
  if (!isObject(components)) return;

  const invalidKeys: string[] = [];

  for (const section of COMPONENT_SECTIONS) {
    const sectionObj = components[section];
    if (!isObject(sectionObj)) continue;

    for (const key of Object.keys(sectionObj)) {
      if (!COMPONENT_KEY_PATTERN.test(key)) {
        invalidKeys.push(`components.${section}.${key}`);
      }
    }
  }

  if (invalidKeys.length > 0) {
    throw new Error(
      `Invalid component key${invalidKeys.length > 1 ? 's' : ''} found. ` +
        `OpenAPI component keys must match the pattern ${COMPONENT_KEY_PATTERN} ` +
        `(non-ASCII characters are not allowed per the spec).\n` +
        `  See: https://spec.openapis.org/oas/v3.0.3.html#components-object\n` +
        `  Invalid keys:\n` +
        invalidKeys.map((k) => `    - ${k}`).join('\n'),
    );
  }
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

  if (Object.keys(extensions).length === 0) return schemaNameMappings;

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
      const extComponents = extDoc.components as Record<string, unknown>;
      if (isObject(extComponents) && 'schemas' in extComponents) {
        const extSchemas = extComponents.schemas as Record<string, unknown>;
        for (const [schemaName, schema] of Object.entries(extSchemas)) {
          // Check if main schema is just an x-ext ref - if so, replace it without suffix
          const existingSchema = mainSchemas[schemaName];
          const isXExtRef =
            isObject(existingSchema) &&
            '$ref' in existingSchema &&
            isString(existingSchema.$ref) &&
            existingSchema.$ref.startsWith('#/x-ext/');

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
    const rec = obj;
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
    const record = obj;

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
 * Decode a single JSON Pointer reference token taken from an x-ext `$ref`.
 *
 * The token carries two layers of encoding: it sits in a URI fragment, so it
 * may be percent-encoded (e.g. `%7B` for `{` in templated paths), and it is a
 * JSON Pointer token, so `~1`/`~0` stand for `/`/`~` (RFC 6901). Percent-
 * encoding is the outer layer and is removed first; a malformed sequence is
 * left as-is rather than throwing. Without this, tokens such as `~1pets`
 * never match the real `/pets` key and the external `$ref` fails to resolve.
 */
function decodeRefToken(token: string): string {
  let decoded = token;
  try {
    decoded = decodeURIComponent(token);
  } catch {
    // Malformed percent-encoding — fall back to the raw token.
  }
  return decoded.replaceAll('~1', '/').replaceAll('~0', '~');
}

/**
 * Replace x-ext refs with standard component refs, or inline the content.
 * `inliningRefs` tracks the inline chain to break cycles in recursive
 * external schemas that aren't under `components.schemas` (#1642).
 */
function replaceXExtRefs(
  obj: unknown,
  extensions: Record<string, unknown>,
  schemaNameMappings: Record<string, Record<string, string>>,
  inliningRefs = new Set<string>(),
): unknown {
  if (isNullish(obj)) return obj;

  if (Array.isArray(obj)) {
    return obj.map((element) =>
      replaceXExtRefs(element, extensions, schemaNameMappings, inliningRefs),
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

          // Otherwise inline the content; break cycles with `{}`.
          if (inliningRefs.has(refValue)) {
            logWarning(
              `Detected a circular external $ref while inlining "${refValue}". ` +
                `Replacing with an empty schema to avoid infinite recursion. ` +
                `Move the schema under "components.schemas" in its source file ` +
                `or pre-bundle the spec to keep the recursion intact.`,
            );
            return {};
          }

          const extDoc = extensions[extKey];
          let refObj: unknown = extDoc;
          for (const rawPart of parts) {
            const p = decodeRefToken(rawPart);
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
            const nextInlining = new Set(inliningRefs);
            nextInlining.add(refValue);
            return replaceXExtRefs(
              cleaned,
              extensions,
              schemaNameMappings,
              nextInlining,
            );
          }
        }
      }
    }

    // Recursively process all properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      result[key] = replaceXExtRefs(
        value,
        extensions,
        schemaNameMappings,
        inliningRefs,
      );
    }
    return result;
  }

  return obj;
}
