import type {
  ContextSpec,
  OpenApiNonBooleanSchemaObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../../types';
import { expandSchema } from './expand';
import type { DereferenceOptions } from './types';

const DEFAULT_OPTIONS: DereferenceOptions = {};

/**
 * Recursively inlines every `$ref` in a schema tree. Cycles and unresolved refs
 * become `{}`. Expansions are cached per document and options; nested objects
 * may be shared between results, so treat them as read-only.
 */
export function dereference(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  options: DereferenceOptions = DEFAULT_OPTIONS,
): OpenApiNonBooleanSchemaObject {
  return expandSchema(schema, context, options).value;
}
