import { getFormDataComponentContexts } from '../getters/form-data-components';
import type { ContextSpec } from '../types';
import { isObject, isString } from '../utils/assertion';
import {
  getFormDataFieldFileType,
  isOctetStreamContentType,
} from '../utils/content-type';
import {
  CIRCULAR_REF_WARNING,
  dereferenceWithPolicy,
  type SchemaWalkReporter,
} from './dereference';
import { type RefPolicy, resolveSelf } from './ref-policy';
import {
  getComponentKey,
  getComponentSchema,
  getLocalRefTarget,
  getRef,
  toComponentRef,
} from './refs';
import {
  ALTERNATIVE_KEYS,
  type CompositionKey,
  COMPOSITION_KEYS,
  hasOnlyAnnotations,
  membersOf,
  stringList,
} from './schema-keys';

/** The schema libraries whose output `modelTypeChecks` compares to the models. */
export type ModelTypeCheckLibrary = 'valibot' | 'zod';

interface ConstructSite {
  context: ContextSpec;
  library: ModelTypeCheckLibrary;
  /** Whether the Zod output is Zod 4 or Zod Mini, not Zod 3. */
  isZodV4: boolean;
}

/** The composition keyword a subschema is a member of, if any. */
type NodeRole = CompositionKey | undefined;

interface SchemaNode {
  schema: Record<string, unknown>;
  role: NodeRole;
}

/**
 * A construct the model and the generated schema type differently on purpose,
 * so the pair is not assignable both ways. A component that holds one has no
 * check.
 */
interface LooseConstruct {
  /** Why the check is skipped, as the sentence after `skipped, `. */
  reason: string;
  libraries: readonly ModelTypeCheckLibrary[];
  /** Whether only the schema of the component counts, not a subschema. */
  atRoot?: boolean;
  /** Whether the schema holds the construct itself, not in a subschema. */
  isIn: (
    schema: Record<string, unknown>,
    site: ConstructSite,
    role: NodeRole,
  ) => boolean;
}

const hasKeys = (value: unknown): boolean =>
  isObject(value) && Object.keys(value).length > 0;

const isArraySchema = ({ type }: Record<string, unknown>): boolean =>
  Array.isArray(type) ? type.includes('array') : type === 'array';

// Whether the schema fills a missing value. Valibot feeds the default of a
// referenced schema into the property that references it, Zod keeps the
// reference and so the optional property.
const hasDefault = (schema: unknown, site: ConstructSite): boolean => {
  if (!isObject(schema)) return false;
  if (schema.default !== undefined) return true;
  if (site.library !== 'valibot' || getRef(schema) === undefined) return false;
  const { schema: target } = resolveSelf(schema, site.context, new Set());
  return isObject(target) && target.default !== undefined;
};

// The keys that give a schema a type of its own. Without one it accepts any
// value, which the models type as `{}` and the schemas as `unknown`.
const TYPING_KEYS = [
  'type',
  '$ref',
  'enum',
  'const',
  'allOf',
  'oneOf',
  'anyOf',
  'properties',
  'patternProperties',
  'additionalProperties',
  'items',
  'prefixItems',
] as const;

const isUntyped = (schema: Record<string, unknown>): boolean =>
  TYPING_KEYS.every((key) => schema[key] === undefined);

// The keys that describe an object without giving the schema a type.
const OBJECT_SHAPE_KEYS: readonly string[] = [
  'properties',
  'patternProperties',
  'additionalProperties',
];

// Whether the schema has no type and only describes the shape of an object,
// with `additionalProperties`, `patternProperties` or an empty `properties`.
// The model types it as an object and the schema accepts any value.
const isUntypedObjectShape = (schema: Record<string, unknown>): boolean =>
  OBJECT_SHAPE_KEYS.some((key) => schema[key] !== undefined) &&
  !hasKeys(schema.properties) &&
  TYPING_KEYS.every(
    (key) => schema[key] === undefined || OBJECT_SHAPE_KEYS.includes(key),
  );

// Whether Zod validates such a schema as unknown. It keeps a record when
// `additionalProperties` is `true` or a schema.
const isUntypedClosedObjectShape = (schema: Record<string, unknown>): boolean =>
  isUntypedObjectShape(schema) &&
  schema.additionalProperties !== true &&
  !isObject(schema.additionalProperties);

const hasComposition = (schema: Record<string, unknown>): boolean =>
  COMPOSITION_KEYS.some((key) => schema[key] !== undefined);

const isStructured = (value: unknown): boolean =>
  isObject(value) || Array.isArray(value);

// Whether the type is `object`, alone or next to `null`.
const isObjectType = ({ type }: Record<string, unknown>): boolean => {
  const types = Array.isArray(type) ? type : [type];
  const nonNull = types.filter((member) => member !== 'null');
  return nonNull.length === 1 && nonNull[0] === 'object';
};

const alternativesOf = (schema: Record<string, unknown>): unknown[] =>
  ALTERNATIVE_KEYS.flatMap((key) => membersOf(schema[key]));

// A schema that only requires keys has no type, so it accepts any value.
const isRequiredOnly = (member: unknown): boolean =>
  isObject(member) &&
  isUntyped(member) &&
  stringList(member.required).length > 0;

// Next to the own properties of an object, an alternative that only requires
// keys is validated as an object with those keys required, which the model
// leaves untyped. Valibot does so next to an `object` type too.
const holdsRequiredOnlyAlternative = (
  schema: Record<string, unknown>,
  site: ConstructSite,
): boolean =>
  (hasKeys(schema.properties) ||
    (site.library === 'valibot' && isObjectType(schema))) &&
  alternativesOf(schema).some(isRequiredOnly);

// Whether the schema is a numeric 64-bit integer, which `useBigInt` types as
// a `bigint` in the models only. The literals of an enum or a const are
// numbers in both.
const isBigInteger = (schema: Record<string, unknown>): boolean => {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  return (
    types.some((type) => type === 'integer' || type === 'number') &&
    (schema.format === 'int64' || schema.format === 'uint64') &&
    schema.enum === undefined &&
    schema.const === undefined
  );
};

// The keys the schema requires that none of its own properties declares.
const undeclaredRequiredKeys = (schema: Record<string, unknown>): string[] => {
  const properties = isObject(schema.properties) ? schema.properties : {};
  return stringList(schema.required).filter(
    (key) => !Object.hasOwn(properties, key),
  );
};

// Whether the schema requires a key that none of its properties declares.
// Members of an `allOf` are read through their parent, which declares the
// key, and a schema that holds a composition leaves the key to its members.
const requiresUndeclaredProperty = (
  schema: Record<string, unknown>,
  _site: ConstructSite,
  role: NodeRole,
): boolean =>
  role !== 'allOf' &&
  !hasComposition(schema) &&
  !isUntyped(schema) &&
  undeclaredRequiredKeys(schema).length > 0;

// Whether an alternative may declare the key itself, which is where the
// generated schema requires it. One that is an object without the property
// leaves the key alone.
const mayDeclareKey = (target: Record<string, unknown>, key: string): boolean =>
  getRef(target) !== undefined ||
  hasComposition(target) ||
  (isObject(target.properties) && Object.hasOwn(target.properties, key));

// Whether the schema requires a key that an alternative declares without
// requiring it. The schema requires the key wherever an alternative declares
// it, and the model leaves each one as it declares it.
const requiresKeyOfAlternatives = (
  schema: Record<string, unknown>,
  { context }: ConstructSite,
): boolean => {
  const alternatives = alternativesOf(schema);
  return undeclaredRequiredKeys(schema).some((key) =>
    alternatives.some((alternative) => {
      const { schema: target } = resolveSelf(alternative, context, new Set());
      return (
        isObject(target) &&
        mayDeclareKey(target, key) &&
        !stringList(target.required).includes(key)
      );
    }),
  );
};

// Whether a component is written as a constant object: every property is a
// `const`, and the model then requires every key.
const isConstantObject = (
  schema: Record<string, unknown>,
  { context }: ConstructSite,
): boolean => {
  const properties = isObject(schema.properties)
    ? Object.values(schema.properties)
    : [];
  return (
    context.output.override.useTypeOverInterfaces !== true &&
    properties.length > 0 &&
    properties.every((property) => isObject(property) && 'const' in property)
  );
};

const holdsOptionalConst = (
  schema: Record<string, unknown>,
  site: ConstructSite,
): boolean => {
  if (!isConstantObject(schema, site) || !isObject(schema.properties)) {
    return false;
  }
  const required = stringList(schema.required);
  return Object.keys(schema.properties).some((key) => !required.includes(key));
};

// Whether the schema allows null through its type or `nullable`.
const allowsNull = ({ type, nullable }: Record<string, unknown>): boolean =>
  nullable === true || (Array.isArray(type) ? type : [type]).includes('null');

// A typed const that allows null through its type or `nullable`, which the
// model types without the null.
const isNullableConst = (schema: Record<string, unknown>): boolean =>
  schema.const !== undefined && schema.type !== undefined && allowsNull(schema);

// Whether an alternative is null, nullable or an enum, through its references
// and the alternatives it holds.
const isNullOrEnumAlternative = (
  member: unknown,
  context: ContextSpec,
  followed: ReadonlySet<string>,
): boolean => {
  const { schema: target, followed: path } = resolveSelf(
    member,
    context,
    followed,
  );
  return (
    isObject(target) &&
    (allowsNull(target) ||
      target.enum !== undefined ||
      target.const !== undefined ||
      alternativesOf(target).some((alternative) =>
        isNullOrEnumAlternative(alternative, context, path),
      ))
  );
};

// Whether the schema has properties or an `allOf` of its own next to a null,
// nullable or enum alternative. The model merges them into the alternatives
// and drops the own properties of an enum, while the schema intersects them.
const holdsNullOrEnumAlternative = (
  schema: Record<string, unknown>,
  { context }: ConstructSite,
): boolean =>
  (hasKeys(schema.properties) || membersOf(schema.allOf).length > 0) &&
  alternativesOf(schema).some((alternative) =>
    isNullOrEnumAlternative(alternative, context, new Set()),
  );

// Whether the schema has properties of its own next to an enum `allOf`
// member. The model makes them alternatives, while the schema intersects them.
const holdsEnumMember = (
  schema: Record<string, unknown>,
  { context }: ConstructSite,
): boolean =>
  hasKeys(schema.properties) &&
  membersOf(schema.allOf).some((member) => {
    const { schema: target } = resolveSelf(member, context, new Set());
    return isObject(target) && target.enum !== undefined;
  });

// A readOnly array nested in an array, which the model types readonly one
// level up.
const holdsReadOnlyArrayItem = ({ items }: Record<string, unknown>): boolean =>
  isObject(items) && items.readOnly === true && isArraySchema(items);

// Whether the generators reach their string branch for the schema, alone or
// for one member of a type list such as `[string, number]`.
const reachesString = ({ type }: Record<string, unknown>): boolean =>
  type === 'string' || (Array.isArray(type) && type.includes('string'));

// A string the generated schema validates as a file. Only a schema that
// reaches the string branch counts: `{ type: 'integer', format: 'binary' }`
// is a number in both, while the string member of `[string, number]` is a
// file in the schema and a Blob in the model.
const isBinaryString = (schema: Record<string, unknown>): boolean =>
  reachesString(schema) &&
  (schema.format === 'binary' ||
    (isOctetStreamContentType(
      isString(schema.contentMediaType) ? schema.contentMediaType : undefined,
    ) &&
      !schema.contentEncoding));

// A tuple that cannot grow keeps its rest items in the model, while the Zod
// schema leaves them out.
const isClosedTupleWithRest = ({
  prefixItems,
  items,
  maxItems,
}: Record<string, unknown>): boolean =>
  Array.isArray(prefixItems) &&
  prefixItems.length > 0 &&
  Boolean(items) &&
  typeof maxItems === 'number' &&
  maxItems <= prefixItems.length;

// Whether the schema is an array of any kind, tuples included.
const isArrayLike = (schema: Record<string, unknown>): boolean =>
  isArraySchema(schema) ||
  schema.items !== undefined ||
  schema.prefixItems !== undefined;

// Whether the array has an `items` schema, the only case where the model
// applies `readOnly`.
const hasItemsSchema = ({ items }: Record<string, unknown>): boolean =>
  items !== undefined && items !== false;

// Whether the generated schema types the array's output as readonly, as the
// model does for a readOnly array: one with items and no prefixItems, unless
// `suppressReadonlyModifier` is on. The valibot generator adds `v.readonly()`
// on the same test.
const hasReadonlyOutput = (
  schema: Record<string, unknown>,
  { context }: ConstructSite,
): boolean =>
  schema.readOnly === true &&
  hasItemsSchema(schema) &&
  schema.prefixItems === undefined &&
  context.output.override.suppressReadonlyModifier !== true;

const holdsOptionalDefault = (
  schema: Record<string, unknown>,
  site: ConstructSite,
): boolean => {
  if (!isObject(schema.properties)) return false;
  const required = Array.isArray(schema.required) ? schema.required : [];
  return Object.entries(schema.properties).some(
    ([key, property]) => !required.includes(key) && hasDefault(property, site),
  );
};

// Whether the type is `null` or a list that holds it. `nullable` is left out:
// Zod keeps the null it adds.
const hasNullType = ({ type }: Record<string, unknown>): boolean =>
  Array.isArray(type) ? type.includes('null') : type === 'null';

// Whether Zod drops the null of a type that sits next to a composition: it
// validates the composition alone. An object type keeps its null, since the
// composition then validates the object alongside it.
const holdsNullTypeNextToComposition = (
  schema: Record<string, unknown>,
): boolean =>
  hasNullType(schema) &&
  !isObjectType(schema) &&
  alternativesOf(schema).length + membersOf(schema.allOf).length > 0;

// What a `$ref` points at: a component, or any other local target.
const refTargetOf = (ref: string, context: ContextSpec): unknown =>
  getComponentSchema(ref, context) ?? getLocalRefTarget(ref, context);

// What the answers of `isUnknownValued` keep across the schemas it visits.
interface UnknownWalk {
  // The answers for referenced components, whose walk met no cycle.
  answers: Map<string, boolean>;
  // How many references the walk left in place for being cyclic or unresolved.
  cuts: number;
}

// Whether the schema accepts any value, so the generated schema is `unknown`:
// an untyped schema, `true`, or a composition that holds such a member. A
// component several branches reach is answered once.
const isUnknownValued = (
  schema: unknown,
  context: ContextSpec,
  followed: ReadonlySet<string>,
  walk: UnknownWalk = { answers: new Map(), cuts: 0 },
): boolean => {
  if (schema === true) return true;
  const memberRef = isObject(schema) ? plainRefOf(schema) : undefined;
  const shared =
    memberRef !== undefined && !followed.has(memberRef)
      ? walk.answers.get(memberRef)
      : undefined;
  if (shared !== undefined) return shared;
  const { schema: target, followed: path } = resolveSelf(
    schema,
    context,
    followed,
  );
  if (!isObject(target)) return target === true;
  const left = getRef(target);
  const cutsBefore = walk.cuts;
  if (left !== undefined) {
    // A reference left in place is cyclic or unresolved, or the alias of a
    // boolean schema, which alias following leaves alone.
    if (!path.has(left) && refTargetOf(left, context) === true) return true;
    walk.cuts++;
  }
  const unknownIn = (members: unknown[]) => ({
    some: () =>
      members.some((member) => isUnknownValued(member, context, path, walk)),
    every: () =>
      members.every((member) => isUnknownValued(member, context, path, walk)),
  });
  const answer = (): boolean => {
    if (target.oneOf !== undefined || target.anyOf !== undefined) {
      return unknownIn(alternativesOf(target)).some();
    }
    const intersection = membersOf(target.allOf);
    if (intersection.length > 0 && isUntyped({ ...target, allOf: undefined })) {
      return unknownIn(intersection).every();
    }
    return isUntyped(target) || isUntypedClosedObjectShape(target);
  };
  const result = answer();
  if (
    memberRef !== undefined &&
    !followed.has(memberRef) &&
    walk.cuts === cutsBefore
  ) {
    walk.answers.set(memberRef, result);
  }
  return result;
};

interface ObjectParts {
  properties: Record<string, unknown>;
  required: ReadonlySet<string>;
}

// What the walk of `mergedObjectParts` keeps across the members of one schema.
interface ObjectPartsWalk {
  // The parts of a referenced component, whose walk met no cycle.
  parts: Map<string, ObjectParts>;
  // How many references the walk left in place for being cyclic.
  cuts: number;
}

// The properties and required keys of the schema and of its `allOf` members,
// which the generated schema intersects. A property of the schema itself wins
// over the members, and a later member over an earlier one. A component that
// several members reach is walked once.
const mergedObjectParts = (
  schema: Record<string, unknown>,
  context: ContextSpec,
  followed: ReadonlySet<string>,
  walk: ObjectPartsWalk = { parts: new Map(), cuts: 0 },
): ObjectParts => {
  const properties: Record<string, unknown> = {};
  const required = new Set(stringList(schema.required));
  for (const member of membersOf(schema.allOf)) {
    const memberRef = plainRefOf(member);
    const shared =
      memberRef !== undefined && !followed.has(memberRef)
        ? walk.parts.get(memberRef)
        : undefined;
    const parts = shared ?? partsOfMember(member, context, followed, walk);
    if (parts === undefined) continue;
    Object.assign(properties, parts.properties);
    for (const key of parts.required) required.add(key);
  }
  if (isObject(schema.properties)) Object.assign(properties, schema.properties);
  return { properties, required };
};

// The ref of a member that is a `$ref` and annotations only, which holds what
// its component holds.
const plainRefOf = (member: unknown): string | undefined =>
  isObject(member) && hasOnlyAnnotations(member) ? getRef(member) : undefined;

const partsOfMember = (
  member: unknown,
  context: ContextSpec,
  followed: ReadonlySet<string>,
  walk: ObjectPartsWalk,
): ObjectParts | undefined => {
  const { schema: target, followed: path } = resolveSelf(
    member,
    context,
    followed,
  );
  if (!isObject(target)) return undefined;
  const memberRef = plainRefOf(member);
  const cutsBefore = walk.cuts;
  // A reference that is still in place is cyclic or unresolved.
  if (getRef(target) !== undefined) walk.cuts++;
  const parts = mergedObjectParts(target, context, path, walk);
  if (
    memberRef !== undefined &&
    !followed.has(memberRef) &&
    walk.cuts === cutsBefore
  ) {
    walk.parts.set(memberRef, parts);
  }
  return parts;
};

// Whether a required property accepts any value. Zod 3 makes the key of an
// `unknown` property optional in the output type, while the model requires it.
// The property and the requirement may sit in different `allOf` members.
const requiresUnknownProperty = (
  schema: Record<string, unknown>,
  { context, isZodV4 }: ConstructSite,
): boolean => {
  if (isZodV4) return false;
  const { properties, required } = mergedObjectParts(
    schema,
    context,
    new Set(),
  );
  const walk: UnknownWalk = { answers: new Map(), cuts: 0 };
  return [...required].some(
    (key) =>
      Object.hasOwn(properties, key) &&
      isUnknownValued(properties[key], context, new Set(), walk),
  );
};

// The string formats that the Zod generator validates as the format, with no
// literal next to it. Another format, and a const next to `ipv4` or `ipv6`,
// is validated as the literal.
const VALIDATED_STRING_FORMATS: ReadonlySet<string> = new Set([
  'date',
  'time',
  'time-local',
  'date-time',
  'date-time-local',
  'email',
  'uri',
  'hostname',
  'uuid',
]);

// Whether the schema is a string with a const and a format that the Zod
// generator validates as the format, or as a file for a binary string.
const isConstWithFormat = (schema: Record<string, unknown>): boolean =>
  schema.const !== undefined &&
  ((isString(schema.format) &&
    VALIDATED_STRING_FORMATS.has(schema.format) &&
    reachesString(schema)) ||
    isBinaryString(schema));

// Whether the schema evaluates properties by a schema of its own, with no
// `properties` to anchor the object.
// The model reads `additionalProperties` first, so it decides the record.
const isUnevaluatedRecord = (schema: Record<string, unknown>): boolean =>
  isObject(schema.unevaluatedProperties) &&
  schema.additionalProperties === undefined &&
  !hasKeys(schema.properties);

const SCALAR_TYPES: readonly string[] = [
  'string',
  'number',
  'integer',
  'boolean',
];

// Whether a type that is not an object sits next to a composition whose
// schema is `unknown`: the model keeps the type, and the generated schema
// holds no trace of it. An `allOf` member without a type takes the scalar type
// of its parent, except `true`; an alternative takes none.
const holdsUnknownCompositionUnderType = (
  schema: Record<string, unknown>,
  { context }: ConstructSite,
): boolean => {
  const types = (Array.isArray(schema.type) ? schema.type : [schema.type])
    .filter((type) => type !== undefined && type !== 'null')
    .map(String);
  if (types.length === 0 || types.includes('object')) return false;
  const inheritsType = types.length === 1 && SCALAR_TYPES.includes(types[0]);
  const isUnknown = (member: unknown) =>
    isUnknownValued(member, context, new Set());
  const intersection = membersOf(schema.allOf);
  return (
    alternativesOf(schema).some(isUnknown) ||
    (intersection.length > 0 &&
      intersection.every(
        (member) =>
          member === true ||
          (!inheritsType &&
            isObject(member) &&
            getRef(member) === undefined &&
            isUnknown(member)),
      ))
  );
};

/**
 * Where the generated schemas are looser or stricter than the models on
 * purpose, each with the libraries that do so. `modelTypeChecks` skips the
 * components that hold one, and the documentation lists the same constructs.
 */
const LOOSE_CONSTRUCTS: readonly LooseConstruct[] = [
  {
    reason: 'prefixItems is validated as an array of unknown',
    libraries: ['valibot'],
    isIn: (schema) => schema.prefixItems !== undefined,
  },
  {
    reason:
      'a binary string is validated as File, which the model types as Blob',
    libraries: ['valibot'],
    isIn: isBinaryString,
  },
  {
    reason:
      'the default of an optional property makes it required in the schema output only',
    libraries: ['valibot', 'zod'],
    isIn: holdsOptionalDefault,
  },
  {
    reason:
      'a readOnly array is readonly in the model, which the schema output is not',
    libraries: ['zod'],
    // The model leaves the elements of a tuple alone, an array without items
    // mutable, and `suppressReadonlyModifier` leaves the array mutable.
    isIn: (schema, site) =>
      schema.readOnly === true &&
      isArraySchema(schema) &&
      hasItemsSchema(schema) &&
      schema.prefixItems === undefined &&
      site.context.output.override.suppressReadonlyModifier !== true,
  },
  {
    reason:
      'with useReadonlyArrays an array is readonly in the model, which the schema output is only for a readOnly array',
    libraries: ['valibot'],
    isIn: (schema, site) =>
      site.context.output.override.useReadonlyArrays === true &&
      isArrayLike(schema) &&
      !hasReadonlyOutput(schema, site),
  },
  {
    reason:
      'with useReadonlyArrays an array is readonly in the model, which the schema output is not',
    libraries: ['zod'],
    isIn: (schema, site) =>
      site.context.output.override.useReadonlyArrays === true &&
      isArrayLike(schema),
  },
  {
    reason:
      'a tuple of a fixed length keeps its rest items in the model, which the schema leaves out',
    libraries: ['zod'],
    isIn: isClosedTupleWithRest,
  },
  {
    reason:
      'a readOnly array in an array is readonly in the schema, which the model applies to the outer array',
    libraries: ['valibot'],
    isIn: holdsReadOnlyArrayItem,
  },
  {
    reason:
      'the readOnly of a reference to an array is readonly in the schema output only',
    libraries: ['valibot'],
    isIn: (schema, site) => {
      if (schema.readOnly !== true || getRef(schema) === undefined) {
        return false;
      }
      const { schema: target } = resolveSelf(schema, site.context, new Set());
      return isObject(target) && isArraySchema(target);
    },
  },
  {
    reason:
      'additionalProperties next to properties is typed unknown by the model',
    libraries: ['valibot', 'zod'],
    isIn: (schema) =>
      hasKeys(schema.properties) && hasKeys(schema.additionalProperties),
  },
  {
    reason:
      'a schema without a type is validated as unknown, which the model types as {}',
    libraries: ['valibot', 'zod'],
    atRoot: true,
    isIn: isUntyped,
  },
  {
    reason:
      'a schema without a type that describes an object is validated as unknown, which the model types as an object',
    libraries: ['valibot'],
    isIn: isUntypedObjectShape,
  },
  {
    // In a property or a member, the model leaves such a schema untyped too,
    // so only a component of its own differs.
    reason:
      'a schema without a type that describes an object is validated as unknown, which the model types as an object',
    libraries: ['zod'],
    atRoot: true,
    isIn: isUntypedClosedObjectShape,
  },
  {
    reason: 'a const that is an object or an array is not validated',
    libraries: ['valibot', 'zod'],
    isIn: ({ const: value }) => isStructured(value),
  },
  {
    reason: 'an enum with an object or an array member is validated as unknown',
    libraries: ['valibot'],
    isIn: ({ enum: members }) =>
      Array.isArray(members) && members.some(isStructured),
  },
  {
    reason:
      'a required key without a property is validated as unknown, which the model leaves out',
    libraries: ['valibot'],
    isIn: requiresUndeclaredProperty,
  },
  {
    reason:
      'a required key that only the alternatives declare is required in each of them, which the model does not',
    libraries: ['valibot'],
    isIn: requiresKeyOfAlternatives,
  },
  {
    reason:
      'a reference to anything but a whole component schema is validated as unknown',
    libraries: ['zod'],
    isIn: (schema) => {
      const ref = getRef(schema);
      return ref !== undefined && getComponentKey(ref) === undefined;
    },
  },
  {
    reason: 'a const typed with null is typed without null by the model',
    libraries: ['valibot', 'zod'],
    isIn: isNullableConst,
  },
  {
    reason:
      'a component of constants is a constant object in the model, with every key required',
    libraries: ['valibot', 'zod'],
    atRoot: true,
    isIn: holdsOptionalConst,
  },
  {
    reason:
      'a null, nullable or enum alternative next to properties or allOf is merged by the model and intersected in the schema',
    libraries: ['valibot', 'zod'],
    isIn: holdsNullOrEnumAlternative,
  },
  {
    reason:
      'an enum allOf member next to properties is an alternative in the model and intersected in the schema',
    libraries: ['valibot', 'zod'],
    isIn: holdsEnumMember,
  },
  {
    reason:
      'an alternative that only requires keys is validated as an object with them, which the model types as unknown',
    libraries: ['valibot', 'zod'],
    isIn: holdsRequiredOnlyAlternative,
  },
  {
    reason:
      'a 64-bit integer is a bigint in the model with useBigInt, and a number in the schema',
    libraries: ['valibot', 'zod'],
    isIn: (schema, site) =>
      site.context.output.override.useBigInt === true && isBigInteger(schema),
  },
  {
    reason:
      'a null type next to allOf, oneOf or anyOf is validated without the null',
    libraries: ['zod'],
    isIn: holdsNullTypeNextToComposition,
  },
  {
    reason:
      'a required property without a type is optional in the Zod 3 output',
    libraries: ['zod'],
    isIn: requiresUnknownProperty,
  },
  {
    reason:
      'a const next to a string format is validated as the format, not as the literal',
    libraries: ['zod'],
    isIn: isConstWithFormat,
  },
  {
    reason:
      'items of false is typed unknown[] by the model and never[] by the schema',
    libraries: ['zod'],
    isIn: (schema) =>
      schema.items === false && schema.prefixItems === undefined,
  },
  {
    reason:
      'a not of an empty schema is validated as never, which the model types as unknown',
    libraries: ['zod'],
    isIn: ({ not }) => isObject(not) && !hasKeys(not),
  },
  {
    reason:
      'in the Zod 3 output an enum without a primitive member is validated as never, which the model types as unknown',
    libraries: ['zod'],
    isIn: ({ enum: members }, { isZodV4 }) =>
      !isZodV4 &&
      Array.isArray(members) &&
      (members.length === 0 || members.some(isStructured)),
  },
  {
    reason:
      'a type next to a composition that is validated as unknown is kept by the model',
    libraries: ['zod'],
    isIn: holdsUnknownCompositionUnderType,
  },
  {
    reason:
      'unevaluatedProperties of a schema is typed by the model and not by the schema',
    libraries: ['zod'],
    isIn: isUnevaluatedRecord,
  },
];

/** What a library does with a circular reference it cannot keep. */
const CIRCULAR_REFERENCE: Pick<LooseConstruct, 'reason' | 'libraries'> = {
  reason: 'a circular reference is validated as unknown',
  libraries: ['valibot'],
};

// `$defs` and `definitions` are left out: a definition is part of the
// generated type only where a `$ref` reaches it, and `collectNodes` follows
// that `$ref`.
const SCHEMA_MAP_KEYS = [
  'properties',
  'patternProperties',
  'dependentSchemas',
] as const;

const SCHEMA_KEYS = [
  'items',
  'additionalItems',
  'additionalProperties',
  'contains',
  'propertyNames',
  'unevaluatedItems',
  'unevaluatedProperties',
  'not',
  'if',
  'then',
  'else',
] as const;

interface Subschema {
  value: unknown;
  role: NodeRole;
}

const subschemasOf = (schema: Record<string, unknown>): Subschema[] =>
  [
    ...SCHEMA_MAP_KEYS.flatMap((key) => {
      const map = schema[key];
      return isObject(map) ? Object.values(map) : [];
    }),
    // `items` is a list in the older tuple form.
    ...SCHEMA_KEYS.flatMap((key) =>
      Array.isArray(schema[key]) ? membersOf(schema[key]) : [schema[key]],
    ),
    ...membersOf(schema.prefixItems),
  ]
    .map((value): Subschema => ({ value, role: undefined }))
    .concat(
      COMPOSITION_KEYS.flatMap((role) =>
        membersOf(schema[role]).map((value) => ({ value, role })),
      ),
    );

// Every schema node under the root, the root included. A `$ref` to a whole
// component is not followed. One to another place in the document is, a
// subschema of a component included, since generating the component inlines
// what it points at.
const collectNodes = (root: unknown, context: ContextSpec): SchemaNode[] => {
  const nodes: SchemaNode[] = [];
  // By role and ref: a constructs check such as the required-key one depends
  // on the role, so a target reached in several roles is visited in each.
  // The roles are few, so a cycle still ends.
  const followed = new Set<string>();
  const pending: Subschema[] = [{ value: root, role: undefined }];
  // The list grows while it is read.
  for (const { value, role } of pending) {
    if (!isObject(value)) continue;
    nodes.push({ schema: value, role });
    pending.push(...subschemasOf(value));
    const ref = getRef(value);
    if (ref === undefined || getComponentKey(ref) !== undefined) continue;
    const visit = `${role ?? ''} ${ref}`;
    if (followed.has(visit)) continue;
    followed.add(visit);
    pending.push({ value: getLocalRefTarget(ref, context), role });
  }
  return nodes;
};

// Whether generating the component replaces a circular reference with
// `unknown`, which the library's policy decides by not keeping the reference.
const replacesCircularReference = (
  key: string,
  context: ContextSpec,
  policy: RefPolicy,
): boolean => {
  const schema = getComponentSchema(toComponentRef(key), context);
  if (schema === undefined) return false;
  let replaced = false;
  const reporter: SchemaWalkReporter = {
    library: 'model-type-checks',
    warn: (message) => {
      replaced ||= message.startsWith(CIRCULAR_REF_WARNING);
    },
    verbose: () => undefined,
  };
  dereferenceWithPolicy(
    schema,
    { ...context, parents: [toComponentRef(key)] },
    policy,
    { suggestReusable: false, reporter },
  );
  return replaced;
};

// The components a schema references as a whole anywhere in its tree. A
// `$ref` into a component's subschema is not a dependency on the component:
// `collectNodes` follows it to what it points at.
const referencedComponents = (nodes: readonly SchemaNode[]) => {
  const keys = nodes.flatMap(({ schema: node }) => {
    const ref = getRef(node);
    const key = ref === undefined ? undefined : getComponentKey(ref);
    return key === undefined ? [] : [key];
  });
  return [...new Set(keys)];
};

/** What Zod does with a circular reference that runs through a tuple. */
const TUPLE_CYCLE: Pick<LooseConstruct, 'reason' | 'libraries'> = {
  reason: 'a circular reference through prefixItems is validated as unknown',
  libraries: ['zod'],
};

/** What the model does with the encoded part of a multipart body. */
const ENCODED_PART: Pick<LooseConstruct, 'reason' | 'libraries'> = {
  reason:
    'the media type of a multipart part widens the model to a file, which the schema does not',
  libraries: ['zod'],
};

// The components that a tuple of the schema references, by its
// `prefixItems`, anywhere in its tree.
const tupleReferences = (
  nodes: readonly SchemaNode[],
  context: ContextSpec,
): string[] =>
  referencedComponents(
    nodes.flatMap(({ schema: node }) =>
      membersOf(node.prefixItems).flatMap((member) =>
        collectNodes(member, context),
      ),
    ),
  );

// Whether the component can be reached again from one of the targets.
const reachesAgain = (
  key: string,
  targets: readonly string[],
  references: ReadonlyMap<string, readonly string[]>,
): boolean => {
  const visited = new Set<string>();
  const pending = [...targets];
  for (const next of pending) {
    if (next === key) return true;
    if (visited.has(next)) continue;
    visited.add(next);
    pending.push(...(references.get(next) ?? []));
  }
  return false;
};

// Whether the model widens the part to a file, or a file or a string: a
// string that has a media type, from the `encoding` of the part or its own
// `contentMediaType`, and no `contentEncoding`, unless the schema validates
// the same file. The model passes the part to
// the items of an array, not a tuple, and to the members of a composition, and
// leaves a component reference to the model of that component.
const widensPart = (
  part: unknown,
  contentType: string | undefined,
): boolean => {
  if (!isObject(part) || getRef(part) !== undefined) return false;
  if (reachesString(part)) {
    // The model keeps a constant over the file type.
    if (part.const !== undefined) return false;
    // The model keeps `format: binary` a file whatever the encoding says. For
    // another file the schema is a string, unless it validates a file.
    const fileType = getFormDataFieldFileType(part, contentType);
    return (
      part.format !== 'binary' &&
      (fileType === 'text' || (fileType === 'binary' && !isBinaryString(part)))
    );
  }
  return (
    // The model resolves the rest items of a tuple without the part.
    (part.prefixItems === undefined && widensPart(part.items, contentType)) ||
    alternativesOf(part)
      .concat(membersOf(part.allOf))
      .some((member) => widensPart(member, contentType))
  );
};

// Whether a part of the body is widened: a property of the schema, or of an
// inline member of its composition, which the model reads as the parts.
const holdsWidenedPart = (
  schema: unknown,
  encoding: Record<string, { contentType?: string }>,
): boolean => {
  if (!isObject(schema) || getRef(schema) !== undefined) return false;
  const properties = isObject(schema.properties) ? schema.properties : {};
  return (
    Object.entries(properties).some(([part, property]) =>
      widensPart(property, encoding[part]?.contentType),
    ) ||
    alternativesOf(schema)
      .concat(membersOf(schema.allOf))
      .some((member) => holdsWidenedPart(member, encoding))
  );
};

// The components whose multipart body has a part that the model widens to a
// file, or a file or a string.
const encodedMultipartComponents = (context: ContextSpec): Set<string> => {
  const components: Record<string, unknown> =
    context.spec.components?.schemas ?? {};
  return new Set(
    [...getFormDataComponentContexts(context)]
      .filter(
        ([key, formData]) =>
          !formData.atPart &&
          holdsWidenedPart(components[key], formData.encoding),
      )
      .map(([key]) => key),
  );
};

export interface ModelTypeCheckSkipOptions {
  library: ModelTypeCheckLibrary;
  /** The name a component has in the models, for the reason of a skipped one. */
  nameOf: (key: string) => string;
  /**
   * The policy the library keeps references with. It tells which circular
   * references the library validates as unknown.
   */
  refPolicy?: RefPolicy;
  /**
   * Whether the Zod output is Zod 4 or Zod Mini, which is the default, and
   * not Zod 3. Zod 3 types some constructs differently.
   */
  isZodV4?: boolean;
}

/**
 * The reason to skip the check of each component whose generated schema is
 * looser or stricter than its model on purpose, by component key. A component
 * that references a skipped one is skipped too: its output type holds the
 * other's.
 */
export const getModelTypeCheckSkips = (
  context: ContextSpec,
  { library, nameOf, refPolicy, isZodV4 = true }: ModelTypeCheckSkipOptions,
): ReadonlyMap<string, string> => {
  const components: Record<string, unknown> =
    context.spec.components?.schemas ?? {};
  const site: ConstructSite = { context, library, isZodV4 };
  const skips = new Map<string, string>();
  const references = new Map<string, string[]>();
  const tuples = new Map<string, string[]>();
  const encoded = ENCODED_PART.libraries.includes(library)
    ? encodedMultipartComponents(context)
    : new Set<string>();

  for (const [key, schema] of Object.entries(components)) {
    const nodes = collectNodes(schema, context);
    references.set(key, referencedComponents(nodes));
    tuples.set(key, tupleReferences(nodes, context));
    const construct = LOOSE_CONSTRUCTS.find(
      ({ libraries, atRoot, isIn }) =>
        libraries.includes(library) &&
        nodes.some(
          ({ schema: node, role }, index) =>
            (!atRoot || index === 0) && isIn(node, site, role),
        ),
    );
    if (construct) {
      skips.set(key, construct.reason);
    } else if (encoded.has(key)) {
      skips.set(key, ENCODED_PART.reason);
    } else if (
      refPolicy &&
      CIRCULAR_REFERENCE.libraries.includes(library) &&
      replacesCircularReference(key, context, refPolicy)
    ) {
      skips.set(key, CIRCULAR_REFERENCE.reason);
    }
  }

  // A tuple that a reference cycle passes through is where Zod stops inlining.
  if (TUPLE_CYCLE.libraries.includes(library)) {
    for (const [key, targets] of tuples) {
      if (!skips.has(key) && reachesAgain(key, targets, references)) {
        skips.set(key, TUPLE_CYCLE.reason);
      }
    }
  }

  // A skip spreads to the components that reference it, one step per pass.
  for (let spread = true; spread;) {
    spread = false;
    for (const [key, referenced] of references) {
      if (skips.has(key)) continue;
      const target = referenced.find((other) => skips.has(other));
      if (target === undefined) continue;
      skips.set(key, `it references ${nameOf(target)}, which is skipped`);
      spread = true;
    }
  }
  return skips;
};
