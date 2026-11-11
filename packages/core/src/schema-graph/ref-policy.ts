import { getCustomFormatType, isDateFormatType } from '../getters/scalar';
import type { ContextSpec, OpenApiSchemaObject } from '../types';
import { isObject, isSchemaNullable, isString } from '../utils/assertion';
import { followAliases, type ResolvedAlias, withoutRef } from './alias';
import { memoizedKeyListOfRef } from './component-memo';
import { lazy } from './lazy';
import {
  getComponentKey,
  getComponentSchema,
  getLocalRefTarget,
  getRef,
  getRootComponentKey,
} from './refs';
import {
  compositionMembers,
  hasOnlyAnnotations,
  isDataKey,
  membersOf,
  stringList,
} from './schema-keys';

export type SchemaDirection = 'readOnly' | 'writeOnly';

/** Where a `$ref` sits in the schema being walked. */
export interface RefSite {
  // Keys the enclosing compositions require.
  requiredKeys: ReadonlySet<string>;
  // Keys the enclosing schemas declare as properties of their own.
  declaredKeys: ReadonlySet<string>;
  // Keys the enclosing compositions declare with a readOnly or writeOnly flag.
  directionalKeys: Record<SchemaDirection, ReadonlySet<string>>;
  // Whether the member is merged with sibling members or properties, which a
  // strict object would reject.
  mergesMembers: boolean;
  // Whether the member is a direct `allOf` member, whose `required` is left
  // to the parent.
  inAllOf: boolean;
  // Whether another member of the same `allOf` declares the key as a property.
  siblingDeclares: (key: string) => boolean;
  // Whether the member is a `oneOf` or `anyOf` alternative of a schema with
  // properties of its own, where a required-only alternative narrows them.
  narrowsOwnObject: boolean;
  // Whether a nullable member would make the enclosing inlined schema nullable.
  hoistsNull: boolean;
  // Whether the member's `allOf` has a member that checks nothing, which
  // inlining drops from the intersection.
  inUncheckedAllOf: boolean;
  // Whether the member is rendered, at any depth of inlined compositions,
  // inside an intersection.
  inIntersection: boolean;
}

/** Decides whether a `$ref` stays a reference instead of being inlined. */
export interface RefPolicy {
  (ref: string, site: RefSite): boolean;
  // The direction whose flagged keys the policy reads from the site.
  direction?: SchemaDirection;
}

interface SchemaFacts {
  refs: string[];
  hasDirection: Record<SchemaDirection, boolean>;
}

// Every `$ref` and direction flag found in a schema, without following refs.
const scanSchema = (schema: unknown): SchemaFacts => {
  const facts: SchemaFacts = {
    refs: [],
    hasDirection: { readOnly: false, writeOnly: false },
  };
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!isObject(value)) return;
    const ref = getRef(value);
    if (ref) facts.refs.push(ref);
    if (value.readOnly === true) facts.hasDirection.readOnly = true;
    if (value.writeOnly === true) facts.hasDirection.writeOnly = true;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'properties' && isObject(child)) {
        // Property names are not keywords, whatever they are called.
        for (const property of Object.values(child)) walk(property);
      } else if (!isDataKey(key)) {
        walk(child);
      }
    }
  };
  walk(schema);
  return facts;
};

// Like scanSchema, but also scans what local refs outside the components
// point at, since those are inlined into the component that uses them.
const scanReachable = (schema: unknown, context: ContextSpec): SchemaFacts => {
  const seen = new Set<string>();
  const facts: SchemaFacts = {
    refs: [],
    hasDirection: { readOnly: false, writeOnly: false },
  };
  const visit = (value: unknown): void => {
    const found = scanSchema(value);
    facts.refs.push(...found.refs);
    facts.hasDirection.readOnly ||= found.hasDirection.readOnly;
    facts.hasDirection.writeOnly ||= found.hasDirection.writeOnly;
    for (const ref of found.refs) {
      if (getRootComponentKey(ref) !== undefined || seen.has(ref)) continue;
      seen.add(ref);
      visit(getLocalRefTarget(ref, context));
    }
  };
  visit(schema);
  return facts;
};

const reachingCache = new WeakMap<object, Map<SchemaDirection, Set<string>>>();

// Component keys whose schema, or one it references, carries the direction.
const computeReaching = (
  context: ContextSpec,
  direction: SchemaDirection,
): Set<string> => {
  const schemas = context.spec.components?.schemas ?? {};
  const referrers = new Map<string, string[]>();
  const pending: string[] = [];
  const reaching = new Set<string>();

  for (const [key, schema] of Object.entries(schemas)) {
    const facts = scanReachable(schema, context);
    if (facts.hasDirection[direction]) {
      reaching.add(key);
      pending.push(key);
    }
    for (const ref of facts.refs) {
      // A reference into a component reaches whatever the component reaches.
      const target = getRootComponentKey(ref);
      if (target !== undefined) {
        const known = referrers.get(target);
        if (known) known.push(key);
        else referrers.set(target, [key]);
      }
    }
  }

  for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
    for (const referrer of referrers.get(key) ?? []) {
      if (!reaching.has(referrer)) {
        reaching.add(referrer);
        pending.push(referrer);
      }
    }
  }
  return reaching;
};

/** Whether a component, or one it references, carries the direction flag. */
export const reachesDirection = (
  ref: string,
  context: ContextSpec,
  direction: SchemaDirection,
): boolean => {
  const key = getComponentKey(ref);
  if (key === undefined) return false;
  const byDirection =
    reachingCache.get(context.spec) ?? new Map<SchemaDirection, Set<string>>();
  reachingCache.set(context.spec, byDirection);
  const reaching =
    byDirection.get(direction) ?? computeReaching(context, direction);
  byDirection.set(direction, reaching);
  return reaching.has(key);
};

// What a `$ref` points at: a component, or any other local target, which
// inlining follows as well.
const getRefTarget = (ref: string, context: ContextSpec): unknown =>
  getComponentSchema(ref, context) ?? getLocalRefTarget(ref, context);

// The schema behind an alias component, merged with its siblings.
export const resolveSelf = (
  schema: unknown,
  context: ContextSpec,
  followed: ReadonlySet<string>,
): ResolvedAlias =>
  followAliases(schema, (ref) => getRefTarget(ref, context), followed);

/**
 * Tells, for each member, whether another member declares a key as a
 * property. The members are indexed once, so asking costs the same however
 * many there are.
 */
export const siblingDeclarations = (
  members: readonly unknown[],
  context: ContextSpec,
): ((index: number) => (key: string) => boolean) => {
  const own = members.map((member) => new Set(declaredKeys(member, context)));
  const declaring = new Map<string, number>();
  for (const keys of own) {
    for (const key of keys) declaring.set(key, (declaring.get(key) ?? 0) + 1);
  }
  return (index) => (key) =>
    (declaring.get(key) ?? 0) - (own[index]?.has(key) ? 1 : 0) > 0;
};

// Keys declared as properties anywhere in the composition.
const declaredKeys = (
  input: unknown,
  context: ContextSpec,
  followedRefs: ReadonlySet<string> = new Set(),
  useMemo = true,
): string[] => {
  const memoized = useMemo
    ? memoizedKeyListOfRef(context, 'declared', input, followedRefs, (bare) =>
        declaredKeys(bare, context, new Set(), false),
      )
    : undefined;
  if (memoized) return memoized;
  const { schema, followed } = resolveSelf(input, context, followedRefs);
  if (!isObject(schema)) return [];
  return [
    ...(isObject(schema.properties) ? Object.keys(schema.properties) : []),
    ...compositionMembers(schema).flatMap((member) =>
      declaredKeys(member, context, followed),
    ),
  ];
};

// Keys the schema requires itself, or through its `allOf` members.
export const requiredKeys = (
  input: unknown,
  context: ContextSpec,
  followedRefs: ReadonlySet<string> = new Set(),
  useMemo = true,
): string[] => {
  const memoized = useMemo
    ? memoizedKeyListOfRef(
        context,
        'requiredKeys',
        input,
        followedRefs,
        (bare) => requiredKeys(bare, context, new Set(), false),
      )
    : undefined;
  if (memoized) return memoized;
  const { schema, followed } = resolveSelf(input, context, followedRefs);
  if (!isObject(schema)) return [];
  return [
    ...stringList(schema.required),
    ...membersOf(schema.allOf).flatMap((member) =>
      requiredKeys(member, context, followed),
    ),
  ];
};

// Keys the schema requires itself or through any of its members, whichever
// alternative or intersection they sit in.
const requiredKeysAnywhere = (
  input: unknown,
  context: ContextSpec,
  followedRefs: ReadonlySet<string> = new Set(),
  useMemo = true,
): string[] => {
  const memoized = useMemo
    ? memoizedKeyListOfRef(
        context,
        'requiredAnywhere',
        input,
        followedRefs,
        (bare) => requiredKeysAnywhere(bare, context, new Set(), false),
      )
    : undefined;
  if (memoized) return memoized;
  const { schema, followed } = resolveSelf(input, context, followedRefs);
  if (!isObject(schema)) return [];
  return [
    ...stringList(schema.required),
    ...compositionMembers(schema).flatMap((member) =>
      requiredKeysAnywhere(member, context, followed),
    ),
  ];
};

// Whether the schema or a member accepts null. Inlining makes the parent
// nullable then, which a reference cannot do. `seen` skips repeat visits.
const mayAcceptNull = (
  input: unknown,
  context: ContextSpec,
  followedRefs: ReadonlySet<string> = new Set(),
  seen: Set<unknown> = new Set(),
): boolean => {
  if (seen.has(input)) return false;
  seen.add(input);
  const { schema, followed } = resolveSelf(input, context, followedRefs);
  if (!isObject(schema)) return false;
  if (isSchemaNullable(schema)) return true;
  return compositionMembers(schema).some((member) =>
    mayAcceptNull(member, context, followed, seen),
  );
};

// A false answer ends the query, so a ref met again can only have been true.
interface NothingWalk {
  context: ContextSpec;
  seen: Set<string>;
  // Refs whose target is being read together with siblings. Such a read says
  // nothing about the target alone, so it stays out of `seen`.
  merging: Set<string>;
  // How often an answer was assumed true because a ref was met again.
  assumed: number;
}

// Answers that hold whatever query asks, per spec.
const checksNothingCache = new WeakMap<object, Map<string, boolean>>();

const knownChecksNothing = (context: ContextSpec): Map<string, boolean> => {
  const known =
    checksNothingCache.get(context.spec) ?? new Map<string, boolean>();
  checksNothingCache.set(context.spec, known);
  return known;
};

const refChecksNothing = (target: string, walk: NothingWalk): boolean => {
  if (walk.seen.has(target)) {
    walk.assumed++;
    return true;
  }
  const known = knownChecksNothing(walk.context).get(target);
  if (known !== undefined) return known;
  walk.seen.add(target);
  const referenced = getComponentSchema(target, walk.context);
  return referenced === undefined || schemaChecksNothing(referenced, walk);
};

// Answers for references with siblings, per spec and reference object.
const mergedCache = new WeakMap<object, WeakMap<object, boolean>>();

const knownMerged = (context: ContextSpec): WeakMap<object, boolean> => {
  const known = mergedCache.get(context.spec) ?? new WeakMap();
  mergedCache.set(context.spec, known);
  return known;
};

// A reference with siblings stands for its target merged with them.
const mergedChecksNothing = (
  schema: Record<string, unknown>,
  target: string,
  walk: NothingWalk,
): boolean => {
  if (walk.merging.has(target)) {
    walk.assumed++;
    return true;
  }
  const referenced = getRefTarget(target, walk.context);
  if (!isObject(referenced)) return true;
  const known = knownMerged(walk.context);
  const cached = known.get(schema);
  if (cached !== undefined) return cached;
  const assumedBefore = walk.assumed;
  walk.merging.add(target);
  try {
    const result = schemaChecksNothing(
      { ...referenced, ...withoutRef(schema) },
      walk,
    );
    // A false answer found structure, whatever was assumed on the way. A true
    // one holds on its own only when nothing in it was assumed.
    if (!result || walk.assumed === assumedBefore) known.set(schema, result);
    return result;
  } finally {
    walk.merging.delete(target);
  }
};

const schemaChecksNothing = (schema: unknown, walk: NothingWalk): boolean => {
  if (!isObject(schema)) return true;
  const target = getRef(schema);
  if (target !== undefined) {
    return hasOnlyAnnotations(schema)
      ? refChecksNothing(target, walk)
      : mergedChecksNothing(schema, target, walk);
  }
  const { type, properties, additionalProperties } = schema;
  const isObjectType =
    type === undefined ||
    type === 'object' ||
    (Array.isArray(type) && type.every((t) => t === 'object' || t === 'null'));
  const allOf = membersOf(schema.allOf);
  const hasStructure =
    membersOf(schema.oneOf).length > 0 ||
    membersOf(schema.anyOf).length > 0 ||
    allOf.some((member) => !schemaChecksNothing(member, walk)) ||
    (isObject(properties) && Object.keys(properties).length > 0) ||
    schema.enum !== undefined ||
    schema.const !== undefined ||
    additionalProperties === false ||
    (isObject(additionalProperties) &&
      !schemaChecksNothing(additionalProperties, walk));
  return isObjectType && !hasStructure;
};

// Whether a schema may generate a member that checks nothing, which inlining
// drops from an `allOf`.
export const mayCheckNothing = (
  schema: unknown,
  context: ContextSpec,
): boolean => {
  const walk: NothingWalk = {
    context,
    seen: new Set(),
    merging: new Set(),
    assumed: 0,
  };
  const result = schemaChecksNothing(schema, walk);
  // Every ref a true query met was true, while a false one says that of its
  // start only.
  const known = knownChecksNothing(context);
  const target = getRef(schema);
  if (result) {
    for (const ref of walk.seen) known.set(ref, true);
  } else if (
    target !== undefined &&
    isObject(schema) &&
    hasOnlyAnnotations(schema)
  ) {
    known.set(target, false);
  }
  return result;
};

// Whether the schema or a member is a string transformed into a Date or into
// a `formatType` type.
const carriesTransform = (
  input: unknown,
  context: ContextSpec,
  followedRefs: ReadonlySet<string> = new Set(),
  seen: Set<unknown> = new Set(),
): boolean => {
  if (seen.has(input)) return false;
  seen.add(input);
  const { schema, followed } = resolveSelf(input, context, followedRefs);
  if (!isObject(schema)) return false;
  const { override } = context.output;
  const isTransformed =
    (schema.type === 'string' &&
      isString(schema.format) &&
      isDateFormatType(schema.format, override)) ||
    getCustomFormatType(schema, override) !== undefined;
  return (
    isTransformed ||
    compositionMembers(schema).some((member) =>
      carriesTransform(member, context, followed, seen),
    )
  );
};

// Whether the schema, behind aliases, has a default that fills a missing value.
const hasDefault = (input: unknown, context: ContextSpec): boolean => {
  const { schema } = resolveSelf(input, context, new Set());
  return isObject(schema) && schema.default !== undefined;
};

// Whether the schema is an alias whose siblings change what it accepts.
export const carriesSiblings = (schema: unknown): boolean =>
  isObject(schema) &&
  getRef(schema) !== undefined &&
  !hasOnlyAnnotations(schema);

// What a policy asks of a component, each computed on first use.
export interface ComponentFacts {
  checksNothing: () => boolean;
  requiredKeys: () => string[];
  requiredKeysAnywhere: () => string[];
  declaredKeys: () => Set<string>;
  acceptsNull: () => boolean;
  hasDefault: () => boolean;
  hasTransform: () => boolean;
}

const createComponentFacts = (
  schema: OpenApiSchemaObject,
  context: ContextSpec,
): ComponentFacts => ({
  checksNothing: lazy(() => mayCheckNothing(schema, context)),
  requiredKeys: lazy(() => requiredKeys(schema, context)),
  requiredKeysAnywhere: lazy(() => requiredKeysAnywhere(schema, context)),
  declaredKeys: lazy(() => new Set(declaredKeys(schema, context))),
  acceptsNull: lazy(() => mayAcceptNull(schema, context)),
  hasDefault: lazy(() => hasDefault(schema, context)),
  hasTransform: lazy(() => carriesTransform(schema, context)),
});

const factsCache = new WeakMap<object, Map<string, ComponentFacts>>();

// The facts depend on useDates and the formatType formats, which differ between
// outputs of one spec.
const factsKey = (ref: string, context: ContextSpec): string => {
  const { useDates, formatType } = context.output.override;
  return JSON.stringify([
    useDates === true,
    Object.keys(formatType ?? {}).toSorted(),
    ref,
  ]);
};

/** The facts of a component, cached per spec and output settings. */
export const getComponentFacts = (
  ref: string,
  schema: OpenApiSchemaObject,
  context: ContextSpec,
): ComponentFacts => {
  const byRef =
    factsCache.get(context.spec) ?? new Map<string, ComponentFacts>();
  factsCache.set(context.spec, byRef);
  const key = factsKey(ref, context);
  const facts = byRef.get(key) ?? createComponentFacts(schema, context);
  byRef.set(key, facts);
  return facts;
};

// A referenced schema cannot be made to require a key its own constant leaves
// optional, so a member whose declared key the composition requires is inlined.
export const needsRequiredKeys = (
  facts: ComponentFacts,
  required: ReadonlySet<string>,
): boolean => {
  if (required.size === 0) return false;
  const covered = new Set(facts.requiredKeys());
  return [...facts.declaredKeys()].some(
    (key) => required.has(key) && !covered.has(key),
  );
};

// Whether the schema requires a key that neither it nor its members declare.
export const requiresUndeclaredKey = (facts: ComponentFacts): boolean => {
  const declared = facts.declaredKeys();
  return facts.requiredKeys().some((key) => !declared.has(key));
};
