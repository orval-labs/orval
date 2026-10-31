import {
  isObject,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiSchemaObject,
} from '@orval/core';

import { isNonBoolean } from './schema-type';

const isReadOnly = (schema: OpenApiSchemaObject | undefined): boolean =>
  isNonBoolean(schema) && schema.readOnly === true;

// The read-only properties of a schema and of its `allOf` members.
const readOnlyKeys = (schema: OpenApiNonBooleanSchemaObject): string[] => [
  ...Object.entries(isObject(schema.properties) ? schema.properties : {})
    .filter(([, property]) => isReadOnly(property))
    .map(([key]) => key),
  ...(Array.isArray(schema.allOf) ? schema.allOf : []).flatMap((member) =>
    isNonBoolean(member) ? readOnlyKeys(member) : [],
  ),
];

const declaresContent = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  Object.keys(schema.properties ?? {}).length > 0 ||
  (schema.allOf?.length ?? 0) > 0;

// Whether the read-only properties were all that a schema declared.
const isEmptied = (
  before: OpenApiSchemaObject | undefined,
  after: OpenApiSchemaObject,
): boolean =>
  isNonBoolean(before) &&
  isNonBoolean(after) &&
  declaresContent(before) &&
  !declaresContent(after) &&
  !after.oneOf &&
  !after.anyOf &&
  !after.additionalProperties;

// An object left without properties would be an open dictionary, so it is
// closed instead: a request has nothing to send there.
const closeIfEmptied = (
  before: OpenApiNonBooleanSchemaObject,
  after: OpenApiNonBooleanSchemaObject,
): OpenApiNonBooleanSchemaObject =>
  isEmptied(before, after)
    ? { ...after, type: 'object', additionalProperties: false }
    : after;

const strip = (
  schema: OpenApiNonBooleanSchemaObject,
  inherited: ReadonlySet<string>,
): OpenApiNonBooleanSchemaObject => {
  const hidden = new Set([...inherited, ...readOnlyKeys(schema)]);
  // The keys hidden here are hidden from the `required` of members that
  // describe the same instance.
  const nested = (
    member: OpenApiSchemaObject,
    shared: ReadonlySet<string> = new Set(),
  ): OpenApiSchemaObject =>
    isNonBoolean(member)
      ? closeIfEmptied(member, strip(member, shared))
      : member;
  const result: OpenApiNonBooleanSchemaObject = { ...schema };

  if (isObject(schema.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties)
        .filter(([, property]) => !isReadOnly(property))
        .map(([key, property]) => [key, nested(property)]),
    );
  }
  if (Array.isArray(schema.required)) {
    result.required = schema.required.filter((key) => !hidden.has(key));
  }
  if (schema.items) result.items = nested(schema.items);
  if (schema.additionalProperties) {
    result.additionalProperties = nested(schema.additionalProperties);
  }
  for (const key of ['oneOf', 'anyOf'] as const) {
    const members = schema[key];
    if (Array.isArray(members)) {
      result[key] = members.map((member) => nested(member, hidden));
    }
  }
  if (Array.isArray(schema.allOf)) {
    // A member left with nothing is dropped, as it would be an open object.
    // Its siblings share the keys hidden here.
    const members = schema.allOf.map((member) =>
      isNonBoolean(member) ? strip(member, hidden) : member,
    );
    const kept = members.filter(
      (member, index) => !isEmptied(schema.allOf?.[index], member),
    );
    if (kept.length > 0) result.allOf = kept;
    else delete result.allOf;
  }
  return result;
};

/**
 * A schema without its read-only properties, which a request must not send.
 * Their names are also removed from `required`. The zod package does this for
 * the top level and array items of a request body; here nested objects and
 * composition members are handled as well.
 */
export const omitReadOnly = (
  schema: OpenApiNonBooleanSchemaObject,
): OpenApiNonBooleanSchemaObject =>
  closeIfEmptied(schema, strip(schema, new Set()));
