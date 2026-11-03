import {
  type ContextSpec,
  isObject,
  isString,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  resolveRef,
  toObjectSchema,
} from '@orval/core';

import { logger, warnOnce } from './logger';

const tryResolveRefSchema = (
  $ref: string,
  context: ContextSpec,
): OpenApiSchemaObject | undefined => {
  try {
    return resolveRef<OpenApiSchemaObject>({ $ref }, context).schema;
  } catch (error) {
    logger.verbose(
      `Failed to resolve $ref "${$ref}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }
};

const dereferenceValue = (value: unknown, context: ContextSpec): unknown => {
  if (isObject(value)) return dereferenceObject(value, context);
  return Array.isArray(value)
    ? value.map((item: unknown) => dereferenceValue(item, context))
    : value;
};

const dereferenceObject = (
  schema: Record<string, unknown>,
  context: ContextSpec,
): OpenApiNonBooleanSchemaObject => {
  const refName = isString(schema.$ref) ? schema.$ref : undefined;
  if (refName && context.parents?.includes(refName)) {
    warnOnce(`Circular $ref "${refName}" is validated as unknown.`);
    return {};
  }

  const resolvedContext: ContextSpec = {
    ...context,
    ...(refName
      ? { parents: [...(context.parents ?? []), refName] }
      : undefined),
  };

  const resolveReferenced = (
    name: string,
  ): Record<string, unknown> | undefined => {
    const referenced = tryResolveRefSchema(name, context);
    if (typeof referenced !== 'boolean' && !isObject(referenced)) {
      warnOnce(`Unresolvable $ref "${name}" is validated as unknown.`);
      return;
    }
    const siblings = Object.fromEntries(
      Object.entries(schema).filter(([key]) => key !== '$ref'),
    );
    return { ...toObjectSchema(referenced), ...siblings };
  };

  const resolved = refName ? resolveReferenced(refName) : schema;
  if (!resolved) return {};

  // The entries are rebuilt from a JSON document, so the compiler cannot see
  // that the result is still a schema.
  return Object.fromEntries(
    Object.entries(resolved).map(([key, value]) => {
      if (key === 'properties' && isObject(value)) {
        return [
          key,
          Object.fromEntries(
            Object.entries(value).map(([name, property]) => [
              name,
              dereferenceValue(property, resolvedContext),
            ]),
          ),
        ];
      }
      return [
        key,
        key === 'default' ||
        key === 'example' ||
        key === 'examples' ||
        key.startsWith('x-')
          ? value
          : dereferenceValue(value, resolvedContext),
      ];
    }),
  ) as OpenApiNonBooleanSchemaObject;
};

/**
 * Inlines every `$ref`. A circular `$ref` becomes an empty schema, which is
 * validated as `unknown`.
 */
export const dereference = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): OpenApiNonBooleanSchemaObject => {
  if (typeof schema === 'boolean') return toObjectSchema(schema);
  return isObject(schema) ? dereferenceObject(schema, context) : {};
};
