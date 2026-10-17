import {
  type ContextSpec,
  type GeneratorImport,
  getRefInfo,
  isInlineSchema,
  isNullOnlyEnum,
  isSchemaNullable,
  type MockOptions,
} from '@orval/core';

import type { MockDefinition, MockSchema, MockSchemaObject } from '../../types';
import { getNullable, resolveMockValue } from '../resolvers';
import { collectAllOfRequired } from './all-of-required';

function getReferenceName(
  ref: string | undefined,
  context: ContextSpec,
): string {
  if (!ref) return '';

  return getRefInfo(ref, context).name;
}

/**
 * `schema` without `null` in its type array. Returns `schema` itself when
 * the type array has no `null`, and `undefined` when `null` is its only type.
 */
function withoutNullType(schema: MockSchema): MockSchema | undefined {
  if (
    !isInlineSchema(schema) ||
    !Array.isArray(schema.type) ||
    !schema.type.includes('null')
  ) {
    return schema;
  }

  const nonNullTypes = schema.type.filter((type) => type !== 'null');
  if (nonNullTypes.length === 0) {
    return undefined;
  }

  return {
    ...schema,
    type: nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes,
  } as MockSchema;
}

interface CombineSchemasMockOptions {
  item: MockSchemaObject;
  separator: 'allOf' | 'oneOf' | 'anyOf';
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: {
    separator: 'allOf' | 'oneOf' | 'anyOf';
    includedProperties: string[];
  };
  context: ContextSpec;
  imports: GeneratorImport[];
  // This is used to prevent recursion when combining schemas
  // When an element is added to the array, it means on this iteration, we've already seen this property
  existingReferencedProperties: string[];
  // Schemas on the *current contiguous `allOf` composition* — the chain of
  // `allOf` bases entered to reach the schema being expanded right now. This is
  // the canonical doc for this field; other sites just point here.
  //
  // Why it exists: to break cycles built purely from top-level named schemas
  // that extend each other (`A: allOf[B]`, `B: allOf[A]`). There every hop is a
  // `$ref`, so `item.isRef` is always true and the `!item.isRef` clause in
  // `shouldSkipRef` never fires; this chain catches the repeat instead. (It is
  // narrower than `existingReferencedProperties`, which records every visited
  // `$ref` — variants and properties included.)
  //
  // Invariant: it grows only on a direct `allOf` -> `allOf` base descent, and
  // resets to `[]` when crossing into a `oneOf`/`anyOf` variant or a property
  // value. Those boundaries begin a fresh mock instance whose own `allOf` base
  // is legitimate and must still be pulled in, so keeping the chain across them
  // would wrongly skip that base. Such re-entry can't loop forever anyway —
  // `existingReferencedProperties` already bounds it.
  existingReferencedAllOfRefs?: string[];
  splitMockImplementations: string[];
}

export function combineSchemasMock({
  item,
  separator,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
  imports,
  existingReferencedProperties,
  existingReferencedAllOfRefs = [],
  splitMockImplementations,
}: CombineSchemasMockOptions): MockDefinition {
  const combineImports: GeneratorImport[] = [];
  const includedProperties: string[] = [...(combine?.includedProperties ?? [])];
  const separatorItems = (item[separator] ?? []) as MockSchema[];
  const itemRequired = item.required;

  const isRefAndNotExisting =
    typeof item.$ref === 'string' &&
    !existingReferencedProperties.includes(item.name);

  // When a oneOf schema declares a discriminator with a mapping AND the
  // discriminator property is also declared on the parent's `properties`,
  // skip that property here. Each variant already encodes a constrained value
  // for it via `resolveDiscriminators`; emitting the parent's free-choice enum
  // alongside the picked variant would override the constrained value and
  // guarantee a discriminator mismatch (#2155).
  const discriminator = item.discriminator as
    | { propertyName?: string; mapping?: Record<string, string> }
    | undefined;
  const itemProperties = item.properties as Record<string, unknown> | undefined;
  const discriminatorPropertyName =
    separator === 'oneOf' &&
    discriminator?.mapping &&
    discriminator.propertyName &&
    itemProperties &&
    discriminator.propertyName in itemProperties
      ? discriminator.propertyName
      : undefined;

  const itemEntriesForResolve = Object.entries(item).filter(
    ([key]) => key !== separator,
  );
  if (discriminatorPropertyName && itemProperties) {
    const propertiesIdx = itemEntriesForResolve.findIndex(
      ([key]) => key === 'properties',
    );
    if (propertiesIdx !== -1) {
      const filteredProperties = Object.fromEntries(
        Object.entries(itemProperties).filter(
          ([key]) => key !== discriminatorPropertyName,
        ),
      );
      if (Object.keys(filteredProperties).length === 0) {
        itemEntriesForResolve.splice(propertiesIdx, 1);
      } else {
        itemEntriesForResolve[propertiesIdx] = [
          'properties',
          filteredProperties,
        ];
      }
    }
    // Keep `required` in sync with the filtered properties — leaving the
    // discriminator key in `required` would describe a schema whose required
    // field is missing from `properties`.
    const requiredIdx = itemEntriesForResolve.findIndex(
      ([key]) => key === 'required',
    );
    if (requiredIdx !== -1 && Array.isArray(itemRequired)) {
      const filteredRequired = itemRequired.filter(
        (key) => key !== discriminatorPropertyName,
      );
      if (filteredRequired.length === 0) {
        itemEntriesForResolve.splice(requiredIdx, 1);
      } else {
        itemEntriesForResolve[requiredIdx] = ['required', filteredRequired];
      }
    }
  }

  const hasResolvableProperties = itemEntriesForResolve.some(
    ([key]) => key === 'properties',
  );

  const allRequiredFields: string[] = [];
  if (separator === 'allOf') {
    if (itemRequired) {
      allRequiredFields.push(...itemRequired);
    }
    allRequiredFields.push(...collectAllOfRequired(separatorItems, context));
  }

  // The composed schema's own sibling `properties` (declared next to the
  // `allOf`) are one more member of the composition, and their emission is
  // appended last, so it wins the spread merge. Resolve them with the same
  // `required` union as the members, otherwise a property required by a base
  // would be emitted here with an undefined branch the type rejects.
  const itemSchemaForResolve = Object.fromEntries(
    itemEntriesForResolve,
  ) as MockSchemaObject;
  // A nullable composed schema (`type: [object, 'null']`) is null as a whole,
  // not just its sibling `properties`. Resolve those as a plain object so they
  // come back as members to merge, and add the null branch once around the
  // merged value below. Left nullable, they resolved to a complete
  // `arrayElement([{...}, null])` expression, which was then pasted into the
  // object literal as if it were a property list.
  const isNullableItemType =
    Array.isArray(item.type) && item.type.includes('null');
  if (Array.isArray(item.type) && isNullableItemType) {
    const nonNullTypes = item.type.filter((type) => type !== 'null');
    itemSchemaForResolve.type =
      nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes;
  }
  if (separator === 'allOf' && allRequiredFields.length > 0) {
    const itemResolveRequired = itemSchemaForResolve.required;
    itemSchemaForResolve.required = [
      ...new Set([...allRequiredFields, ...(itemResolveRequired ?? [])]),
    ];
  }

  const itemResolvedValue =
    isRefAndNotExisting || hasResolvableProperties
      ? resolveMockValue({
          schema: itemSchemaForResolve,
          combine: {
            separator: 'allOf',
            includedProperties: [],
          },
          mockOptions,
          operationId,
          tags,
          context,
          imports,
          existingReferencedProperties,
          existingReferencedAllOfRefs,
          splitMockImplementations,
        })
      : undefined;

  includedProperties.push(...(itemResolvedValue?.includedProperties ?? []));
  combineImports.push(...(itemResolvedValue?.imports ?? []));
  let containsOnlyPrimitiveValues = true;
  let hasNullMember = false;
  // `allOf` members that admit null, e.g. `type: [object, 'null']` (also OAS
  // 3.0 `nullable: true` after the upgrade to 3.1). The intersection is null
  // only when every member admits null, so each one is resolved as its
  // non-null shape and the null branch is added once around the merged value.
  let nullableAllOfMembers = 0;

  let value = separator === 'allOf' ? '' : 'faker.helpers.arrayElement([';

  for (const val of separatorItems) {
    const refName = isInlineSchema(val)
      ? ''
      : getReferenceName(val.$ref, context);
    // For allOf: skip a base that would otherwise re-expand forever, in any of:
    //   - `refName === item.name`: the schema lists itself as its own base;
    //   - an already-seen *inline* base (`!item.isRef`): a circular inline allOf;
    //   - a ref already on the contiguous allOf chain
    //     (`existingReferencedAllOfRefs`): a top-level allOf cycle — see that
    //     field's docs above.
    // Top-level refs (`item.isRef`) are otherwise allowed through so a schema
    // still inherits its base properties.
    // For oneOf/anyOf: skip a variant pointing back to an already-visited schema,
    // otherwise polymorphic recursion re-expands forever
    // (e.g. Base.Parent → oneOf [Derived → allOf [Base]]).
    const shouldSkipRef =
      separator === 'allOf'
        ? refName &&
          (refName === item.name ||
            (existingReferencedProperties.includes(refName) && !item.isRef) ||
            existingReferencedAllOfRefs.includes(refName))
        : refName && existingReferencedProperties.includes(refName);

    if (shouldSkipRef) {
      if (separatorItems.length === 1) {
        value = 'undefined';
      }
      continue;
    }

    // Left nullable, the member resolved to a complete
    // `arrayElement([{...}, null])` expression, which was pasted into the
    // merged object literal without a spread and did not parse.
    // A union member with a `null` branch is merged the same way. A 3.0
    // `{ $ref, nullable: true }` member arrives in that shape when no other
    // member absorbs the null (see `normalizeNullableRefs`), and spreading its
    // null branch dropped the properties the `$ref` requires.
    const member = (() => {
      if (separator !== 'allOf' || !isInlineSchema(val)) {
        return val;
      }

      const nonNullMember = withoutNullType(val);
      if (nonNullMember !== val) {
        if (nonNullMember === undefined) {
          return val;
        }

        nullableAllOfMembers++;
        return nonNullMember;
      }

      // A variant admits null as a `null` branch or as a `null` in its type
      // array. Either way it is dropped or narrowed, or the narrowed member
      // could still resolve to `null` inside the merge.
      const unionKey = val.oneOf ? 'oneOf' : val.anyOf ? 'anyOf' : undefined;
      const variants = unionKey ? (val[unionKey] as MockSchema[]) : [];
      let admitsNull = false;
      const nonNullVariants = variants.flatMap((variant) => {
        if (!isInlineSchema(variant)) {
          return [variant];
        }
        if (variant.type === 'null' || isNullOnlyEnum(variant)) {
          admitsNull = true;
          return [];
        }
        const nonNullVariant = withoutNullType(variant);
        if (nonNullVariant !== variant) {
          admitsNull = true;
        }
        return nonNullVariant === undefined ? [] : [nonNullVariant];
      });
      if (!unionKey || nonNullVariants.length === 0 || !admitsNull) {
        return val;
      }

      nullableAllOfMembers++;
      const { [unionKey]: _union, ...rest } = val;
      return nonNullVariants.length === 1 && Object.keys(rest).length === 0
        ? nonNullVariants[0]
        : ({ ...rest, [unionKey]: nonNullVariants } as MockSchema);
    })();

    // the required fields in this schema need to be considered
    // in the sub schema under the allOf key
    const schema = (() => {
      if (separator !== 'allOf' || allRequiredFields.length === 0) {
        return {
          ...member,
          name: item.name,
          path: item.path ?? '#',
        };
      }

      const valWithRequired = member as MockSchema & { required?: string[] };
      const valRequired = valWithRequired.required;
      const combinedRequired = valRequired
        ? [...allRequiredFields, ...valRequired]
        : allRequiredFields;

      return {
        ...member,
        name: item.name,
        path: item.path ?? '#',
        required: [...new Set(combinedRequired)],
      };
    })();

    const resolvedValue = resolveMockValue({
      schema,
      combine: {
        separator,
        includedProperties:
          separator === 'oneOf'
            ? (itemResolvedValue?.includedProperties ?? [])
            : includedProperties,
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
      existingReferencedProperties,
      // Grow the chain on an allOf base hop; reset it on a oneOf/anyOf variant
      // (a fresh instance). See `existingReferencedAllOfRefs` docs above.
      existingReferencedAllOfRefs:
        separator === 'allOf' && refName
          ? [...existingReferencedAllOfRefs, refName]
          : [],
      splitMockImplementations,
    });

    combineImports.push(...resolvedValue.imports);
    includedProperties.push(...(resolvedValue.includedProperties ?? []));

    if (resolvedValue.value === '{}') {
      containsOnlyPrimitiveValues = false;
      continue;
    }

    if (separator === 'allOf') {
      if (resolvedValue.value.startsWith('{') || !resolvedValue.type) {
        containsOnlyPrimitiveValues = false;
        value += `...${resolvedValue.value},`;
        continue;
      }

      if (resolvedValue.type === 'object') {
        containsOnlyPrimitiveValues = false;
        value += resolvedValue.value.startsWith('faker')
          ? `...${resolvedValue.value},`
          : `...{${resolvedValue.value}},`;
        continue;
      }
    }

    if (separator !== 'allOf' && resolvedValue.value === 'null') {
      if (hasNullMember) continue;
      hasNullMember = true;
    }

    value += `${resolvedValue.value},`;
  }
  // When every oneOf/anyOf variant was skipped (e.g. all $refs were already on
  // the resolution stack) the loop leaves `value` at its initial opener. Emit
  // `undefined` instead of closing it as `faker.helpers.arrayElement([])`,
  // which throws at runtime.
  const isEmptyArrayElement =
    separator !== 'allOf' && value === 'faker.helpers.arrayElement([';

  let finalValue =
    value === 'undefined' || isEmptyArrayElement
      ? 'undefined'
      : // containsOnlyPrimitiveValues isn't just true, it's being set to false inside the above reduce and the type system doesn't detect it
        `${separator === 'allOf' && !containsOnlyPrimitiveValues ? '{' : ''}${value}${separator === 'allOf' ? (containsOnlyPrimitiveValues ? '' : '}') : '])'}`;
  if (itemResolvedValue) {
    finalValue = finalValue.startsWith('...')
      ? `...{${finalValue}, ${itemResolvedValue.value}}`
      : `{...${finalValue}, ${itemResolvedValue.value}}`;
  }
  if (finalValue.endsWith(',')) {
    finalValue = finalValue.slice(0, Math.max(0, finalValue.length - 1));
  }
  // `itemProperties` too: discriminator filtering can remove the only sibling
  // property, and the parent is still nullable as a whole.
  const isParentNullWrapped =
    (!!itemResolvedValue || !!itemProperties) && isNullableItemType;
  // Every `allOf` member admits null and the parent does not rule it out.
  const isNullableIntersection =
    separator === 'allOf' &&
    separatorItems.length > 0 &&
    nullableAllOfMembers === separatorItems.length &&
    (item.type === undefined || isNullableItemType);
  if (
    (isParentNullWrapped || isNullableIntersection) &&
    finalValue !== 'undefined' &&
    !finalValue.startsWith('...')
  ) {
    finalValue = getNullable(finalValue, true, mockOptions?.nonNullable);
  }

  return {
    value: finalValue,
    imports: combineImports,
    name: item.name,
    includedProperties,
    // A `{ type: 'null' }` branch has already been rendered as one member of
    // the union, so the value randomizes to null on its own. Saying so stops
    // the object property loop adding a second `arrayElement([..., null])`
    // around it (#4141).
    nullWrapped:
      (isSchemaNullable(item) || isNullableIntersection) &&
      !mockOptions?.nonNullable,
  };
}
