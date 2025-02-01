import {
  ContextSpecs,
  GeneratorImport,
  isReference,
  isSchema,
  MockOptions,
  pascal,
} from '@orval/core';
import omit from 'lodash.omit';
import { MockDefinition, MockSchemaObject } from '../../types';
import { resolveMockValue } from '../resolvers';

export const combineSchemasMock = ({
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
}: {
  item: MockSchemaObject;
  separator: 'allOf' | 'oneOf' | 'anyOf';
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: {
    separator: 'allOf' | 'oneOf' | 'anyOf';
    includedProperties: string[];
  };
  context: ContextSpecs;
  imports: GeneratorImport[];
  // This is used to prevent recursion when combining schemas
  // When an element is added to the array, it means on this iteration, we've already seen this property
  existingReferencedProperties: string[];
  splitMockImplementations: string[];
}): MockDefinition => {
  const combineImports: GeneratorImport[] = [];
  const includedProperties: string[] = (
    combine?.includedProperties ?? []
  ).slice(0);

  const isRefAndNotExisting =
    isReference(item) && !existingReferencedProperties.includes(item.name);

  const itemResolvedValue =
    isRefAndNotExisting || item.properties
      ? resolveMockValue({
          schema: omit(item, separator) as MockSchemaObject,
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
      if (
        '$ref' in val &&
        existingReferencedProperties.includes(
          pascal(val.$ref.split('/').pop()!),
        )
      ) {
        if (arr.length === 1) {
          return 'undefined';
        }

        return acc;
      }

      // the required fields in this schema need to be considered
      // in the sub schema under the allOf key
      if (separator === 'allOf' && item.required) {
        if (isSchema(val) && val.required) {
          val = { ...val, required: [...item.required, ...val.required] };
        } else {
          val = { ...val, required: item.required };
        }
      }

      const resolvedValue = resolveMockValue({
        schema: {
          ...val,
          name: item.name,
          path: item.path ? item.path : '#',
        },
        combine: {
          separator,
          includedProperties:
            separator !== 'oneOf'
              ? includedProperties
              : itemResolvedValue?.includedProperties ?? [],
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
      if (resolvedValue.value.startsWith('{')) {
        containsOnlyPrimitiveValues = false;
        return `${acc}${separator === 'allOf' ? '...' : ''}${resolvedValue.value},`;
      } else if (resolvedValue.type === 'object') {
        containsOnlyPrimitiveValues = false;
      }
      return `${acc}${resolvedValue.value},`;
    },
    `${separator === 'allOf' ? '' : 'faker.helpers.arrayElement(['}`,
  );
  let finalValue =
    value === 'undefined'
      ? value
      : `${combine ? '...' : ''}${separator === 'allOf' && !containsOnlyPrimitiveValues ? '{' : ''}${value}${separator === 'allOf' ? (containsOnlyPrimitiveValues ? '' : '}') : '])'}`;
  if (itemResolvedValue) {
    finalValue = `{${finalValue.startsWith('...') ? '' : '...'}${finalValue}, ${itemResolvedValue.value}}`;
  }
  if (finalValue.endsWith(',')) {
    finalValue = finalValue.substring(0, finalValue.length - 1);
  }

  return {
    value: finalValue,
    imports: combineImports,
    name: item.name,
    includedProperties,
  };
};
