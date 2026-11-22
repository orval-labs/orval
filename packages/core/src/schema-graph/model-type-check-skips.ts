import type { ContextSpec } from '../types';
import { isObject, isString } from '../utils/assertion';
import { isOctetStreamContentType } from '../utils/content-type';
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
  membersOf,
  stringList,
} from './schema-keys';

/** The schema libraries whose output `modelTypeChecks` compares to the models. */
export type ModelTypeCheckLibrary = 'valibot';

interface ConstructSite {
  context: ContextSpec;
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
// referenced schema into the property that references it.
const hasDefault = (schema: unknown, site: ConstructSite): boolean => {
  if (!isObject(schema)) return false;
  if (schema.default !== undefined) return true;
  if (getRef(schema) === undefined) return false;
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
// leaves untyped. That holds next to an `object` type too.
const holdsRequiredOnlyAlternative = (
  schema: Record<string, unknown>,
): boolean =>
  (hasKeys(schema.properties) || isObjectType(schema)) &&
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

// Whether the schema is an array of any kind, tuples included.
const isArrayLike = (schema: Record<string, unknown>): boolean =>
  isArraySchema(schema) ||
  schema.items !== undefined ||
  schema.prefixItems !== undefined;

// Whether the generated schema types the array's output as readonly, as the
// model does for a readOnly array: one with items and no prefixItems, unless
// `suppressReadonlyModifier` is on. The valibot generator adds `v.readonly()`
// on the same test.
const hasReadonlyOutput = (
  schema: Record<string, unknown>,
  { context }: ConstructSite,
): boolean =>
  schema.readOnly === true &&
  schema.items !== undefined &&
  schema.items !== false &&
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
    libraries: ['valibot'],
    isIn: holdsOptionalDefault,
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
    libraries: ['valibot'],
    isIn: (schema) =>
      hasKeys(schema.properties) && hasKeys(schema.additionalProperties),
  },
  {
    reason:
      'a schema without a type is validated as unknown, which the model types as {}',
    libraries: ['valibot'],
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
    reason: 'a const that is an object or an array is not validated',
    libraries: ['valibot'],
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
    reason: 'a const typed with null is typed without null by the model',
    libraries: ['valibot'],
    isIn: isNullableConst,
  },
  {
    reason:
      'a component of constants is a constant object in the model, with every key required',
    libraries: ['valibot'],
    atRoot: true,
    isIn: holdsOptionalConst,
  },
  {
    reason:
      'a null, nullable or enum alternative next to properties or allOf is merged by the model and intersected in the schema',
    libraries: ['valibot'],
    isIn: holdsNullOrEnumAlternative,
  },
  {
    reason:
      'an enum allOf member next to properties is an alternative in the model and intersected in the schema',
    libraries: ['valibot'],
    isIn: holdsEnumMember,
  },
  {
    reason:
      'an alternative that only requires keys is validated as an object with them, which the model types as unknown',
    libraries: ['valibot'],
    isIn: holdsRequiredOnlyAlternative,
  },
  {
    reason:
      'a 64-bit integer is a bigint in the model with useBigInt, and a number in the schema',
    libraries: ['valibot'],
    isIn: (schema, site) =>
      site.context.output.override.useBigInt === true && isBigInteger(schema),
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

export interface ModelTypeCheckSkipOptions {
  library: ModelTypeCheckLibrary;
  /** The name a component has in the models, for the reason of a skipped one. */
  nameOf: (key: string) => string;
  /**
   * The policy the library keeps references with. It tells which circular
   * references the library validates as unknown.
   */
  refPolicy?: RefPolicy;
}

/**
 * The reason to skip the check of each component whose generated schema is
 * looser or stricter than its model on purpose, by component key. A component
 * that references a skipped one is skipped too: its output type holds the
 * other's.
 */
export const getModelTypeCheckSkips = (
  context: ContextSpec,
  { library, nameOf, refPolicy }: ModelTypeCheckSkipOptions,
): ReadonlyMap<string, string> => {
  const components: Record<string, unknown> =
    context.spec.components?.schemas ?? {};
  const site: ConstructSite = { context };
  const skips = new Map<string, string>();
  const references = new Map<string, string[]>();

  for (const [key, schema] of Object.entries(components)) {
    const nodes = collectNodes(schema, context);
    references.set(key, referencedComponents(nodes));
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
    } else if (
      refPolicy &&
      CIRCULAR_REFERENCE.libraries.includes(library) &&
      replacesCircularReference(key, context, refPolicy)
    ) {
      skips.set(key, CIRCULAR_REFERENCE.reason);
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
