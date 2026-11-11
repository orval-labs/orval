import { dereference as coreDereference } from '../resolvers/dereference/dereference';
import type { DereferenceOptions as CoreDereferenceOptions } from '../resolvers/dereference/types';
import { resolveRef } from '../resolvers/ref';
import type {
  ContextSpec,
  OpenApiNonBooleanSchemaObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { isObject, isString } from '../utils/assertion';
import { toObjectSchema } from '../utils/object-schema';
import { withoutRef } from './alias';
import { memoizedKeyListOfRef } from './component-memo';
import {
  countInlineNodes,
  createInlineBudget,
  type InlineBudget,
  inlineLimitError,
  MAX_INLINE_NODES,
} from './inline-budget';
import { lazy } from './lazy';
import {
  type SchemaDirection,
  mayCheckNothing,
  type RefPolicy,
  type RefSite,
  requiredKeys,
  resolveSelf,
  siblingDeclarations,
} from './ref-policy';
import {
  ANNOTATION_KEYS,
  COMPOSITION_KEYS,
  type CompositionKey,
  compositionMembers,
  hasOnlyAnnotations,
  isCompositionKey,
  isDataKey,
  membersOf,
} from './schema-keys';

/** How a schema library reports what a walk runs into. */
export interface SchemaWalkReporter {
  // Package named in errors and options, such as `valibot`.
  library: string;
  // Called for every warning; the library shows each message once.
  warn: (message: string) => void;
  verbose: (message: string) => void;
}

const tryResolveRefSchema = (
  $ref: string,
  context: ContextSpec,
  reporter: SchemaWalkReporter,
): OpenApiSchemaObject | undefined => {
  try {
    return resolveRef<OpenApiSchemaObject>({ $ref }, context).schema;
  } catch (error) {
    reporter.verbose(
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
  siblingDeclares: () => false,
  narrowsOwnObject: false,
  hoistsNull: false,
  inUncheckedAllOf: false,
  inIntersection: false,
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
  direction: SchemaDirection,
  context: ContextSpec,
): boolean => {
  const { schema } = resolveSelf(property, context, new Set());
  return isObject(schema) && schema[direction] === true;
};

// The property names a schema declares with the direction flag, in its own
// properties and in its composition members, referenced ones included.
const directionalKeysOf = (
  input: unknown,
  direction: SchemaDirection,
  context: ContextSpec,
  followedRefs: ReadonlySet<string> = new Set(),
  useMemo = true,
): string[] => {
  const memoized = useMemo
    ? memoizedKeyListOfRef(context, direction, input, followedRefs, (bare) =>
        directionalKeysOf(bare, direction, context, new Set(), false),
      )
    : undefined;
  if (memoized) return memoized;
  const { schema, followed } = resolveSelf(input, context, followedRefs);
  if (!isObject(schema)) return [];
  const properties = isObject(schema.properties) ? schema.properties : {};
  const own = Object.entries(properties)
    .filter(([, property]) => hasFlag(property, direction, context))
    .map(([name]) => name);
  return [
    ...own,
    ...compositionMembers(schema).flatMap((member) =>
      directionalKeysOf(member, direction, context, followed),
    ),
  ];
};

// Only the direction the policy reads is collected.
const withDirectionalKeys = (
  schema: Record<string, unknown>,
  inherited: RefSite['directionalKeys'],
  direction: SchemaDirection | undefined,
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
  reporter: SchemaWalkReporter;
  // Whether a default fills the value being walked.
  underDefault: boolean;
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
    requiredKeys: new Set([
      ...site.requiredKeys,
      ...requiredKeys(schema, walk.context),
    ]),
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
  // Indexed on first use over the members of every composition, since a key
  // required by one reaches the members of the others.
  const siblings = lazy(() =>
    siblingDeclarations(compositionMembers(schema), walk.context),
  );
  const offsetOf = (key: CompositionKey): number =>
    COMPOSITION_KEYS.slice(0, COMPOSITION_KEYS.indexOf(key)).reduce(
      (total, earlier) => total + membersOf(schema[earlier]).length,
      0,
    );
  const memberSite = (
    key: string,
    siblingDeclares: RefSite['siblingDeclares'],
  ): RefSite => {
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
      siblingDeclares,
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
      const offset = offsetOf(key);
      return [
        key,
        value.map((member: unknown, index) =>
          isObject(member)
            ? dereferenceObject(
                member,
                walk,
                memberSite(
                  key,
                  key === 'allOf'
                    ? (name) => siblings()(offset + index)(name)
                    : () => false,
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
  const { context, policy, budget, reporter } = walk;
  budget.spend(context.parents);
  const refName = isString(schema.$ref) ? schema.$ref : undefined;

  // Only annotations can sit next to a kept reference: any other sibling
  // changes the schema it stands for. A default is fed back through the
  // references under it, which loops when one closes a cycle, so they are
  // inlined.
  if (
    refName &&
    !walk.underDefault &&
    schema.default === undefined &&
    policy(refName, site) &&
    hasOnlyAnnotations(schema)
  ) {
    return toSchema([
      ...dereferenceEntries(withoutRef(schema), walk, site),
      ['$ref', refName],
    ]);
  }

  if (refName && context.parents?.includes(refName)) {
    reporter.warn(`Circular $ref "${refName}" is validated as unknown.`);
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
    const referenced = tryResolveRefSchema(name, context, reporter);
    if (typeof referenced !== 'boolean' && !isObject(referenced)) {
      reporter.warn(`Unresolvable $ref "${name}" is validated as unknown.`);
      return;
    }
    return { ...toObjectSchema(referenced), ...withoutRef(schema) };
  };

  const resolved = refName ? resolveReferenced(refName) : schema;
  if (!resolved) return {};

  return toSchema(
    dereferenceEntries(
      resolved,
      {
        ...walk,
        context: resolvedContext,
        underDefault: walk.underDefault || resolved.default !== undefined,
      },
      site,
    ),
  );
};

export interface PolicyDereferenceOptions {
  // Where the schema is used, named in the error of an expansion that is too
  // large.
  label?: string;
  // The most schema nodes the inlining may produce.
  limit?: number;
  // Whether generating reusable schemas would shorten an expansion that is
  // too large.
  suggestReusable: boolean;
  reporter: SchemaWalkReporter;
}

const buildCoreOptions = (
  reporter: SchemaWalkReporter,
): CoreDereferenceOptions => ({
  keepBooleanProperties: true,
  keepSiblingsOfBooleanTarget: true,
  keepProtoKey: true,
  ignoreEmptyRef: true,
  isVerbatimKey: isDataKey,
  onCircularRef: (ref) =>
    reporter.warn(`Circular $ref "${ref}" is validated as unknown.`),
  onUnresolvedRef: (ref) =>
    reporter.warn(`Unresolvable $ref "${ref}" is validated as unknown.`),
  onResolveError: (message) => reporter.verbose(message),
});

// The core expansion cache is keyed by the options object, so each reporter
// keeps one to share expansions between calls.
const optionsByReporter = new WeakMap<
  SchemaWalkReporter,
  CoreDereferenceOptions
>();

const coreOptions = (reporter: SchemaWalkReporter): CoreDereferenceOptions => {
  const known = optionsByReporter.get(reporter);
  if (known) return known;
  const created = buildCoreOptions(reporter);
  optionsByReporter.set(reporter, created);
  return created;
};

/**
 * Inlines every `$ref` the policy does not keep. A circular `$ref` becomes an
 * empty schema. An expansion past the node limit fails instead of exhausting
 * the heap.
 *
 * The result may share nested objects between calls, so treat it as read-only.
 */
export const dereferenceWithPolicy = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  policy: RefPolicy | undefined,
  {
    label = 'a schema',
    limit = MAX_INLINE_NODES,
    suggestReusable,
    reporter,
  }: PolicyDereferenceOptions,
): OpenApiNonBooleanSchemaObject => {
  const { library } = reporter;
  const budget = createInlineBudget({ library, limit, label, suggestReusable });
  if (!policy) {
    // The budget stops an expansion while it runs. The count afterwards covers
    // what the cached expansions shared between uses hide from it.
    const expanded =
      typeof schema === 'boolean' || isObject(schema)
        ? coreDereference(schema, context, coreOptions(reporter), budget.spend)
        : {};
    if (countInlineNodes(expanded) > limit) {
      throw inlineLimitError({
        library,
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
    ? dereferenceObject(
        schema,
        { context, policy, budget, reporter, underDefault: false },
        PLAIN_SITE,
      )
    : {};
};
