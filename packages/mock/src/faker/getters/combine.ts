import {
  type ContextSpec,
  type GeneratorImport,
  isReference,
  isSchema,
  type MockOptions,
  pascal,
} from '@orval/core';

import type { MockDefinition, MockSchema, MockSchemaObject } from '../../types';
import { resolveMockValue } from '../resolvers';

function getReferenceName(ref?: string): string {
  if (!ref) return '';

  return pascal(ref.split('/').pop() ?? '');
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
  splitMockImplementations,
}: CombineSchemasMockOptions): MockDefinition {
  const combineImports: GeneratorImport[] = [];
  const includedProperties: string[] = [...(combine?.includedProperties ?? [])];
  const separatorItems = (item[separator] ?? []) as MockSchema[];
  const itemRequired = item.required as string[] | undefined;

  const isRefAndNotExisting =
    isReference(item) && !existingReferencedProperties.includes(item.name);

  const itemResolvedValue =
    isRefAndNotExisting || item.properties
      ? resolveMockValue({
          schema: Object.fromEntries(
            Object.entries(item).filter(([key]) => key !== separator),
          ) as MockSchemaObject,
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
    const refName = isReference(val) ? getReferenceName(val.$ref) : '';
    // For allOf: skip if refName is in existingRefs AND this is an inline schema (not a top-level ref)
    // This allows top-level schemas (item.isRef=true) to get base properties from allOf
    // while preventing circular allOf chains in inline property schemas.
    // For oneOf/anyOf: skip variants that point back to an already-visited schema,
    // otherwise polymorphic recursion (e.g. Base.Parent → oneOf [Derived → allOf [Base]])
    // would infinitely re-expand.
    const shouldSkipRef =
      separator === 'allOf'
        ? refName &&
          (refName === item.name ||
            (existingReferencedProperties.includes(refName) && !item.isRef))
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
