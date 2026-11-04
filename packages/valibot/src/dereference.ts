import {
  type ContextSpec,
  type DereferenceOptions,
  dereference as coreDereference,
  isObject,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
} from '@orval/core';

import { logger, warnOnce } from './logger';

const dereferenceOptions: DereferenceOptions = {
  keepBooleanProperties: true,
  keepSiblingsOfBooleanTarget: true,
  isVerbatimKey: (key) => key.startsWith('x-'),
  onCircularRef: (ref) =>
    warnOnce(`Circular $ref "${ref}" is validated as unknown.`),
  onUnresolvedRef: (ref) =>
    warnOnce(`Unresolvable $ref "${ref}" is validated as unknown.`),
  onResolveError: (message) => logger.verbose(message),
};

/**
 * Inlines every `$ref`. A circular `$ref` becomes an empty schema, which is
 * validated as `unknown`.
 *
 * The result may share nested objects between calls, so treat it as read-only.
 */
export const dereference = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): OpenApiNonBooleanSchemaObject =>
  typeof schema === 'boolean' || isObject(schema)
    ? coreDereference(schema, context, dereferenceOptions)
    : {};
