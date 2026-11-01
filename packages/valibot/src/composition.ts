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

// Requires the keys in every object reachable through the composition.
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

const requiredKeysOf = (schema: OpenApiNonBooleanSchemaObject): string[] => [
  ...getRequiredKeys(schema, 'schema').filter(isString),
  ...(Array.isArray(schema.allOf) ? schema.allOf : []).flatMap((member) =>
    isNonBoolean(member) ? requiredKeysOf(member) : [],
  ),
];

const isBareNode = (node: ValibotNode): boolean =>
  node.actions.length === 0 &&
  !node.nullable &&
  !node.optional &&
  node.defaultValue === undefined;

// `v.variant` takes no pipe, so descriptions are left off its options.
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

// `v.variant` options are bare objects with a literal or picklist discriminator.
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

const onlyComposition = (
  key: CompositionKey,
  schema: OpenApiNonBooleanSchemaObject,
  rest: OpenApiNonBooleanSchemaObject,
): OpenApiNonBooleanSchemaObject => ({ ...rest, [key]: schema[key] });

const isObjectSchema = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  hasProperties(schema) ||
  (resolveType(schema) === 'object' && getMultiTypes(schema).length <= 1);

// The groups are intersected; the discriminator is repeated so each `oneOf`
// can still become a `v.variant`.
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

// `alsoRequired` keys are required on top of the own ones.
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

const ownObject = (
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
): ValibotNode | undefined =>
  hasProperties(schema) ? child(ownObjectSchema(schema)) : undefined;

const isUnknown = (node: ValibotNode): boolean =>
  node.schema.kind === 'unknown';

const requiredNames = (member: OpenApiNonBooleanSchemaObject): string[] =>
  Array.isArray(member.required) ? member.required.filter(isString) : [];

// A required-only alternative has no type and would accept anything, so it
// becomes the own object with those keys required.
const narrowOwnObject = (
  member: OpenApiSchemaObject,
  node: ValibotNode,
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
): ValibotNode | undefined => {
  if (!isUnknown(node) || !isNonBoolean(member)) return undefined;
  const keys = requiredNames(member);
  return keys.length > 0 && isObjectSchema(schema)
    ? {
        ...child(ownObjectSchema(schema, keys)),
        actions: node.actions,
        nullable: node.nullable,
      }
    : undefined;
};

interface Alternative {
  node: ValibotNode;
  // A narrowed copy of the own object, with declared keys only, that rejects null.
  isOwnObjectCopy: boolean;
}

const NULL_TYPE = 'null' as const;

// Scalar and array keywords next to a composition, intersected with it.
// `hasUnchecked`: a `v.unknown()` member leaves the type as the only check.
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
  const checks = {
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
  if (
    !hasUnchecked &&
    Object.values(checks).every((value) => value === undefined)
  ) {
    return undefined;
  }
  const node = child({
    type: types.length > 1 ? types : types[0],
    ...checks,
  });
  // Keywords without a type check nothing, and an unknown member would only
  // bring back keys that the other members strip.
  return node.schema.kind === 'unknown' ? undefined : node;
};

// An allOf member is generated without `required`, which the parent applies.
const withoutRequired = (member: OpenApiSchemaObject): OpenApiSchemaObject => {
  if (!isNonBoolean(member)) return member;
  const { required: _required, ...rest } = member;
  return rest;
};

const generateGroup = (
  schema: OpenApiNonBooleanSchemaObject,
  key: CompositionKey,
  child: ChildGenerator,
): BaseSchema => {
  // An allOf instance satisfies every member, so a key required by the parent
  // or any member is required wherever it is declared.
  const required = new Set(requiredKeysOf(schema));
  const alternatives = (schema[key] ?? []).map((member): Alternative => {
    const node = child(key === 'allOf' ? withoutRequired(member) : member);
    const narrowed =
      key === 'allOf'
        ? undefined
        : narrowOwnObject(member, node, schema, child);
    // A key with no property is only on its own copy, which strict rejects
    // on the other copies.
    const declared =
      isNonBoolean(member) &&
      requiredNames(member).every((name) =>
        Object.hasOwn(schema.properties ?? {}, name),
      );
    return {
      node: requireFields(narrowed ?? node, required),
      isOwnObjectCopy: narrowed !== undefined && !narrowed.nullable && declared,
    };
  });
  const members = alternatives.map(({ node }) => node);
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
  const coversOwn =
    ownKeywords === undefined && alternatives.every((a) => a.isOwnObjectCopy);
  return plainBase(
    own.length > 0 && !coversOwn
      ? { kind: 'intersect', members: [union, ...own] }
      : union.schema,
  );
};

/** The `allOf`, `oneOf` and `anyOf` groups of a schema, if it has any. */
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
