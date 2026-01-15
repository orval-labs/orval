import {
  type ContextSpec,
  type GeneratorImport,
  isReference,
  isSchema,
  type MockOptions,
  pascal,
} from '@orval/core';

import type { MockDefinition, MockSchemaObject } from '../../types';
import { resolveMockValue } from '../resolvers';

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

  const value = (item[separator] ?? []).reduce(
    (acc, val, _, arr) => {
      const refName =
        '$ref' in val ? pascal(val.$ref.split('/').pop() ?? '') : '';
      // For allOf: skip if refName is in existingRefs AND this is an inline schema (not a top-level ref)
      // This allows top-level schemas (item.isRef=true) to get base properties from allOf
      // while preventing circular allOf chains in inline property schemas
      const shouldSkipRef =
        separator === 'allOf'
          ? refName &&
            (refName === item.name ||
              (existingReferencedProperties.includes(refName) && !item.isRef))
          : refName && existingReferencedProperties.includes(refName);
      if (shouldSkipRef) {
        if (arr.length === 1) {
          return 'undefined';
        }

        return acc;
      }

      // the required fields in this schema need to be considered
      // in the sub schema under the allOf key
      if (separator === 'allOf' && item.required) {
        val =
          isSchema(val) && val.required
            ? { ...val, required: [...item.required, ...val.required] }
            : { ...val, required: item.required };
      }

      const resolvedValue = resolveMockValue({
        schema: {
          ...val,
          name: item.name,
          path: item.path ?? '#',
        },
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
        return acc;
      }
      if (separator === 'allOf') {
        if (resolvedValue.value.startsWith('{') || !resolvedValue.type) {
          containsOnlyPrimitiveValues = false;
          return `${acc}...${resolvedValue.value},`;
        } else if (resolvedValue.type === 'object') {
          containsOnlyPrimitiveValues = false;
          return resolvedValue.value.startsWith('faker')
            ? `${acc}...${resolvedValue.value},`
            : `${acc}...{${resolvedValue.value}},`;
        }
      }
      return `${acc}${resolvedValue.value},`;
    },
    separator === 'allOf' ? '' : 'faker.helpers.arrayElement([',
  );
  let finalValue =
    value === 'undefined'
      ? value
      : // containsOnlyPrimitiveValues isn't just true, it's being set to false inside the above reduce and the type system doesn't detect it

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
