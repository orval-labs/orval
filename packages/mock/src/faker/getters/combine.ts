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
  // Names of schemas currently being expanded as `allOf` bases along the active
  // resolution path. Unlike `existingReferencedProperties` (which records every
  // visited `$ref`, including `oneOf`/`anyOf` variants and properties), this
  // tracks *only* the `allOf` inheritance chain. It lets us break cycles made of
  // top-level named schemas that extend each other via `allOf`
  // (e.g. `A: allOf[B]`, `B: allOf[A]`), where every `item.isRef` is true so the
  // `!item.isRef` guard below never fires. See the `shouldSkipRef` comment.
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
    // For allOf: skip if refName is in existingRefs AND this is an inline schema (not a top-level ref)
    // This allows top-level schemas (item.isRef=true) to get base properties from allOf
    // while preventing circular allOf chains in inline property schemas.
    // Additionally skip if refName is already on the active `allOf` chain
    // (`existingReferencedAllOfRefs`): a cycle made purely of top-level named
    // schemas (`A: allOf[B]`, `B: allOf[A]`) has `item.isRef === true` at every
    // hop, so the `!item.isRef` clause never fires and the chain would otherwise
    // recurse until the stack overflows. The path-scoped chain still allows the
    // legitimate polymorphic base-pull (a discriminator parent reached via
    // `oneOf`, then expanded once as a variant's `allOf` base) because that base
    // was never entered through `allOf`.
    // For oneOf/anyOf: skip variants that point back to an already-visited schema,
    // otherwise polymorphic recursion (e.g. Base.Parent → oneOf [Derived → allOf [Base]])
    // would infinitely re-expand.
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
      // Record this `allOf` base on the path so a later hop that points back to
      // it (a cycle) is skipped by `shouldSkipRef`. Only grows on the `allOf`
      // branch; `oneOf`/`anyOf` variants keep the inherited chain unchanged.
      existingReferencedAllOfRefs:
        separator === 'allOf' && refName
          ? [...existingReferencedAllOfRefs, refName]
          : existingReferencedAllOfRefs,
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
