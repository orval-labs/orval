import {
  type ContextSpec,
  isReference,
  type OpenApiSchemaObject,
  resolveRef,
} from '@orval/core';

const DATE_FORMATS = new Set(['date', 'date-time']);

function isDateFormat(
  format: string | undefined,
): format is 'date' | 'date-time' {
  return format !== undefined && DATE_FORMATS.has(format);
}

function isSchemaObject(schema: unknown): schema is OpenApiSchemaObject {
  return (
    typeof schema === 'object' && schema !== null && !Array.isArray(schema)
  );
}

function resolveSchema(
  schema: OpenApiSchemaObject | undefined,
  context: ContextSpec,
): OpenApiSchemaObject | undefined {
  if (!schema) {
    return undefined;
  }

  if (isReference(schema)) {
    return resolveRef(schema, context).schema;
  }

  return schema;
}

function mergePropertySchemas(
  ...schemas: Array<OpenApiSchemaObject | undefined>
): Record<string, OpenApiSchemaObject> {
  const merged: Record<string, OpenApiSchemaObject> = {};

  for (const schema of schemas) {
    if (!schema?.properties) {
      continue;
    }

    for (const [key, prop] of Object.entries(schema.properties)) {
      if (isSchemaObject(prop)) {
        merged[key] = prop;
      }
    }
  }

  return merged;
}

/**
 * Resolves compositional schemas (allOf / oneOf / anyOf) so example formatting
 * can see property formats on nested and referenced types.
 */
function resolveExampleSchema(
  schema: OpenApiSchemaObject | undefined,
  context: ContextSpec,
): OpenApiSchemaObject | undefined {
  const resolved = resolveSchema(schema, context);
  if (!resolved) {
    return undefined;
  }

  const allOf = resolved.allOf as OpenApiSchemaObject[] | undefined;
  const oneOf = resolved.oneOf as OpenApiSchemaObject[] | undefined;
  const anyOf = resolved.anyOf as OpenApiSchemaObject[] | undefined;
  const compositors = [...(allOf ?? []), ...(oneOf ?? []), ...(anyOf ?? [])];

  const properties = mergePropertySchemas(
    resolved,
    ...compositors.map((sub) => resolveExampleSchema(sub, context)),
  );

  if (resolved.type === 'array' && isSchemaObject(resolved.items)) {
    const items = resolveExampleSchema(resolved.items, context);
    const itemProperties = items?.properties;
    const normalizedItems =
      itemProperties && Object.keys(itemProperties).length > 0
        ? { type: 'object' as const, properties: itemProperties }
        : items;

    return {
      ...resolved,
      ...(Object.keys(properties).length > 0 ? { properties } : {}),
      items: normalizedItems ?? resolved.items,
    };
  }

  if (Object.keys(properties).length > 0) {
    return {
      ...resolved,
      properties,
    };
  }

  if (compositors.length > 0 && (oneOf ?? anyOf)) {
    const variantProperties = mergePropertySchemas(
      ...compositors.map((sub) => resolveExampleSchema(sub, context)),
    );

    if (Object.keys(variantProperties).length > 0) {
      return {
        type: 'object',
        properties: variantProperties,
      };
    }
  }

  return resolved;
}

export function formatScalarExampleValue(
  example: unknown,
  format: string | undefined,
  context: ContextSpec,
): string {
  if (
    context.output.override.useDates &&
    typeof example === 'string' &&
    isDateFormat(format)
  ) {
    return `new Date(${JSON.stringify(example)})`;
  }

  return JSON.stringify(example);
}

function formatLiteralValue(
  example: unknown,
  schema: OpenApiSchemaObject | undefined,
  context: ContextSpec,
): string {
  if (example === null) {
    return 'null';
  }

  if (example === undefined) {
    return 'undefined';
  }

  const resolved = resolveExampleSchema(schema, context);

  if (Array.isArray(example)) {
    const itemsSchema =
      resolved?.type === 'array' && isSchemaObject(resolved.items)
        ? resolveExampleSchema(resolved.items, context)
        : resolved;

    return `[${example.map((item) => formatLiteralValue(item, itemsSchema, context)).join(', ')}]`;
  }

  if (typeof example === 'object') {
    const properties = resolved?.properties ?? {};

    const entries = Object.entries(example as Record<string, unknown>).map(
      ([key, value]) => {
        const propSchema = properties[key];
        const resolvedProp = isSchemaObject(propSchema)
          ? resolveExampleSchema(propSchema, context)
          : undefined;
        const safeKey = /^[a-zA-Z_$][\w$]*$/.test(key)
          ? key
          : JSON.stringify(key);

        return `${safeKey}: ${formatLiteralValue(value, resolvedProp, context)}`;
      },
    );

    return `{ ${entries.join(', ')} }`;
  }

  if (
    context.output.override.useDates &&
    typeof example === 'string' &&
    isDateFormat(resolved?.format)
  ) {
    return `new Date(${JSON.stringify(example)})`;
  }

  return JSON.stringify(example);
}

export function formatSchemaExampleValue(
  example: unknown,
  schema: OpenApiSchemaObject | undefined,
  context: ContextSpec,
): string {
  if (!context.output.override.useDates || schema === undefined) {
    return JSON.stringify(example);
  }

  return formatLiteralValue(example, schema, context);
}
