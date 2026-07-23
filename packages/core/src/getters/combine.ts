import { isNullish, prop, unique } from 'remeda';

import { resolveExampleRefs, resolveObject } from '../resolvers';
import {
  type ContextSpec,
  EnumGeneration,
  type GeneratorImport,
  type GeneratorSchema,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  type ScalarValue,
  SchemaType,
} from '../types';
import {
  dedupeUnionType,
  getNumberWord,
  isObject,
  isReference,
  isSchema,
  pascal,
} from '../utils';
import { getCombinedEnumValue } from './enum';
import { getAliasedImports, getImportAliasForRefOrValue } from './imports';
import type { FormDataContext } from './object';
import { getRefInfo, isComponentRef } from './ref';
import { getScalar } from './scalar';

interface CombinedData {
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  originalSchema: (OpenApiSchemaObject | undefined)[];
  values: string[];
  isRef: boolean[];
  isEnum: boolean[];
  types: string[];
  hasReadonlyProps: boolean;
  dependencies: string[];
  /**
   * List of all properties in all subschemas
   * - used to add missing properties in subschemas to avoid TS error described in @see https://github.com/orval-labs/orval/issues/935
   */
  allProperties: string[];
  requiredProperties: string[];
  example?: unknown;
  examples?: Record<string, unknown> | unknown[];
}

type Separator = 'allOf' | 'anyOf' | 'oneOf';
const mergeableAllOfKeys = new Set(['type', 'properties', 'required']);

function isMergeableAllOfObject(schema: OpenApiSchemaObject): boolean {
  // Must have properties to be worth merging
  if (isNullish(schema.properties)) {
    return false;
  }

  // Cannot merge if it contains nested composition
  if (schema.allOf || schema.anyOf || schema.oneOf) {
    return false;
  }

  // Only object types can be merged
  if (!isNullish(schema.type) && schema.type !== 'object') {
    return false;
  }

  // Only merge schemas with safe keys (type, properties, required)
  return Object.keys(schema).every((key) => mergeableAllOfKeys.has(key));
}

function normalizeAllOfSchema(
  schema: OpenApiSchemaObject,
): OpenApiSchemaObject {
  // Bridge assertions: AnyOtherAttribute infects all schema property access
  const schemaAllOf = schema.allOf as
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;
  if (!schemaAllOf) {
    return schema;
  }

  let didMerge = false;
  const schemaProperties = schema.properties as
    | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
    | undefined;
  const schemaRequired = schema.required as string[] | undefined;
  const mergedProperties: Record<
    string,
    OpenApiSchemaObject | OpenApiReferenceObject
  > = schemaProperties ? { ...schemaProperties } : {};
  const mergedRequired = new Set(schemaRequired);
  const remainingAllOf: (OpenApiSchemaObject | OpenApiReferenceObject)[] = [];

  for (const subSchema of schemaAllOf) {
    if (isSchema(subSchema) && isMergeableAllOfObject(subSchema)) {
      didMerge = true;
      if (subSchema.properties) {
        Object.assign(mergedProperties, subSchema.properties);
      }
      const subRequired = subSchema.required as string[] | undefined;
      if (subRequired) {
        for (const prop of subRequired) {
          mergedRequired.add(prop);
        }
      }
      continue;
    }

    remainingAllOf.push(subSchema);
  }

  if (!didMerge || remainingAllOf.length === 0) {
    return schema;
  }

  return {
    ...(schema as Record<string, unknown>),
    ...(Object.keys(mergedProperties).length > 0 && {
      properties: mergedProperties,
    }),
    ...(mergedRequired.size > 0 && { required: [...mergedRequired] }),
    ...(remainingAllOf.length > 0 && { allOf: remainingAllOf }),
  } as OpenApiSchemaObject;
}

/** True when the schema node itself is not a single object shape. */
function directlyEmitsNonObjectType(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
): boolean {
  // Bridge assertions: AnyOtherAttribute infects all schema property access
  if (schema.enum || (schema.nullable as boolean | undefined) === true) {
    return true;
  }
  const type = schema.type as string | string[] | undefined;
  const isObjectType =
    !type ||
    type === 'object' ||
    (Array.isArray(type) && type.length === 1 && type[0] === 'object');
  if (!isObjectType) {
    return true;
  }
  return false;
}

function isDirectlyNullable(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
): boolean {
  if ((schema.nullable as boolean | undefined) === true) {
    return true;
  }
  const type = schema.type as string | string[] | undefined;
  return type === 'null' || (Array.isArray(type) && type.includes('null'));
}

function directlyEmitsOnlyObjectOrNull(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
): boolean {
  if (schema.enum) {
    return false;
  }
  const type = schema.type as string | string[] | undefined;
  const hasObjectType =
    !type ||
    type === 'object' ||
    (Array.isArray(type) && type.includes('object'));
  const hasOnlyObjectAndNull =
    !type ||
    type === 'object' ||
    (Array.isArray(type) &&
      type.every((memberType) => ['object', 'null'].includes(memberType)));
  return (
    hasObjectType &&
    hasOnlyObjectAndNull &&
    ((schema.nullable as boolean | undefined) === true ||
      (Array.isArray(type) && type.includes('null')))
  );
}

function isEnumMember(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): boolean {
  return resolveObject({ schema, combined: true, context }).isEnum;
}

function hasAllEnumMembers(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): boolean {
  if (isReference(schema)) {
    return false;
  }
  const compositions = [schema.allOf, schema.oneOf, schema.anyOf] as (
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined
  )[];
  return compositions.some(
    (members) =>
      !!members?.length &&
      members.every((member) => isEnumMember(member, context)),
  );
}

function usesCanonicalNullableOneOfObject(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
): boolean {
  if (isReference(schema)) {
    return false;
  }
  const members = schema.oneOf as
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;
  if (!members) {
    return false;
  }
  const isNullMember = (
    member: OpenApiSchemaObject | OpenApiReferenceObject,
  ): boolean => {
    if (isReference(member)) {
      return false;
    }
    const type = member.type as string | string[] | undefined;
    return (
      type === 'null' ||
      (Array.isArray(type) && type.length === 1 && type[0] === 'null')
    );
  };
  const nonNullMembers = members.filter((member) => !isNullMember(member));
  const nonNullMember = nonNullMembers[0];
  if (
    !members.some(isNullMember) ||
    nonNullMembers.length !== 1 ||
    !nonNullMember ||
    isReference(nonNullMember)
  ) {
    return false;
  }
  const type = nonNullMember.type as string | string[] | undefined;
  const properties = nonNullMember.properties as
    | Record<string, unknown>
    | undefined;
  return (
    (type === 'object' || (!type && !!properties)) &&
    !!properties &&
    Object.keys(properties).length > 0
  );
}

function propagatesNullAcrossRef(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  crossesComponentRefBoundary: boolean,
): boolean {
  if (!crossesComponentRefBoundary) {
    return false;
  }
  if (isDirectlyNullable(schema)) {
    return true;
  }
  const anyOfMembers = (schema.anyOf ?? []) as (
    | OpenApiSchemaObject
    | OpenApiReferenceObject
  )[];
  return anyOfMembers.some(
    (member) => !isReference(member) && isDirectlyNullable(member),
  );
}

/**
 * True when this node can emit a branch that also omits keys contributed by
 * its `allOf` descendants. Direct non-object output escapes the full
 * intersection. Direct or inline-anyOf nullability can also escape when
 * `resolveValue` resolves this node through a component `$ref` and preserves
 * or appends `| null` outside the alias intersection. Canonical nullable oneOf
 * and all-enum sibling compositions only make the node's own properties
 * unsafe: `combineSchemas` still
 * intersects every `allOf` member with their emitted union. A non-null object
 * sibling or guaranteed properties on the parent also eliminate an
 * object-or-null member's null branch from the parent intersection, preserving
 * that member's object keys.
 */
function cannotGuaranteeAllOfPropertyKeys(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  crossesComponentRefBoundary: boolean,
  nullBranchesEliminated = false,
): boolean {
  if (
    directlyEmitsNonObjectType(schema) &&
    !(nullBranchesEliminated && directlyEmitsOnlyObjectOrNull(schema))
  ) {
    return true;
  }
  return (
    !nullBranchesEliminated &&
    propagatesNullAcrossRef(schema, crossesComponentRefBoundary)
  );
}

/**
 * True when this node's own property keys are not guaranteed in `keyof` of the
 * referenced output. Nullable, enum, scalar, array, or mixed-type nodes fail
 * directly; a missing type and OAS 3.1 `type: ['object']` remain object-capable.
 *
 * anyOf/oneOf members otherwise remain safe because `combineSchemas`
 * intersects the node's own properties into every grouped branch. The exception
 * is nullability on a component `$ref` target or one of its direct inline anyOf
 * members: `resolveValue`/`getScalar` can propagate it outside the referenced
 * wrapper's allOf intersection. Inline allOf members, reference members,
 * non-null scalars, oneOf members, and nested unions stay inside the grouped
 * intersection. An all-enum composition is also unsafe because `combineValues`
 * emits the node's properties as a separate union branch instead. Finally, the
 * canonical nullable-oneOf object shortcut emits only its inline object and
 * `null`, dropping the node's own properties.
 */
function cannotGuaranteeOwnPropertyKeys(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  crossesComponentRefBoundary: boolean,
  nullBranchesEliminated = false,
): boolean {
  return (
    cannotGuaranteeAllOfPropertyKeys(
      schema,
      crossesComponentRefBoundary,
      nullBranchesEliminated,
    ) ||
    hasAllEnumMembers(schema, context) ||
    usesCanonicalNullableOneOfObject(schema)
  );
}

/**
 * Dereference a component `$ref`, following `$ref`-to-`$ref` chains. Returns
 * `undefined` (rather than throwing like `resolveRef`) for non-component,
 * cyclic, malformed, or unresolvable refs so callers can fall back to the
 * `Extract` guard. `seenRefs` records every visited hop and doubles as the
 * cycle guard across the whole walk.
 */
function derefComponentSchema(
  $ref: string | undefined,
  context: ContextSpec,
  seenRefs: Set<string>,
): OpenApiSchemaObject | undefined {
  let current = $ref;
  while (current && !seenRefs.has(current) && isComponentRef(current)) {
    seenRefs.add(current);
    let target: unknown;
    try {
      const { refPaths } = getRefInfo(current, context);
      target = Array.isArray(refPaths)
        ? prop(
            context.spec,
            // @ts-expect-error: [ts2556] refPaths are not guaranteed to be valid keys of the spec
            ...refPaths,
          )
        : undefined;
    } catch {
      // getRefInfo decodes URI components and may throw on malformed refs
      return undefined;
    }
    if (!isObject(target)) {
      return undefined;
    }
    if (isReference(target)) {
      // Intermediate chain hops can carry non-object-producing siblings too
      if (cannotGuaranteeAllOfPropertyKeys(target, true)) {
        return undefined;
      }
      current = target.$ref;
      continue;
    }
    return target as OpenApiSchemaObject;
  }
  return undefined;
}

/**
 * True when this member is guaranteed to emit a non-null object. Walk the
 * original `allOf` composition so object constraints hidden behind nested
 * component refs are not lost when normalization merges an inline member into
 * its parent. `seenRefs` keeps recursive component compositions cycle-safe.
 */
function guaranteesNonNullableObject(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  seenRefs = new Set<string>(),
  crossesComponentRefBoundary = isReference(schema),
): boolean {
  if (isReference(schema)) {
    // A nullable/non-object sibling at the ref site can be lifted outside the
    // referenced intersection, so the target cannot prove this site non-null.
    if (
      cannotGuaranteeOwnPropertyKeys(
        schema,
        context,
        crossesComponentRefBoundary,
      )
    ) {
      return false;
    }
    const resolvedSchema = derefComponentSchema(schema.$ref, context, seenRefs);
    return resolvedSchema
      ? guaranteesNonNullableObject(resolvedSchema, context, seenRefs, true)
      : false;
  }

  // resolveValue/getScalar preserve direct nullability or append nullability
  // found in a directly referenced anyOf outside the alias intersection. That
  // branch cannot be removed by a nested object within the referenced schema.
  if (propagatesNullAcrossRef(schema, crossesComponentRefBoundary)) {
    return false;
  }

  const properties = schema.properties as Record<string, unknown> | undefined;
  const type = schema.type as string | string[] | undefined;
  const isExplicitlyNonNullableObject =
    type === 'object' ||
    (Array.isArray(type) && type.length === 1 && type[0] === 'object');
  const ownSchemaGuaranteesObject =
    !cannotGuaranteeOwnPropertyKeys(
      schema,
      context,
      crossesComponentRefBoundary,
    ) &&
    (isExplicitlyNonNullableObject ||
      (!!properties && Object.keys(properties).length > 0));
  if (ownSchemaGuaranteesObject) {
    return true;
  }

  const members = (schema.allOf ?? []) as (
    | OpenApiSchemaObject
    | OpenApiReferenceObject
  )[];
  return members.some((member) =>
    guaranteesNonNullableObject(member, context, new Set(seenRefs)),
  );
}

/**
 * Collect the property keys reachable through a schema's `allOf` composition,
 * resolving component `$ref` members against the spec. Feeds the
 * pickable/unresolved split for required-override keys: a key found here is
 * provably in `keyof` of the emitted intersection, so a plain
 * `Required<Pick<T, 'k'>>` is safe even when an `additionalProperties` index
 * signature would collapse the `Extract` guard to `never` (#3748). Union
 * members are deliberately not walked, while a node's own top-level properties
 * are collected when the generator intersects them into every anyOf/oneOf
 * branch. A node's own unsafe properties are skipped without discarding keys
 * from sibling `allOf` descendants that remain in the emitted intersection.
 * Nodes that can emit a branch outside that full intersection are skipped
 * entirely, degrading to the compile-safe `Extract` guard. The component-ref
 * boundary flag mirrors the only `resolveValue` path that lifts inline anyOf
 * nullability outside the alias intersection. Parent allOf traversal also uses
 * guaranteed properties on the parent or a sibling as proof that null cannot
 * survive the full intersection.
 */
function collectDeepPropertyKeys(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  crossesComponentRefBoundary = false,
  nullBranchesEliminated = false,
  seenRefs = new Set<string>(),
): string[] {
  const resolvesComponentRef =
    crossesComponentRefBoundary || isReference(schema);
  // Checked before dereferencing: `$ref`-site siblings (`nullable: true`,
  // scalar or mixed `type`) can change the emission just like inline nodes.
  if (
    cannotGuaranteeAllOfPropertyKeys(
      schema,
      resolvesComponentRef,
      nullBranchesEliminated,
    )
  ) {
    return [];
  }
  if (isReference(schema)) {
    const target = derefComponentSchema(schema.$ref, context, seenRefs);
    return target
      ? collectDeepPropertyKeys(
          target,
          context,
          true,
          nullBranchesEliminated,
          seenRefs,
        )
      : [];
  }
  // Bridge assertion: properties is infected by AnyOtherAttribute
  const properties = schema.properties as Record<string, unknown> | undefined;
  const keys =
    properties &&
    !cannotGuaranteeOwnPropertyKeys(
      schema,
      context,
      resolvesComponentRef,
      nullBranchesEliminated,
    )
      ? Object.keys(properties)
      : [];
  const parentPropertiesEliminateNull = keys.length > 0;
  const members = (schema.allOf ?? []) as (
    | OpenApiSchemaObject
    | OpenApiReferenceObject
  )[];
  const guaranteedObjectMembers = members.map((member) =>
    guaranteesNonNullableObject(member, context),
  );
  for (const [index, member] of members.entries()) {
    const hasObjectSibling = guaranteedObjectMembers.some(
      (isGuaranteedObject, siblingIndex) =>
        siblingIndex !== index && isGuaranteedObject,
    );
    keys.push(
      ...collectDeepPropertyKeys(
        member,
        context,
        false,
        nullBranchesEliminated ||
          parentPropertiesEliminateNull ||
          hasObjectSibling,
        seenRefs,
      ),
    );
  }
  return keys;
}

interface CombineValuesOptions {
  resolvedData: CombinedData;
  resolvedValue?: ScalarValue;
  separator: Separator;
  context: ContextSpec;
  parentSchema?: OpenApiSchemaObject;
  parentNullBranchesEliminated?: boolean;
}

function combineValues({
  resolvedData,
  resolvedValue,
  separator,
  context,
  parentSchema,
  parentNullBranchesEliminated = false,
}: CombineValuesOptions) {
  const isAllEnums = resolvedData.isEnum.every(Boolean);

  if (isAllEnums) {
    return `${resolvedData.values.join(` | `)}${
      resolvedValue ? ` | ${resolvedValue.value}` : ''
    }`;
  }

  if (separator === 'allOf') {
    // Wrap values containing unions in parens to preserve precedence
    // e.g. allOf: [A, oneOf: [B, C]] should be A & (B | C), not A & B | C
    let resolvedDataValue = resolvedData.values
      .map((v) => (v.includes(' | ') ? `(${v})` : v))
      .join(` & `);
    if (resolvedData.originalSchema.length > 0 && resolvedValue) {
      // Bridge: discriminator is typed but AnyOtherAttribute infects access
      interface Discriminator {
        propertyName?: string;
        mapping?: Record<string, string>;
      }
      const discriminatedPropertySchemas = resolvedData.originalSchema.filter(
        (s) => {
          const disc = s?.discriminator as Discriminator | undefined;
          return disc && resolvedValue.value.includes(` ${disc.propertyName}:`);
        },
      ) as OpenApiSchemaObject[];
      if (discriminatedPropertySchemas.length > 0) {
        resolvedDataValue = `Omit<${resolvedDataValue}, '${discriminatedPropertySchemas.map((s) => (s.discriminator as Discriminator | undefined)?.propertyName).join("' | '")}'>`;
      }
    }
    // Also wrap resolvedValue if it contains union (sibling pattern: allOf + oneOf at same level)
    const resolvedValueStr = resolvedValue?.value.includes(' | ')
      ? `(${resolvedValue.value})`
      : resolvedValue?.value;
    const joined = `${resolvedDataValue}${
      resolvedValue ? ` & ${resolvedValueStr}` : ''
    }`;

    // Parent object may have set required properties that only exist in child
    // objects. Make sure the resulting object has these properties as required,
    // but there is no need to override properties that are already required
    const parentProperties = parentSchema?.properties as
      | Record<string, unknown>
      | undefined;
    const parentRequiredProperties = parentSchema?.required as
      | string[]
      | undefined;
    const overrideRequiredProperties = resolvedData.requiredProperties.filter(
      (prop) =>
        !resolvedData.originalSchema.some((schema) => {
          const props = schema?.properties as
            | Record<string, unknown>
            | undefined;
          const req = schema?.required as string[] | undefined;
          return props?.[prop] && req?.includes(prop);
        }) &&
        !(parentProperties?.[prop] && parentRequiredProperties?.includes(prop)),
    );
    // `joined` intersects the parent's own object emission with every allOf
    // member, so guaranteed own keys are just as safe to Pick as keys proven
    // reachable through the member composition. A scalar/nullable/union parent
    // may declare properties without emitting them on every branch, so keep
    // those on the Extract-guarded path.
    const pickableParentProperties =
      parentSchema &&
      parentProperties &&
      !cannotGuaranteeOwnPropertyKeys(
        parentSchema,
        context,
        false,
        parentNullBranchesEliminated,
      )
        ? Object.keys(parentProperties)
        : [];
    // A nullable object parent's keys are not in `keyof joined`, but they are
    // guaranteed on `NonNullable<joined>`. Keep the Extract fallback for the
    // full nullable type and separately require these known keys on its object
    // branch. Passing nullBranchesEliminated=true asks the same safety checks
    // whether nullability is the only reason the own keys are unavailable.
    const pickableNonNullParentProperties =
      parentSchema &&
      parentProperties &&
      !cannotGuaranteeOwnPropertyKeys(parentSchema, context, false, true)
        ? Object.keys(parentProperties)
        : [];
    // Keep the parent keys local to required-key handling: `allProperties`
    // also drives unionAddMissingProperties for other separators and
    // intentionally contains member keys only.
    const pickableProperties = new Set([
      ...resolvedData.allProperties,
      ...pickableParentProperties,
    ]);
    const pickableRequiredProperties = overrideRequiredProperties.filter(
      (prop) => pickableProperties.has(prop),
    );
    const unresolvedRequiredProperties = overrideRequiredProperties.filter(
      (prop) => !pickableProperties.has(prop),
    );
    const nullableParentRequiredProperties =
      unresolvedRequiredProperties.filter((prop) =>
        pickableNonNullParentProperties.includes(prop),
      );
    let result = joined;
    if (pickableRequiredProperties.length > 0) {
      result = `${result} & Required<Pick<${joined}, '${pickableRequiredProperties.join("' | '")}'>>`;
    }
    if (unresolvedRequiredProperties.length > 0) {
      result = `${result} & Required<Pick<${joined}, Extract<keyof (${joined}), '${unresolvedRequiredProperties.join("' | '")}'>>>`;
    }
    if (nullableParentRequiredProperties.length > 0) {
      result = `${result} & (Required<Pick<NonNullable<${joined}>, '${nullableParentRequiredProperties.join("' | '")}'>> | null)`;
    }
    if (
      pickableRequiredProperties.length > 0 ||
      unresolvedRequiredProperties.length > 0
    ) {
      return result;
    }
    return joined;
  }

  let values = resolvedData.values;
  const hasObjectSubschemas = resolvedData.allProperties.length;
  if (hasObjectSubschemas && context.output.unionAddMissingProperties) {
    values = []; // the list of values will be rebuilt to add missing properties (if exist) in subschemas
    for (let i = 0; i < resolvedData.values.length; i += 1) {
      const subSchema = resolvedData.originalSchema[i];
      if (subSchema?.type !== 'object' || !subSchema.properties) {
        values.push(resolvedData.values[i]);
        continue;
      }

      const subSchemaProps = subSchema.properties as Record<string, unknown>;
      const missingProperties = unique(
        resolvedData.allProperties.filter(
          (p) => !Object.keys(subSchemaProps).includes(p),
        ),
      );
      values.push(
        `${resolvedData.values[i]}${
          missingProperties.length > 0
            ? ` & {${missingProperties.map((p) => `${p}?: never`).join('; ')}}`
            : ''
        }`,
      );
    }
  }

  if (resolvedValue) {
    const resolvedValueStr = resolvedValue.value.includes(' | ')
      ? `(${resolvedValue.value})`
      : resolvedValue.value;
    return values
      .map((value) => {
        const valueStr = value.includes(' | ') ? `(${value})` : value;
        return `(${valueStr} & ${resolvedValueStr})`;
      })
      .join(' | ');
  }

  return values.join(' | ');
}

export function combineSchemas({
  name,
  schema,
  separator,
  context,
  nullable,
  formDataContext,
}: {
  name?: string;
  schema: OpenApiSchemaObject;
  separator: Separator;
  context: ContextSpec;
  nullable: string;
  formDataContext?: FormDataContext;
}): ScalarValue {
  const originalAllOfMembers = (schema.allOf ?? []) as (
    | OpenApiSchemaObject
    | OpenApiReferenceObject
  )[];
  const parentNullBranchesEliminated =
    separator === 'allOf' &&
    originalAllOfMembers.some((member) =>
      guaranteesNonNullableObject(member, context),
    );

  // Normalize allOf schemas by merging inline objects into parent (fixes #2458)
  // Only applies when: using allOf, not in v7 compat mode, no sibling oneOf/anyOf
  const canMergeInlineAllOf =
    separator === 'allOf' &&
    !context.output.override.aliasCombinedTypes &&
    !schema.oneOf &&
    !schema.anyOf;

  const normalizedSchema = canMergeInlineAllOf
    ? normalizeAllOfSchema(schema)
    : schema;

  // Bridge assertions: AnyOtherAttribute infects all schema property access
  const items = (normalizedSchema[separator] ?? []) as (
    | OpenApiSchemaObject
    | OpenApiReferenceObject
  )[];

  const resolvedData: CombinedData = {
    values: [],
    imports: [],
    schemas: [],
    isEnum: [], // check if only enums
    isRef: [],
    types: [],
    dependencies: [],
    originalSchema: [],
    allProperties: [],
    hasReadonlyProps: false,
    example: schema.example as unknown,
    examples: resolveExampleRefs(
      schema.examples as
        | Record<string, OpenApiReferenceObject | { value?: unknown }>
        | undefined,
      context,
    ),
    requiredProperties:
      separator === 'allOf'
        ? [...((normalizedSchema.required as string[] | undefined) ?? [])]
        : [],
  };
  for (const subSchema of items) {
    // aliasCombinedTypes (v7 compat): create intermediate types like ResponseAnyOf
    // v8 default: propName stays undefined so combined types are inlined directly
    let propName: string | undefined;
    if (context.output.override.aliasCombinedTypes) {
      propName = name ? name + pascal(separator) : undefined;
      if (propName && resolvedData.schemas.length > 0) {
        propName =
          propName + pascal(getNumberWord(resolvedData.schemas.length + 1));
      }
    }

    const resolvedValue = resolveObject({
      schema: subSchema,
      propName,
      combined: true,
      context,
      formDataContext,
    });

    // Collect `required` from each allOf member's resolved schema. A member may
    // carry only `required` (a constraint-only overlay) and contribute those
    // keys to properties defined in a sibling member — including when the
    // overlay is itself a `$ref` whose `required` lives in the referenced
    // schema. Reading `resolvedValue.originalSchema` (the dereferenced target
    // for component refs) covers both inline and `$ref` overlays, unlike the
    // raw member which hides `required` behind an unresolved `$ref` or fails
    // the `isSchema` gate when it has no `type`/`properties`. See #3663.
    if (separator === 'allOf') {
      const memberRequired = resolvedValue.originalSchema?.required as
        | string[]
        | undefined;
      if (Array.isArray(memberRequired)) {
        resolvedData.requiredProperties.push(...memberRequired);
      }
    }

    const aliasedImports = getAliasedImports({
      context,
      name,
      resolvedValue,
    });

    const value = getImportAliasForRefOrValue({
      context,
      resolvedValue,
      imports: aliasedImports,
    });

    resolvedData.values.push(value);
    resolvedData.imports.push(...aliasedImports);
    resolvedData.schemas.push(...resolvedValue.schemas);
    resolvedData.dependencies.push(...resolvedValue.dependencies);
    resolvedData.isEnum.push(resolvedValue.isEnum);
    resolvedData.types.push(resolvedValue.type);
    resolvedData.isRef.push(resolvedValue.isRef);
    resolvedData.originalSchema.push(resolvedValue.originalSchema);
    if (resolvedValue.hasReadonlyProps) {
      resolvedData.hasReadonlyProps = true;
    }

    if (resolvedValue.type === 'object') {
      if (separator === 'allOf' && !isReference(resolvedValue.originalSchema)) {
        // Walk the member's allOf composition so required keys living behind
        // a nested `$ref` count as resolvable (#3748). Union separators keep
        // the shallow collection: their `allProperties` also feeds
        // unionAddMissingProperties (#935), which must only see each member's
        // own top-level keys.
        resolvedData.allProperties.push(
          ...collectDeepPropertyKeys(
            resolvedValue.originalSchema,
            context,
            isReference(subSchema),
          ),
        );
      } else {
        // Bridge: originalSchema.properties is infected by AnyOtherAttribute
        const originalProps = resolvedValue.originalSchema.properties as
          | Record<string, unknown>
          | undefined;
        if (originalProps) {
          resolvedData.allProperties.push(...Object.keys(originalProps));
        }
      }
    }
  }

  const isAllEnums = resolvedData.isEnum.every(Boolean);
  // OAS 3.1 spells a nullable enum as `anyOf: [{enum: [...]}, {type: 'null'}]`.
  // Without this, the {type: 'null'} variant flips `isEnum` to false and the
  // enum gets inlined instead of extracted as a named type — the
  // {type: ['string','null'], enum: [...]} spelling already extracts. Treat
  // null-only variants as transparent so the caller's `isEnum && !isRef`
  // branch (query-params, schema-definition, resolvers/object) extracts via
  // getEnum, whose `stripNullUnion` handling already preserves the trailing
  // ` | null`. See issue #2710.
  //
  // Guards:
  // - `allOf` semantics are intersection, not union — `allOf: [{enum}, {null}]`
  //   does not describe a nullable enum, so restrict to `anyOf`/`oneOf`.
  // - Non-null branches must be inline enums (`!isRef`). For `$ref + null`
  //   the existing referenced enum should be reused; routing through
  //   `getEnum` would emit a parallel const that nests the original ref
  //   (e.g. `{Status: Status}`) instead of spreading or aliasing it.
  const isUnionLikeSeparator = separator === 'anyOf' || separator === 'oneOf';
  const isNullableEnumComposition =
    isUnionLikeSeparator &&
    !isAllEnums &&
    resolvedData.isEnum.some(Boolean) &&
    resolvedData.isEnum.every(
      (isEnum, index) =>
        (isEnum && !resolvedData.isRef[index]) ||
        resolvedData.types[index] === 'null',
    );
  const isAvailableToGenerateCombinedEnum =
    isAllEnums &&
    name &&
    items.length > 1 &&
    context.output.override.enumGenerationType !== EnumGeneration.UNION;

  // Only generate a combined const when enum values exist at runtime.
  if (isAvailableToGenerateCombinedEnum) {
    const {
      value: combinedEnumValue,
      valueImports,
      hasNull,
    } = getCombinedEnumValue(
      resolvedData.values.map((value, index) => ({
        value,
        isRef: resolvedData.isRef[index],
        schema: resolvedData.originalSchema[index],
      })),
    );
    const newEnum = `export const ${pascal(name)} = ${combinedEnumValue}`;
    const valueImportSet = new Set(valueImports);
    const enumNullSuffix =
      hasNull && !nullable.includes('null') ? ' | null' : '';
    const typeSuffix = `${nullable}${enumNullSuffix}`;

    return {
      value: `typeof ${pascal(name)}[keyof typeof ${pascal(name)}]${typeSuffix}`,
      imports: [
        {
          name: pascal(name),
        },
      ],
      schemas: [
        ...resolvedData.schemas,
        {
          imports: resolvedData.imports
            .filter((toImport) =>
              valueImportSet.has(toImport.alias ?? toImport.name),
            )
            .map<GeneratorImport>((toImport) => ({
              ...toImport,
              values: true,
            })),
          model: newEnum,
          name: name,
        },
      ],
      isEnum: false,
      type: 'object' as SchemaType,
      isRef: false,
      hasReadonlyProps: resolvedData.hasReadonlyProps,
      dependencies: resolvedData.dependencies,
      example: schema.example as unknown,
      examples: resolveExampleRefs(
        schema.examples as
          | Record<string, OpenApiReferenceObject | { value?: unknown }>
          | undefined,
        context,
      ),
    };
  }

  let resolvedValue: ScalarValue | undefined;

  const normalizedProperties = normalizedSchema.properties as
    | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
    | undefined;
  const schemaOneOf = schema.oneOf as
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;
  const schemaAnyOf = schema.anyOf as
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;

  if (normalizedProperties) {
    resolvedValue = getScalar({
      item: Object.fromEntries(
        Object.entries(normalizedSchema).filter(([key]) => key !== separator),
      ),
      name,
      context,
      formDataContext,
    });
  } else if (separator === 'allOf' && (schemaOneOf || schemaAnyOf)) {
    // Handle sibling pattern: allOf + oneOf/anyOf at same level
    // e.g. { allOf: [A], oneOf: [B, C] } should produce A & (B | C)
    const siblingCombiner = schemaOneOf ? 'oneOf' : 'anyOf';
    const siblingSchemas = schemaOneOf ?? schemaAnyOf;
    resolvedValue = combineSchemas({
      schema: { [siblingCombiner]: siblingSchemas },
      name,
      separator: siblingCombiner,
      context,
      nullable: '',
    });
  }

  const value = combineValues({
    resolvedData,
    separator,
    resolvedValue,
    context,
    parentSchema: normalizedSchema,
    parentNullBranchesEliminated,
  });

  return {
    value: dedupeUnionType(value + nullable),
    imports: resolvedValue
      ? [...resolvedData.imports, ...resolvedValue.imports]
      : resolvedData.imports,
    schemas: resolvedValue
      ? [...resolvedData.schemas, ...resolvedValue.schemas]
      : resolvedData.schemas,
    dependencies: resolvedValue
      ? [...resolvedData.dependencies, ...resolvedValue.dependencies]
      : resolvedData.dependencies,
    isEnum: isNullableEnumComposition,
    type: 'object' as SchemaType,
    isRef: false,
    hasReadonlyProps:
      resolvedData.hasReadonlyProps ||
      (resolvedValue?.hasReadonlyProps ?? false),
    example: schema.example as unknown,
    examples: resolveExampleRefs(
      schema.examples as
        | Record<string, OpenApiReferenceObject | { value?: unknown }>
        | undefined,
      context,
    ),
  };
}
