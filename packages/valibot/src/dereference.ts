import {
  type ContextSpec,
  dereference as coreDereference,
  type DereferenceOptions as CoreDereferenceOptions,
  isObject,
  isString,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  resolveRef,
  toObjectSchema,
} from '@orval/core';

import { followAliases, type ResolvedAlias, withoutRef } from './alias';
import { bareRef, memoizeByRef } from './component-memo';
import {
  countInlineNodes,
  createInlineBudget,
  type InlineBudget,
  inlineLimitError,
  MAX_INLINE_NODES,
} from './inline-budget';
import { lazy } from './lazy';
import { logger, warnOnce } from './logger';
import {
  declaredKeysOf,
  type Direction,
  mayCheckNothing,
  type RefPolicy,
  type RefSite,
} from './ref-policy';
import { isReusableSchemasEnabled } from './refs';
import {
  ANNOTATION_KEYS,
  COMPOSITION_KEYS,
  hasOnlyAnnotations,
  isCompositionKey,
  isDataKey,
  stringList,
} from './schema-keys';

const tryResolveRefSchema = (
  $ref: string,
  context: ContextSpec,
): OpenApiSchemaObject | undefined => {
  try {
    return resolveRef<OpenApiSchemaObject>({ $ref }, context).schema;
  } catch (error) {
    logger.verbose(
      `Failed to resolve $ref "${$ref}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }
};

const PLAIN_SITE: RefSite = {
  requiredKeys: new Set(),
  declaredKeys: new Set(),
  directionalKeys: { readOnly: new Set(), writeOnly: new Set() },
  mergesMembers: false,
  inAllOf: false,
  siblingDeclaredKeys: () => new Set(),
  narrowsOwnObject: false,
  hoistsNull: false,
  inUncheckedAllOf: false,
  inIntersection: false,
};

// The schema behind an alias component, merged with its siblings.
const resolveSelf = (
  schema: unknown,
  context: ContextSpec,
  followed: ReadonlySet<string>,
): ResolvedAlias =>
  followAliases(schema, (ref) => tryResolveRefSchema(ref, context), followed);

// The keys a schema requires itself and through its `allOf` members.
const requiredByComposition = (
  input: unknown,
  inherited: ReadonlySet<string>,
  context: ContextSpec,
  followedRefs: ReadonlySet<string> = new Set(),
  useMemo = true,
): ReadonlySet<string> => {
  const ref = useMemo ? bareRef(input, followedRefs) : undefined;
  if (ref !== undefined) {
    // The keys are a union, so a closure started afresh adds the same ones.
    const closure = memoizeByRef(context, `requiredByComposition:${ref}`, () =>
      requiredByComposition(input, new Set(), context, new Set(), false),
    );
    return new Set([...inherited, ...closure]);
  }
  const { schema, followed } = resolveSelf(input, context, followedRefs);
  if (!isObject(schema)) return inherited;
  const members: unknown[] = Array.isArray(schema.allOf) ? schema.allOf : [];
  return new Set([
    ...inherited,
    ...stringList(schema.required),
    ...members.flatMap((member) => [
      ...requiredByComposition(member, new Set(), context, followed),
    ]),
  ]);
};

const hasUncheckedMember = (
  schema: Record<string, unknown>,
  context: ContextSpec,
): boolean =>
  Array.isArray(schema.allOf) &&
  schema.allOf.some((member: unknown) => mayCheckNothing(member, context));

// Keywords that add nothing to what a schema checks.
const NON_CHECKING_KEYS: ReadonlySet<string> = new Set([
  ...ANNOTATION_KEYS,
  ...COMPOSITION_KEYS,
  'discriminator',
  'required',
]);

// Whether a schema checks anything next to its own composition, or has
// several groups, so that its members are intersected with something.
const intersectsWithSiblings = (schema: Record<string, unknown>): boolean =>
  hasSeveralGroups(schema) ||
  Object.entries(schema).some(
    ([name, value]) =>
      value !== undefined &&
      !NON_CHECKING_KEYS.has(name) &&
      !name.startsWith('x-'),
  );

// Groups of one schema are intersected, so their members are merged.
const hasSeveralGroups = (schema: Record<string, unknown>): boolean =>
  COMPOSITION_KEYS.filter((key) => Array.isArray(schema[key])).length > 1;

// Whether a property carries the flag itself or through the alias component
// it references.
const hasFlag = (
  property: unknown,
  direction: Direction,
  context: ContextSpec,
): boolean => {
  const { schema } = resolveSelf(property, context, new Set());
  return isObject(schema) && schema[direction] === true;
};

// The property names a schema declares with the direction flag, in its own
// properties and in its composition members, referenced ones included.
const directionalKeysOf = (
  input: unknown,
  direction: Direction,
  context: ContextSpec,
  followedRefs: ReadonlySet<string> = new Set(),
  useMemo = true,
): string[] => {
  const ref = useMemo ? bareRef(input, followedRefs) : undefined;
  if (ref !== undefined) {
    const closure = memoizeByRef(
      context,
      `${direction}:${ref}`,
      () =>
        new Set(directionalKeysOf(input, direction, context, new Set(), false)),
    );
    return [...closure];
  }
  const { schema, followed } = resolveSelf(input, context, followedRefs);
  if (!isObject(schema)) return [];
  const properties = isObject(schema.properties) ? schema.properties : {};
  const own = Object.entries(properties)
    .filter(([, property]) => hasFlag(property, direction, context))
    .map(([name]) => name);
  const members = COMPOSITION_KEYS.flatMap((key): unknown[] => {
    const value = schema[key];
    return Array.isArray(value) ? value : [];
  });
  return [
    ...own,
    ...members.flatMap((member) =>
      directionalKeysOf(member, direction, context, followed),
    ),
  ];
};

// Only the direction the policy reads is collected.
const withDirectionalKeys = (
  schema: Record<string, unknown>,
  inherited: RefSite['directionalKeys'],
  direction: Direction | undefined,
  context: ContextSpec,
): RefSite['directionalKeys'] =>
  direction
    ? {
        ...inherited,
        [direction]: new Set([
          ...inherited[direction],
          ...directionalKeysOf(schema, direction, context),
        ]),
      }
    : inherited;

// What a walk shares: the context, the refs it keeps and its node budget.
interface Walk {
  context: ContextSpec;
  policy: RefPolicy;
  budget: InlineBudget;
}

const dereferenceValue = (value: unknown, walk: Walk): unknown => {
  if (isObject(value)) {
    return dereferenceObject(value, walk, PLAIN_SITE);
  }
  return Array.isArray(value)
    ? value.map((item: unknown) => dereferenceValue(item, walk))
    : value;
};

const dereferenceEntries = (
  schema: Record<string, unknown>,
  walk: Walk,
  site: RefSite,
): [string, unknown][] => {
  // What the members share, whichever composition they belong to. It is
  // computed once for the schema, when its first composition asks.
  const shared = lazy(() => ({
    requiredKeys: requiredByComposition(
      schema,
      site.requiredKeys,
      walk.context,
    ),
    declaredKeys: new Set([
      ...site.declaredKeys,
      ...(isObject(schema.properties) ? Object.keys(schema.properties) : []),
    ]),
    directionalKeys: withDirectionalKeys(
      schema,
      site.directionalKeys,
      walk.policy.direction,
      walk.context,
    ),
    hasOwnProperties: isObject(schema.properties),
    hasSeveralGroups: hasSeveralGroups(schema),
    intersectsWithSiblings: intersectsWithSiblings(schema),
  }));
  const hasUnchecked = lazy(() => hasUncheckedMember(schema, walk.context));
  const memberSite = (key: string, siblings: unknown[]): RefSite => {
    const facts = shared();
    const alternativeOfOwnObject = key !== 'allOf' && facts.hasOwnProperties;
    return {
      requiredKeys: facts.requiredKeys,
      declaredKeys: facts.declaredKeys,
      directionalKeys: facts.directionalKeys,
      mergesMembers:
        site.mergesMembers ||
        key === 'allOf' ||
        facts.hasOwnProperties ||
        facts.hasSeveralGroups,
      inAllOf: key === 'allOf',
      siblingDeclaredKeys: lazy(() =>
        key === 'allOf'
          ? declaredKeysOf(siblings, walk.context)
          : new Set<string>(),
      ),
      narrowsOwnObject: alternativeOfOwnObject,
      hoistsNull:
        site.hoistsNull || (key !== 'allOf' && facts.intersectsWithSiblings),
      inUncheckedAllOf: key === 'allOf' && hasUnchecked(),
      inIntersection:
        site.inIntersection || key === 'allOf' || facts.intersectsWithSiblings,
    };
  };
  return Object.entries(schema).map(([key, value]) => {
    if (key === 'properties' && isObject(value)) {
      return [
        key,
        Object.fromEntries(
          Object.entries(value).map(([name, property]) => [
            name,
            dereferenceValue(property, walk),
          ]),
        ),
      ];
    }
    if (isCompositionKey(key) && Array.isArray(value)) {
      return [
        key,
        value.map((member: unknown) =>
          isObject(member)
            ? dereferenceObject(
                member,
                walk,
                memberSite(
                  key,
                  value.filter((other: unknown) => other !== member),
                ),
              )
            : member,
        ),
      ];
    }
    return [key, isDataKey(key) ? value : dereferenceValue(value, walk)];
  });
};

// The entries are rebuilt from a JSON document, so the compiler cannot see
// that the result is still a schema.
const toSchema = (
  entries: [string, unknown][],
): OpenApiNonBooleanSchemaObject =>
  Object.fromEntries(entries) as OpenApiNonBooleanSchemaObject;

const dereferenceObject = (
  schema: Record<string, unknown>,
  walk: Walk,
  site: RefSite,
): OpenApiNonBooleanSchemaObject => {
  const { context, policy, budget } = walk;
  budget.spend(context.parents);
  const refName = isString(schema.$ref) ? schema.$ref : undefined;

  // Only annotations can sit next to a kept reference: any other sibling
  // changes the schema it stands for.
  if (refName && policy(refName, site) && hasOnlyAnnotations(schema)) {
    return toSchema([
      ...dereferenceEntries(withoutRef(schema), walk, site),
      ['$ref', refName],
    ]);
  }

  if (refName && context.parents?.includes(refName)) {
    warnOnce(`Circular $ref "${refName}" is validated as unknown.`);
    return {};
  }

  const resolvedContext: ContextSpec = {
    ...context,
    ...(refName
      ? { parents: [...(context.parents ?? []), refName] }
      : undefined),
  };

  const resolveReferenced = (
    name: string,
  ): Record<string, unknown> | undefined => {
    const referenced = tryResolveRefSchema(name, context);
    if (typeof referenced !== 'boolean' && !isObject(referenced)) {
      warnOnce(`Unresolvable $ref "${name}" is validated as unknown.`);
      return;
    }
    return { ...toObjectSchema(referenced), ...withoutRef(schema) };
  };

  const resolved = refName ? resolveReferenced(refName) : schema;
  if (!resolved) return {};

  return toSchema(
    dereferenceEntries(resolved, { ...walk, context: resolvedContext }, site),
  );
};

export interface DereferenceOptions {
  // Where the schema is used, named in the error of an expansion that is too
  // large.
  label?: string;
  // The most schema nodes the inlining may produce.
  limit?: number;
}

const coreOptions: CoreDereferenceOptions = {
  keepBooleanProperties: true,
  keepSiblingsOfBooleanTarget: true,
  keepProtoKey: true,
  ignoreEmptyRef: true,
  isVerbatimKey: isDataKey,
  onCircularRef: (ref) =>
    warnOnce(`Circular $ref "${ref}" is validated as unknown.`),
  onUnresolvedRef: (ref) =>
    warnOnce(`Unresolvable $ref "${ref}" is validated as unknown.`),
  onResolveError: (message) => logger.verbose(message),
};

/**
 * Inlines every `$ref` the policy does not keep. A circular `$ref` becomes an
 * empty schema. An expansion past the node limit fails instead of exhausting
 * the heap.
 *
 * The result may share nested objects between calls, so treat it as read-only.
 */
export const dereference = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  policy?: RefPolicy,
  { label = 'a schema', limit = MAX_INLINE_NODES }: DereferenceOptions = {},
): OpenApiNonBooleanSchemaObject => {
  const suggestReusable = !isReusableSchemasEnabled(context);
  const budget = createInlineBudget({ limit, label, suggestReusable });
  if (!policy) {
    // The budget stops an expansion while it runs. The count afterwards covers
    // what the cached expansions shared between uses hide from it.
    const expanded =
      typeof schema === 'boolean' || isObject(schema)
        ? coreDereference(schema, context, coreOptions, budget.spend)
        : {};
    if (countInlineNodes(expanded) > limit) {
      throw inlineLimitError({
        limit,
        label,
        suggestReusable,
        ref:
          isObject(schema) && isString(schema.$ref) ? schema.$ref : undefined,
      });
    }
    return expanded;
  }
  if (typeof schema === 'boolean') return toObjectSchema(schema);
  return isObject(schema)
    ? dereferenceObject(schema, { context, policy, budget }, PLAIN_SITE)
    : {};
};
