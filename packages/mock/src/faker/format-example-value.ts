import {
  callFormatTypeFunction,
  type ContextSpec,
  type GeneratorImport,
  getCustomFormatType,
  getFormatTypeConfig,
  getFormatTypeError,
  isDateFormatType,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  resolveRef,
} from '@orval/core';

const DATE_FORMATS = new Set(['date', 'date-time']);

function isDateFormat(
  format: string | undefined,
): format is 'date' | 'date-time' {
  return format !== undefined && DATE_FORMATS.has(format);
}

function isSchemaObject(
  schema: unknown,
): schema is OpenApiNonBooleanSchemaObject {
  return (
    typeof schema === 'object' && schema !== null && !Array.isArray(schema)
  );
}

function resolveSchema(
  schema: OpenApiSchemaObject | undefined,
  context: ContextSpec,
): OpenApiNonBooleanSchemaObject | undefined {
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  if (typeof schema.$ref === 'string') {
    const resolved = resolveRef<OpenApiSchemaObject>(
      schema as OpenApiReferenceObject,
      context,
    ).schema;
    return resolved && typeof resolved === 'object' ? resolved : undefined;
  }

  return schema;
}

function mergePropertySchemas(
  ...schemas: Array<OpenApiNonBooleanSchemaObject | undefined>
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

function getEffectiveScalarFormat(
  resolved: OpenApiNonBooleanSchemaObject | undefined,
  context: ContextSpec,
): string | undefined {
  if (!resolved) {
    return undefined;
  }

  const isConvertedFormat = (format: string | undefined): format is string =>
    isDateFormat(format) ||
    getFormatTypeConfig(format, context.output.override) !== undefined;

  if (isConvertedFormat(resolved.format)) {
    return resolved.format;
  }

  const oneOf = resolved.oneOf;
  const anyOf = resolved.anyOf;

  for (const variant of [...(oneOf ?? []), ...(anyOf ?? [])]) {
    const resolvable = isSchemaObject(variant) ? variant : undefined;
    const resolvedVariant = resolveSchema(resolvable, context);

    if (isConvertedFormat(resolvedVariant?.format)) {
      return resolvedVariant.format;
    }
  }

  return undefined;
}

/**
 * Resolves compositional schemas (allOf / oneOf / anyOf) so example formatting
 * can see property formats on nested and referenced types.
 */
function resolveExampleSchema(
  schema: OpenApiSchemaObject | undefined,
  context: ContextSpec,
  seenRefs: Set<string> = new Set(),
): OpenApiNonBooleanSchemaObject | undefined {
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  if (typeof schema.$ref === 'string') {
    const ref = schema.$ref;
    if (seenRefs.has(ref)) {
      const resolved = resolveRef<OpenApiSchemaObject>(
        schema as OpenApiReferenceObject,
        context,
      ).schema;
      return resolved && typeof resolved === 'object' ? resolved : undefined;
    }
    seenRefs = new Set(seenRefs).add(ref);
  }

  const resolved = resolveSchema(schema, context);
  if (!resolved) {
    return undefined;
  }

  const allOf = resolved.allOf;
  const oneOf = resolved.oneOf;
  const anyOf = resolved.anyOf;
  const compositors = [...(allOf ?? []), ...(oneOf ?? []), ...(anyOf ?? [])];

  const properties = mergePropertySchemas(
    resolved,
    ...compositors.map((sub) => resolveExampleSchema(sub, context, seenRefs)),
  );
  // OpenApiSchemaObject includes AnyOtherAttribute; cast before spread (see object.ts).
  const baseResolved = resolved as Record<string, unknown>;

  if (resolved.type === 'array' && isSchemaObject(resolved.items)) {
    const items = resolveExampleSchema(resolved.items, context, seenRefs);
    const itemProperties = items?.properties;
    const normalizedItems =
      itemProperties && Object.keys(itemProperties).length > 0
        ? { type: 'object' as const, properties: itemProperties }
        : items;

    return {
      ...baseResolved,
      ...(Object.keys(properties).length > 0 ? { properties } : {}),
      items: normalizedItems ?? resolved.items,
    } as OpenApiNonBooleanSchemaObject;
  }

  if (Object.keys(properties).length > 0) {
    return {
      ...baseResolved,
      properties,
    } as OpenApiNonBooleanSchemaObject;
  }

  if (compositors.length > 0 && (oneOf ?? anyOf)) {
    const variantProperties = mergePropertySchemas(
      ...compositors.map((sub) => resolveExampleSchema(sub, context, seenRefs)),
    );

    if (Object.keys(variantProperties).length > 0) {
      return {
        type: 'object',
        properties: variantProperties,
      };
    }
  }

  const scalarFormat = getEffectiveScalarFormat(resolved, context);
  if (scalarFormat) {
    return {
      ...baseResolved,
      format: scalarFormat,
    } as OpenApiNonBooleanSchemaObject;
  }

  return resolved;
}

function formatLiteralValue(
  example: unknown,
  schema: OpenApiSchemaObject | undefined,
  context: ContextSpec,
  imports: GeneratorImport[],
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

    return `[${example.map((item) => formatLiteralValue(item, itemsSchema, context, imports)).join(', ')}]`;
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

        return `${safeKey}: ${formatLiteralValue(value, resolvedProp, context, imports)}`;
      },
    );

    return `{ ${entries.join(', ')} }`;
  }

  const format = getEffectiveScalarFormat(resolved, context);
  if (typeof example === 'string' && resolved && format) {
    const formatType = getCustomFormatType(
      { ...resolved, format },
      context.output.override,
    );
    // The example is a specific wire value: `decode` keeps it, `mock` only
    // stands in for it.
    if (formatType?.decode) {
      if (formatType.decodeImport) {
        imports.push({ ...formatType.decodeImport, values: true });
      }
      return callFormatTypeFunction(formatType.decode, JSON.stringify(example));
    }
    if (formatType?.mock) {
      if (formatType.mockImport) {
        imports.push({ ...formatType.mockImport, values: true });
      }
      return formatType.mock;
    }
    if (formatType) {
      throw getFormatTypeError(
        format,
        formatType,
        'examples need `decode` or `mock`',
      );
    }
    if (isDateFormatType(format, context.output.override)) {
      return `new Date(${JSON.stringify(example)})`;
    }
  }

  return JSON.stringify(example);
}

export function formatSchemaExampleValue(
  example: unknown,
  schema: OpenApiSchemaObject | undefined,
  context: ContextSpec,
  imports: GeneratorImport[] = [],
): string {
  const { useDates, formatType } = context.output.override;
  if ((!useDates && !formatType) || schema === undefined) {
    return JSON.stringify(example);
  }

  return formatLiteralValue(example, schema, context, imports);
}
