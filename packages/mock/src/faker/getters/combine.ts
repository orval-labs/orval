import {
  ContextSpecs,
  GeneratorImport,
  isReference,
  MockOptions,
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
  let combineImports: GeneratorImport[] = [];
  let includedProperties: string[] = (combine?.includedProperties ?? []).slice(
    0,
  );

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

  const value = (item[separator] ?? []).reduce((acc, val, index, arr) => {
    if (
      '$ref' in val &&
      existingReferencedProperties.includes(val.$ref.split('/').pop()!)
    ) {
      if (arr.length === 1) {
        return 'undefined';
      }

      return acc;
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

    const isLastElement = index === arr.length - 1;

    let currentValue = resolvedValue.value;

    if (itemResolvedValue?.value && separator === 'oneOf') {
      const splitValues = resolvedValue.value.split('},{');
      const joined = splitValues.join(`,${itemResolvedValue.value}},{`);
      currentValue = `${joined.slice(0, -1)},${itemResolvedValue.value}}`;
    }

    if (itemResolvedValue?.value && separator !== 'oneOf' && isLastElement) {
      currentValue = `${currentValue ? `${currentValue},` : ''}${itemResolvedValue.value}`;
    }

    const isObjectBounds =
      !combine || (combine.separator === 'oneOf' && separator === 'allOf');

    if (!index && isObjectBounds) {
      if (
        resolvedValue.enums ||
        separator === 'oneOf' ||
        separator === 'anyOf' ||
        resolvedValue.type === 'array'
      ) {
        if (arr.length === 1) {
          return `faker.helpers.arrayElement([${currentValue}])`;
        }
        return `faker.helpers.arrayElement([${currentValue},`;
      }

      if (arr.length === 1) {
        if (resolvedValue.type && resolvedValue.type !== 'object') {
          return currentValue;
        }
        return `{${currentValue}}`;
      }

      return `{${currentValue},`;
    }

    if (isLastElement) {
      if (
        resolvedValue.enums ||
        separator === 'oneOf' ||
        separator === 'anyOf' ||
        resolvedValue.type === 'array'
      ) {
        return `${acc}${currentValue}${!combine ? '])' : ''}`;
      }

      return `${acc}${currentValue}${isObjectBounds ? '}' : ''}`;
    }

    if (!currentValue) {
      return acc;
    }

    return `${acc}${currentValue},`;
  }, '');

  return {
    value: value,
    imports: combineImports,
    name: item.name,
    includedProperties,
  };
};
