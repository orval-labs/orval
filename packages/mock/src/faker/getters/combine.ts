import {
  type ContextSpec,
  type GeneratorImport,
  getRefInfo,
  isReference,
  isSchema,
  type MockOptions,
} from '@orval/core';

import type { MockDefinition, MockSchema, MockSchemaObject } from '../../types';
import { resolveMockValue } from '../resolvers';

function getReferenceName(
  ref: string | undefined,
  context: ContextSpec,
): string {
  if (!ref) return '';

  return getRefInfo(ref, context).name;
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
  const itemRequired = item.required as string[] | undefined;

  const isRefAndNotExisting =
    isReference(item) && !existingReferencedProperties.includes(item.name);

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

  const itemResolvedValue =
    isRefAndNotExisting || hasResolvableProperties
      ? resolveMockValue({
          schema: Object.fromEntries(itemEntriesForResolve) as MockSchemaObject,
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

  const allRequiredFields: string[] = [];
  if (separator === 'allOf') {
    if (itemRequired) {
      allRequiredFields.push(...itemRequired);
    }
    for (const val of separatorItems) {
      if (isSchema(val) && val.required) {
        allRequiredFields.push(...(val.required as string[]));
      }
    }
  }

  let value = separator === 'allOf' ? '' : 'faker.helpers.arrayElement([';

  for (const val of separatorItems) {
    const refName = isReference(val) ? getReferenceName(val.$ref, context) : '';
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

    // the required fields in this schema need to be considered
    // in the sub schema under the allOf key
    const schema = (() => {
      if (separator !== 'allOf' || allRequiredFields.length === 0) {
        return {
          ...val,
          name: item.name,
          path: item.path ?? '#',
        };
      }

      const valWithRequired = val as MockSchema & { required?: string[] };
      const valRequired = valWithRequired.required;
      const combinedRequired = valRequired
        ? [...allRequiredFields, ...valRequired]
        : allRequiredFields;

      return {
        ...val,
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

  return {
    value: finalValue,
    imports: combineImports,
    name: item.name,
    includedProperties,
  };
}
