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
 * Recursively inlines every `$ref` in a schema tree. A `$ref` already being
 * expanded (a cycle) becomes an empty schema, and a `$ref` that cannot be
 * resolved does too.
 *
 * A component referenced from many places is expanded once per document and
 * options object; callers receive a fresh top-level object each time. Nested
 * objects may be shared between results, so treat them as read-only.
 */
export function dereference(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  options: DereferenceOptions = DEFAULT_OPTIONS,
): OpenApiNonBooleanSchemaObject {
  return expandSchema(schema, context, options).value;
}
