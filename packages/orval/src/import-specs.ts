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

import { importOpenApi } from './import-open-api';

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
    treeShake: true,
  });
  const dereferencedData = dereferenceExternalRef(data);
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
 * This function dereferences those x-ext $ref's.
 */
export function dereferenceExternalRef(data: object): object {
  const extensions = data['x-ext'] ?? {};

  const UNWANTED_KEYS = new Set(['$schema', '$id']);

  function scrub(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map((x) => scrub(x));
    if (isObject(obj)) {
      const rec = obj as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (UNWANTED_KEYS.has(k)) continue;
        out[k] = scrub(v);
      }
      return out;
    }
    return obj;
  }

  function replaceRefs(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((element) => replaceRefs(element));
    }

    if (isObject(obj)) {
      const record = obj as Record<string, unknown>;

      // Check if this object is a $ref to x-ext
      if ('$ref' in record && isString(record.$ref)) {
        const refValue = record.$ref;
        if (refValue.startsWith('#/x-ext/')) {
          const pathStr = refValue.replace('#/x-ext/', '');
          const parts = pathStr.split('/');
          const extKey = parts.shift();
          if (extKey) {
            let refObj: unknown = extensions[extKey];
            // Traverse remaining path parts inside the extension object
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
              // Scrub unwanted keys from the extension before inlining
              const cleaned = scrub(refObj);
              // Replace the $ref with the dereferenced (and scrubbed) object
              return replaceRefs(cleaned);
            }
          }
        }
      }

      // Recursively process all properties
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        result[key] = replaceRefs(value);
      }
      return result;
    }

    return obj;
  }

  // Create a new object with dereferenced properties (excluding x-ext)
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'x-ext') {
      result[key] = replaceRefs(value);
    }
  }

  return result;
}
