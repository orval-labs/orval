import {
  getRequiredKeys,
  isString,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiSchemaObject,
} from '@orval/core';

import {
  type ChildGenerator,
  plainBase,
  plainNode,
  type BaseSchema,
  type ValibotEntry,
  type ValibotNode,
} from './nodes';
import { hasProperties, isNonBoolean } from './schema-type';

// Marks the given keys as required in every object reachable through the
// composition constructors.
const requireFields = (
  node: ValibotNode,
  keys: ReadonlySet<string>,
): ValibotNode => {
  if (keys.size === 0) return node;
  const requireEntries = (entries: ValibotEntry[]): ValibotEntry[] =>
    entries.map(({ key, value }) => ({
      key,
      value: keys.has(key) ? { ...value, optional: false } : value,
    }));
  const requireMembers = (members: ValibotNode[]) =>
    members.map((member) => requireFields(member, keys));

  const { schema } = node;
  switch (schema.kind) {
    case 'object':
    case 'objectWithRest': {
      return {
        ...node,
        schema: { ...schema, entries: requireEntries(schema.entries) },
      };
    }
    case 'union':
    case 'intersect': {
      return {
        ...node,
        schema: { ...schema, members: requireMembers(schema.members) },
      };
    }
    case 'variant': {
      return {
        ...node,
        schema: { ...schema, options: requireMembers(schema.options) },
      };
    }
    default: {
      return node;
    }
  }
};

// Keys required by the schema and, through nested `allOf`, by its members.
const requiredKeysOf = (schema: OpenApiNonBooleanSchemaObject): string[] => [
  ...getRequiredKeys(schema, 'schema').filter(isString),
  ...(Array.isArray(schema.allOf) ? schema.allOf : []).flatMap((member) =>
    isNonBoolean(member) ? requiredKeysOf(member) : [],
  ),
];

// A node that is only its constructor: no checks, wrappers or default.
const isBareNode = (node: ValibotNode): boolean =>
  node.actions.length === 0 &&
  !node.nullable &&
  !node.optional &&
  node.defaultValue === undefined;

// `v.variant` needs every option to be a bare object whose discriminator is a
// literal or a picklist.
const toVariant = (
  members: ValibotNode[],
  key: string,
): ValibotNode | undefined => {
  const isVariantOption = (node: ValibotNode) => {
    const { schema } = node;
    if (schema.kind !== 'object' || !isBareNode(node)) return false;
    const entry = schema.entries.find((item) => item.key === key)?.value;
    return (
      entry !== undefined &&
      isBareNode(entry) &&
      (entry.schema.kind === 'literal' || entry.schema.kind === 'picklist')
    );
  };
  return members.every(isVariantOption)
    ? plainNode({ kind: 'variant', key, options: members })
    : undefined;
};

type CompositionKey = 'allOf' | 'oneOf' | 'anyOf';

const COMPOSITION_KEYS: readonly CompositionKey[] = ['allOf', 'oneOf', 'anyOf'];

// The composition keywords the schema uses, in a fixed order.
const getCompositionKeys = (
  schema: OpenApiNonBooleanSchemaObject,
): CompositionKey[] =>
  COMPOSITION_KEYS.filter(
    (key) => Array.isArray(schema[key]) && schema[key].length > 0,
  );

// The schema with just one of its composition keywords.
const onlyComposition = (
  key: CompositionKey,
  schema: OpenApiNonBooleanSchemaObject,
  rest: OpenApiNonBooleanSchemaObject,
): OpenApiNonBooleanSchemaObject =>
  key === 'allOf'
    ? { ...rest, allOf: schema.allOf }
    : key === 'oneOf'
      ? { ...rest, oneOf: schema.oneOf }
      : { ...rest, anyOf: schema.anyOf };

// Every keyword applies, so the groups are intersected. The first group keeps
// the schema's own keywords; the discriminator is repeated for the others so
// each `oneOf` can still become a `v.variant`.
const generateIntersection = (
  schema: OpenApiNonBooleanSchemaObject,
  keys: CompositionKey[],
  child: ChildGenerator,
): ValibotNode[] => {
  // `default` and `description` belong to the outer schema only.
  const {
    default: _default,
    description: _description,
    allOf: _allOf,
    oneOf: _oneOf,
    anyOf: _anyOf,
    ...ownKeywords
  } = schema;
  const later: OpenApiNonBooleanSchemaObject = schema.discriminator
    ? { discriminator: schema.discriminator }
    : {};
  return keys.map((key, index) =>
    child(onlyComposition(key, schema, index === 0 ? ownKeywords : later)),
  );
};

// The object made of the schema's own properties, if it has any.
const ownObject = (
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
): ValibotNode | undefined => {
  if (!hasProperties(schema)) return undefined;
  return child({
    properties: schema.properties,
    // Keys with no property here belong to a member.
    required: Array.isArray(schema.required)
      ? schema.required.filter((name) =>
          Object.hasOwn(schema.properties ?? {}, name),
        )
      : undefined,
    additionalProperties: schema.additionalProperties,
    type: 'object',
  });
};

// The members of an allOf are generated without their `required`, which the
// parent applies to all of them.
const withoutRequired = (member: OpenApiSchemaObject): OpenApiSchemaObject => {
  if (!isNonBoolean(member)) return member;
  const { required: _required, ...rest } = member;
  return rest;
};

// A single keyword: `allOf` intersects, `oneOf` and `anyOf` union, and a
// discriminator turns the union into `v.variant` where it can.
const generateGroup = (
  schema: OpenApiNonBooleanSchemaObject,
  key: CompositionKey,
  child: ChildGenerator,
): BaseSchema => {
  // An instance of an allOf satisfies every member, so a key required by the
  // parent or any member is required wherever it is declared.
  const required = new Set(requiredKeysOf(schema));
  const members = (schema[key] ?? []).map((member) =>
    requireFields(
      child(key === 'allOf' ? withoutRequired(member) : member),
      required,
    ),
  );
  const ownNode = ownObject(schema, child);
  const own = ownNode ? [requireFields(ownNode, required)] : [];

  const discriminator = schema.discriminator?.propertyName;
  const variant =
    key !== 'allOf' && own.length === 0 && isString(discriminator)
      ? toVariant(members, discriminator)
      : undefined;
  if (variant) return plainBase(variant.schema);

  if (key === 'allOf') {
    return plainBase({ kind: 'intersect', members: [...members, ...own] });
  }
  const union = plainNode({ kind: 'union', members });
  return plainBase(
    own.length > 0
      ? { kind: 'intersect', members: [union, ...own] }
      : union.schema,
  );
};

/**
 * The schema of `allOf`, `oneOf` and `anyOf`, or `undefined` when the schema
 * uses none of them.
 */
export const generateComposition = (
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
): BaseSchema | undefined => {
  const keys = getCompositionKeys(schema);
  if (keys.length === 0) return undefined;
  if (keys.length === 1) return generateGroup(schema, keys[0], child);
  // A key required by one group is required wherever any group declares it.
  const groups = plainNode({
    kind: 'intersect',
    members: generateIntersection(schema, keys, child),
  });
  return plainBase(
    requireFields(groups, new Set(requiredKeysOf(schema))).schema,
  );
};
