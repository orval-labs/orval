import {
  type ContextSpec,
  dereferenceWithPolicy,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  type RefPolicy,
} from '@orval/core';

import { reporter } from './logger';
import { isReusableSchemasEnabled } from './refs';

export interface DereferenceOptions {
  // Where the schema is used, named in the error of an expansion that is too
  // large.
  label?: string;
  // The most schema nodes the inlining may produce.
  limit?: number;
}

/**
 * Inlines every `$ref` the policy does not keep. A circular `$ref` becomes an
 * empty schema. An expansion past the node limit fails instead of exhausting
 * the heap.
 *
 * The result may share nested objects between calls, so treat it as read-only.
 */
export const dereference = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  policy?: RefPolicy,
  options: DereferenceOptions = {},
): OpenApiNonBooleanSchemaObject =>
  dereferenceWithPolicy(schema, context, policy, {
    ...options,
    suggestReusable: !isReusableSchemasEnabled(context),
    reporter,
  });
