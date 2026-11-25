import {
  getRequiredKeys,
  isSchemaNullable,
  isString,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiSchemaObject,
  type CompositionKey,
  getCompositionKeys,
  getMultiTypes,
  getRef,
  hasProperties,
  isNonBoolean,
  resolveType,
  withoutOuterAnnotations,
} from '@orval/core';

import { unsupportedMode, unsupportedOnly } from './logger';
import {
  type ChildGenerator,
  plainBase,
  plainNode,
  type BaseSchema,
  type ValibotEntry,
  type ValibotNode,
} from './nodes';

/** The schema a `$ref` member stands for, when it can be resolved. */
export type RefResolver = (
  member: OpenApiSchemaObject,
) => OpenApiNonBooleanSchemaObject | undefined;

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

const isObjectNode = (node: ValibotNode): boolean =>
  node.schema.kind === 'object' || node.schema.kind === 'objectWithRest';

// A member that accepts any object, such as `additionalProperties: true`.
const isOpenRecord = (node: ValibotNode): boolean =>
  node.schema.kind === 'record' &&
  node.schema.value.schema.kind === 'unknown' &&
  node.actions.every(({ kind }) => kind === 'describe') &&
  !node.nullable;

const isAnnotationOnly = (node: ValibotNode): boolean =>
  isUnknown(node) && node.actions.every(({ kind }) => kind === 'describe');

// An intersection returns each member's output merged, so a member that checks
// nothing would add back the keys the others strip, and its raw values would
// not merge with a date the others transform. Such members are left out: an
// unknown one always, an open record when an object member already checks the
// type.
const allOfMembers = (members: ValibotNode[]): ValibotNode[] => {
  // A nullable object member accepts null, which the record rejects.
  const hasObject = members.some(
    (member) => isObjectNode(member) && !member.nullable,
  );
  const kept = members.filter(
    (member) =>
      !isAnnotationOnly(member) && !(hasObject && isOpenRecord(member)),
  );
  return kept.length > 0 ? kept : [plainNode({ kind: 'unknown' })];
};

// An allOf member is generated without `required`, which the parent applies.
const withoutRequired = (member: OpenApiSchemaObject): OpenApiSchemaObject => {
  if (!isNonBoolean(member)) return member;
  const { required: _required, ...rest } = member;
  return rest;
};

// A strict object inside an intersection is rendered as a plain object.
const hasStrictObject = ({ schema }: ValibotNode): boolean => {
  switch (schema.kind) {
    case 'object': {
      return schema.mode === 'strictObject';
    }
    case 'union':
    case 'intersect': {
      return schema.members.some(hasStrictObject);
    }
    case 'variant': {
      return schema.options.some(hasStrictObject);
    }
    default: {
      return false;
    }
  }
};

const reportStrictInIntersection = (
  members: ValibotNode[],
  path: string | undefined,
): void => {
  if (members.length > 1 && members.some(hasStrictObject)) {
    unsupportedOnly(
      'A strict object inside an intersection, such as `allOf`, is validated as a plain object, so it accepts the keys of the other members.',
      path,
    );
  }
};

const literalType = (source: string): string =>
  /^['"]/.test(source)
    ? 'string'
    : source === 'true' || source === 'false'
      ? 'boolean'
      : source === 'null'
        ? 'null'
        : 'number';

// The values and types a member accepts, when that is known.
const domainsOf = (node: ValibotNode): string[] | undefined => {
  const domains = baseDomainsOf(node);
  return domains && node.nullable ? [...domains, 'null'] : domains;
};

const baseDomainsOf = ({ schema }: ValibotNode): string[] | undefined => {
  switch (schema.kind) {
    case 'object':
    case 'objectWithRest':
    case 'record': {
      return ['object'];
    }
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
    case 'array':
    case 'file': {
      return [schema.kind];
    }
    case 'literal': {
      return [`=${schema.value}`];
    }
    case 'picklist': {
      return schema.values.map((value) => `=${value}`);
    }
    default: {
      return undefined;
    }
  }
};

const overlaps = (left: string, right: string): boolean => {
  const kindOf = (domain: string) =>
    domain.startsWith('=') ? literalType(domain.slice(1)) : domain;
  return (
    left === right ||
    (left.startsWith('=') && kindOf(left) === right) ||
    (right.startsWith('=') && kindOf(right) === left)
  );
};

// Alternatives that cannot match the same value, so a union reads as `oneOf`.
// Without a discriminator, only plain types and literals can be told apart.
const areExclusive = (members: ValibotNode[]): boolean => {
  const isNull = ({ schema }: ValibotNode) => schema.kind === 'null';
  const present = members.filter((member) => !isNull(member));
  const nulls = members.length - present.length;
  // A `null` alternative also matches a member that is nullable or of
  // unknown type.
  if (
    nulls > 1 ||
    (nulls === 1 &&
      present.some((m) => m.nullable || domainsOf(m) === undefined))
  ) {
    return false;
  }
  if (present.length <= 1) return true;
  const domains = present.map(domainsOf);
  return domains.every(
    (list, index) =>
      list !== undefined &&
      domains
        .slice(index + 1)
        .every(
          (other) =>
            other !== undefined &&
            !list.some((a) => other.some((b) => overlaps(a, b))),
        ),
  );
};

// Only the keywords that decide the type a schema accepts, so a referenced
// alternative is compared without generating everything under it.
const SHALLOW_KEYS = ['type', 'enum', 'const', 'nullable', 'format'] as const;

// The generator reads a schema without `type` as an object only when it
// declares properties.
const impliedType = (
  target: OpenApiNonBooleanSchemaObject,
): 'object' | undefined => (hasProperties(target) ? 'object' : undefined);

const shallowNode = (
  target: OpenApiNonBooleanSchemaObject | undefined,
  child: ChildGenerator,
): ValibotNode | undefined => {
  if (!target || getCompositionKeys(target).length > 0) return undefined;
  const record: Record<string, unknown> = target;
  const shallow: Record<string, unknown> = Object.fromEntries(
    SHALLOW_KEYS.filter((key) => record[key] !== undefined).map((key) => [
      key,
      record[key],
    ]),
  );
  if (shallow.type === undefined) {
    const type = impliedType(target);
    if (type) shallow.type = type;
  }
  return child(shallow);
};

const literalValues = (
  property: OpenApiSchemaObject | undefined,
): string[] | undefined => {
  if (!isNonBoolean(property)) return undefined;
  if (property.const !== undefined) return [JSON.stringify(property.const)];
  return Array.isArray(property.enum)
    ? property.enum.map((value: unknown) => JSON.stringify(value))
    : undefined;
};

// The values a member allows for the discriminator: those every one of its
// own properties and `allOf` members allows, following `$ref`s and nested
// `allOf`s.
const discriminatorValues = (
  member: OpenApiSchemaObject | undefined,
  name: string,
  resolve: (schema: OpenApiSchemaObject) => OpenApiSchemaObject | undefined,
  seen: ReadonlySet<object> = new Set(),
): string[] | undefined => {
  const source = member === undefined ? undefined : resolve(member);
  if (!isNonBoolean(source) || seen.has(source)) return undefined;
  const visited = new Set([...seen, source]);
  const property = source.properties?.[name];
  const lists = [
    property === undefined ? undefined : literalValues(resolve(property)),
    ...(source.allOf ?? []).map((part) =>
      discriminatorValues(part, name, resolve, visited),
    ),
  ].filter((list): list is string[] => list !== undefined);
  if (lists.length === 0) return undefined;
  const [first, ...rest] = lists;
  return first.filter((value) =>
    rest.every((values) => values.includes(value)),
  );
};

// Whether no value can match two alternatives of a `oneOf`: by type or
// literal, or by distinct discriminator values.
const isExclusiveOneOf = (
  schema: OpenApiNonBooleanSchemaObject,
  members: ValibotNode[],
  child: ChildGenerator,
  resolveRef: RefResolver | undefined,
): boolean => {
  const resolve = (
    member: OpenApiSchemaObject,
  ): OpenApiSchemaObject | undefined =>
    isNonBoolean(member) && getRef(member) !== undefined
      ? resolveRef?.(member)
      : member;
  const raw = schema.oneOf ?? [];
  const resolved = raw.map((member) => {
    const target = resolve(member);
    return isNonBoolean(target) ? target : undefined;
  });
  // A referenced member is generated as a `ref`, or with annotations next to
  // it as an intersection holding the `ref`.
  const comparable = members.map((node, index) =>
    getRef(raw[index]) === undefined
      ? node
      : (shallowNode(resolved[index], child) ?? node),
  );
  if (areExclusive(comparable)) return true;
  const name = schema.discriminator?.propertyName;
  if (!isString(name)) return false;
  // Discriminator values do not tell apart a `null` that two members accept.
  const acceptsNull = ({ nullable, schema: node }: ValibotNode) =>
    nullable || node.kind === 'null';
  if (comparable.filter(acceptsNull).length > 1) return false;
  const values = resolved.map((member) =>
    discriminatorValues(member, name, resolve),
  );
  const seen = new Set<string>();
  for (const list of values) {
    if (!list || list.some((value) => seen.has(value))) return false;
    for (const value of list) seen.add(value);
  }
  return true;
};

const generateGroup = (
  schema: OpenApiNonBooleanSchemaObject,
  key: CompositionKey,
  child: ChildGenerator,
  path: string | undefined,
  resolveRef: RefResolver | undefined,
): BaseSchema => {
  // An allOf instance satisfies every member, so a key required by the parent
  // or any member is required wherever it is declared.
  const required = new Set(requiredKeysOf(schema));
  const alternatives = (schema[key] ?? []).map((member, index): Alternative => {
    const node = child(
      key === 'allOf' ? withoutRequired(member) : member,
      true,
      `${key}[${index}]`,
    );
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

  // A variant stops at the first option that matches, so it needs the
  // exclusivity check as much as a union does.
  if (
    key === 'oneOf' &&
    unsupportedMode() === 'error' &&
    !isExclusiveOneOf(schema, members, child, resolveRef)
  ) {
    unsupportedOnly(
      '`oneOf` is validated like `anyOf`, so a value that matches several alternatives is accepted.',
      path,
    );
  }

  const discriminator = schema.discriminator?.propertyName;
  const variant =
    key !== 'allOf' && own.length === 0 && isString(discriminator)
      ? toVariant(members, discriminator)
      : undefined;
  if (variant) return plainBase(variant.schema);

  if (key === 'allOf') {
    const kept = allOfMembers([...members, ...own]);
    reportStrictInIntersection(kept, path);
    return plainBase({ kind: 'intersect', members: kept });
  }
  const union = plainNode({ kind: 'union', members });
  const coversOwn =
    ownKeywords === undefined && alternatives.every((a) => a.isOwnObjectCopy);
  if (own.length > 0 && !coversOwn) {
    const intersected = [union, ...own];
    reportStrictInIntersection(intersected, path);
    return plainBase({ kind: 'intersect', members: intersected });
  }
  return plainBase(union.schema);
};

/** The `allOf`, `oneOf` and `anyOf` groups of a schema, if it has any. */
export const generateComposition = (
  schema: OpenApiNonBooleanSchemaObject,
  child: ChildGenerator,
  path?: string,
  resolveRef?: RefResolver,
): BaseSchema | undefined => {
  const keys = getCompositionKeys(schema);
  if (keys.length === 0) return undefined;
  if (keys.length === 1) {
    return generateGroup(schema, keys[0], child, path, resolveRef);
  }
  // A key required by one group is required wherever any group declares it.
  const members = generateIntersection(schema, keys, child);
  reportStrictInIntersection(members, path);
  const groups = plainNode({ kind: 'intersect', members });
  return plainBase(
    requireFields(groups, new Set(requiredKeysOf(schema))).schema,
  );
};
