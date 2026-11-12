import type {
  ContextSpec,
  OpenApiNonBooleanSchemaObject,
  OpenApiSchemaObject,
} from '../types';
import { isObject, isSchemaNullable } from '../utils/assertion';
import type { SchemaDirection } from './ref-policy';
import { getLocalRefTarget, getRef } from './refs';
import { ALTERNATIVE_KEYS } from './schema-keys';
import {
  hasProperties,
  isNonBoolean,
  toCanonicalNullable,
} from './schema-type';

type IsHidden = (schema: OpenApiSchemaObject | undefined) => boolean;

const byFlag =
  (direction: SchemaDirection): IsHidden =>
  (schema) =>
    isNonBoolean(schema) && schema[direction] === true;

const hiddenKeys = (
  schema: OpenApiNonBooleanSchemaObject,
  isHidden: IsHidden,
): string[] => [
  ...Object.entries(isObject(schema.properties) ? schema.properties : {})
    .filter(([, property]) => isHidden(property))
    .map(([key]) => key),
  ...(Array.isArray(schema.allOf) ? schema.allOf : []).flatMap((member) =>
    isNonBoolean(member) ? hiddenKeys(member, isHidden) : [],
  ),
];

const declaresContent = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  hasProperties(schema) ||
  (Array.isArray(schema.allOf) && schema.allOf.length > 0);

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

// Null stays accepted when the schema, or an allOf member now dropped, allowed it.
const wasNullable = (
  before: OpenApiNonBooleanSchemaObject,
  after: OpenApiNonBooleanSchemaObject,
): boolean =>
  isSchemaNullable(after) ||
  (Array.isArray(before.allOf) ? before.allOf : []).some(
    (member) => isNonBoolean(member) && isSchemaNullable(member),
  );

// An emptied object would be an open dictionary, so it is closed instead.
const closeIfEmptied = (
  before: OpenApiNonBooleanSchemaObject,
  after: OpenApiNonBooleanSchemaObject,
): OpenApiNonBooleanSchemaObject =>
  isEmptied(before, after)
    ? {
        ...after,
        type: wasNullable(before, after) ? ['object', 'null'] : 'object',
        additionalProperties: false,
      }
    : after;

const strip = (
  input: OpenApiNonBooleanSchemaObject,
  inherited: ReadonlySet<string>,
  isHidden: IsHidden,
  keepProperties = false,
): OpenApiNonBooleanSchemaObject => {
  const schema = toCanonicalNullable(input);
  const hidden = new Set([...inherited, ...hiddenKeys(schema, isHidden)]);
  // Hidden keys are also hidden from the `required` of sibling members.
  const nested = (
    member: OpenApiSchemaObject,
    shared: ReadonlySet<string> = new Set(),
  ): OpenApiSchemaObject =>
    isNonBoolean(member)
      ? closeIfEmptied(member, strip(member, shared, isHidden, keepProperties))
      : member;
  const result: OpenApiNonBooleanSchemaObject = { ...schema };

  if (isObject(schema.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties)
        .filter(([, property]) => keepProperties || !isHidden(property))
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
  for (const key of ALTERNATIVE_KEYS) {
    const members = schema[key];
    if (Array.isArray(members)) {
      result[key] = members.map((member) => nested(member, hidden));
    }
  }
  if (Array.isArray(schema.allOf)) {
    // A member left with nothing is dropped, as it would be an open object.
    const members = schema.allOf.map((member) =>
      isNonBoolean(member)
        ? strip(member, hidden, isHidden, keepProperties)
        : member,
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
 * A schema without the properties its direction must not carry: read-only ones
 * for a request, write-only ones for a response. They are also removed from
 * `required`, in nested objects and composition members too.
 */
export const omitDirectional = (
  schema: OpenApiNonBooleanSchemaObject,
  direction: SchemaDirection,
): OpenApiNonBooleanSchemaObject =>
  closeIfEmptied(schema, strip(schema, new Set(), byFlag(direction)));

/**
 * A schema whose `writeOnly` properties are optional, also those that reference
 * a `writeOnly` schema, directly or through a one-member `allOf`. A component constant is shared by requests and
 * responses, and a response leaves those properties out.
 */
export const relaxWriteOnly = (
  schema: OpenApiNonBooleanSchemaObject,
  context: ContextSpec,
): OpenApiNonBooleanSchemaObject => {
  const isWriteOnly: IsHidden = (property) => {
    const seen = new Set<string>();
    let current: unknown = property;
    while (isObject(current)) {
      if (current.writeOnly === true) return true;
      // `allOf: [{ $ref }]` is how OpenAPI 3.0 adds a description to a
      // reference, so a single member is followed like the reference itself.
      if (Array.isArray(current.allOf) && current.allOf.length === 1) {
        current = current.allOf[0];
        continue;
      }
      const ref = getRef(current);
      if (ref === undefined || seen.has(ref)) return false;
      seen.add(ref);
      current = getLocalRefTarget(ref, context);
    }
    return false;
  };
  return strip(schema, new Set(), isWriteOnly, true);
};
