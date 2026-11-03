import type { ContextSpec, OpenApiSchemaObject } from '../../types';
import { resolveRef } from '../ref';

/**
 * Resolves a `$ref` to its target schema. Returns `undefined` instead of
 * throwing when the ref cannot be found (e.g. external refs not yet bundled).
 */
export function tryResolveRefSchema(
  $ref: string,
  context: ContextSpec,
  onError?: (message: string) => void,
): OpenApiSchemaObject | undefined {
  try {
    return resolveRef<OpenApiSchemaObject>({ $ref }, context).schema;
  } catch (error) {
    onError?.(
      `Failed to resolve $ref "${$ref}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }
}
