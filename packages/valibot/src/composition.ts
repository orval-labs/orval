import {
  getRequiredKeys,
  isSchemaNullable,
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
import {
  type CompositionKey,
  getCompositionKeys,
  getMultiTypes,
  hasProperties,
  isNonBoolean,
  resolveType,
  withoutOuterAnnotations,
} from './schema-type';

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

// Descriptions are documentation only and `v.variant` does not take a pipe,
// so they are left off its options and discriminators.
const withoutDescription = (node: ValibotNode): ValibotNode => ({
  ...node,
  actions: node.actions.filter((action) => action.kind !== 'describe'),
});

const withBareDiscriminator = (node: ValibotNode, key: string): ValibotNode => {
  const bare = withoutDescription(node);
  const { schema } = bare;
  if (schema.kind !== 'object') return bare;
  return {
    ...bare,
    schema: {
      ...schema,
      entries: schema.entries.map((entry) =>
        entry.key === key
          ? { ...entry, value: withoutDescription(entry.value) }
          : entry,
      ),
    },
  };
};

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
  const options = members.map((member) => withBareDiscriminator(member, key));
  return options.every(isVariantOption)
    ? plainNode({ kind: 'variant', key, options })
    : undefined;
};

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

// Whether the schema describes an object, with or without properties.
const isObjectSchema = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  hasProperties(schema) ||
  (resolveType(schema) === 'object' && getMultiTypes(schema).length <= 1);

// Every keyword applies, so the groups are intersected. The first group keeps
// the schema's own keywords; the discriminator is repeated for the others so
// each `oneOf` can still become a `v.variant`.
const generateIntersection = (
  schema: OpenApiNonBooleanSchemaObject,
  keys: CompositionKey[],
  child: ChildGenerator,
): ValibotNode[] => {
  const {
    allOf: _allOf,
    oneOf: _oneOf,
    anyOf: _anyOf,
    ...ownKeywords
  } = withoutOuterAnnotations(schema);
  const later: OpenApiNonBooleanSchemaObject = schema.discriminator
    ? { discriminator: schema.discriminator }
    : {};
  return keys.map((key, index) =>
    child(onlyComposition(key, schema, index === 0 ? ownKeywords : later)),
  );
};

// The schema of the object made of the schema's own properties. The keys in
// `alsoRequired` are required on top of its own.
const ownObjectSchema = (
  schema: OpenApiNonBooleanSchemaObject,
  alsoRequired: string[] = [],
): OpenApiNonBooleanSchemaObject => ({
  properties: schema.properties,
  // Keys with no property here belong to a member.
  required: [
    ...(Array.isArray(schema.required)
      ? schema.required.filter((name) =>
          Object.hasOwn(schema.properties ?? {}, name),
        )
      : []),
    ...alsoRequired,
  ],
  additionalProperties: schema.additionalProperties,
  type: 'object',
});

// The object made of the schema's own properties, if it has any.
const ownObject = (
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
): ValibotNode | undefined =>
  hasProperties(schema) ? child(ownObjectSchema(schema)) : undefined;

const isUnknown = (node: ValibotNode): boolean =>
  node.schema.kind === 'unknown';

// An alternative that only lists `required` keys has no type, so it is
// `v.unknown()` and would accept anything. It is the object of the schema's
// own properties with those keys required instead.
const narrowOwnObject = (
  member: OpenApiSchemaObject,
  node: ValibotNode,
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
): ValibotNode => {
  if (!isUnknown(node) || !isNonBoolean(member)) return node;
  const keys = Array.isArray(member.required)
    ? member.required.filter(isString)
    : [];
  return keys.length > 0 && isObjectSchema(schema)
    ? {
        ...child(ownObjectSchema(schema, keys)),
        actions: node.actions,
        nullable: node.nullable,
      }
    : node;
};

const NULL_TYPE = 'null' as const;

// The schema of the scalar and array keywords next to a composition, which
// the composition is intersected with. `object` is left to `ownObject`.
// `hasUnchecked` is set when a member is `v.unknown()`: the type is then the
// only check on the values that member lets through.
const ownScalar = (
  schema: OpenApiNonBooleanSchemaObject,
  hasUnchecked: boolean,
  child: ChildGenerator,
): ValibotNode | undefined => {
  const declared = Array.isArray(schema.type) ? schema.type : [schema.type];
  // A type that allows objects cannot be told apart from the members here.
  const typed = declared.includes('object')
    ? []
    : declared.filter((type) => type !== undefined && type !== 'null');
  // A composition that accepts null needs a type that does too.
  const types =
    typed.length > 0 && isSchemaNullable(schema)
      ? [...typed, NULL_TYPE]
      : typed;
  const keywords = {
    type: types.length > 1 ? types : types[0],
    enum: schema.enum,
    format: schema.format,
    pattern: schema.pattern,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    minimum: schema.minimum,
    maximum: schema.maximum,
    exclusiveMinimum: schema.exclusiveMinimum,
    exclusiveMaximum: schema.exclusiveMaximum,
    multipleOf: schema.multipleOf,
    items: schema.items,
    // Only a present key means a tuple.
    ...(schema.prefixItems ? { prefixItems: schema.prefixItems } : {}),
    minItems: schema.minItems,
    maxItems: schema.maxItems,
    contentEncoding: schema.contentEncoding,
    contentMediaType: schema.contentMediaType,
  };
  // A type alone repeats what the members already check.
  const { type: _type, ...checks } = keywords;
  if (
    !hasUnchecked &&
    Object.values(checks).every((value) => value === undefined)
  ) {
    return undefined;
  }
  const node = child(keywords);
  // Keywords without a type check nothing, and an unknown member would only
  // bring back keys that the other members strip.
  return node.schema.kind === 'unknown' ? undefined : node;
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
  const members = (schema[key] ?? []).map((member) => {
    const node = child(key === 'allOf' ? withoutRequired(member) : member);
    return requireFields(
      key === 'allOf' ? node : narrowOwnObject(member, node, schema, child),
      required,
    );
  });
  const ownNode = ownObject(schema, child);
  const ownKeywords = ownScalar(schema, members.some(isUnknown), child);
  const own = [
    ...(ownNode ? [requireFields(ownNode, required)] : []),
    ...(ownKeywords ? [ownKeywords] : []),
  ];

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
