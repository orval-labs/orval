import type {
  ContextSpec,
  OpenApiNonBooleanSchemaObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../../types';
import { expandSchema } from './expand';
import type { DereferenceOptions, VisitListener } from './types';

const DEFAULT_OPTIONS: DereferenceOptions = {};

/**
 * Recursively inlines every `$ref` in a schema tree. Cycles and unresolved refs
 * become `{}`. Expansions are cached per document and options; nested objects
 * may be shared between results, so treat them as read-only.
 *
 * `onVisit` runs for each schema reached. A cache hit reports its own node
 * but not the nodes inside it. It is a separate argument because the options
 * key the cache.
 */
export function dereference(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  options: DereferenceOptions = DEFAULT_OPTIONS,
  onVisit?: VisitListener,
): OpenApiNonBooleanSchemaObject {
  return expandSchema(schema, context, options, undefined, onVisit).value;
}
