import {
  type ContextSpecs,
  type GeneratorImport,
  getKey,
  isBoolean,
  isReference,
  type MockOptions,
  pascal,
  PropertySortOrder,
} from '@orval/core';
import type { ReferenceObject, SchemaObject } from 'openapi3-ts/oas30';

import type { MockDefinition, MockSchemaObject } from '../../types';
import { DEFAULT_OBJECT_KEY_MOCK } from '../constants';
import { resolveMockValue } from '../resolvers/value';
import { combineSchemasMock } from './combine';

export const overrideVarName = 'overrideResponse';

export const getMockObject = ({
  item,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
  imports,
  existingReferencedProperties,
  splitMockImplementations,
  allowOverride = false,
}: {
  item: MockSchemaObject;
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
  // This is used to add the overrideResponse to the object
  allowOverride?: boolean;
}): MockDefinition => {
  if (isReference(item)) {
    return resolveMockValue({
      schema: {
        ...item,
        name: item.name,
        path: item.path ? `${item.path}.${item.name}` : item.name,
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
      existingReferencedProperties,
      splitMockImplementations,
    });
  }

  if (item.allOf || item.oneOf || item.anyOf) {
    const separator = item.allOf ? 'allOf' : item.oneOf ? 'oneOf' : 'anyOf';
    return combineSchemasMock({
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
    });
  }

  if (Array.isArray(item.type)) {
    return combineSchemasMock({
      item: {
        anyOf: item.type.map((type) => ({ type })),
        name: item.name,
      },
      separator: 'anyOf',
      mockOptions,
      operationId,
      tags,
      combine,
      context,
      imports,
      existingReferencedProperties,
      splitMockImplementations,
    });
  }

  if (item.properties) {
    let value =
      !combine || combine.separator === 'oneOf' || combine.separator === 'anyOf'
        ? '{'
        : '';
    const imports: GeneratorImport[] = [];
    const includedProperties: string[] = [];

    const entries = Object.entries(item.properties);
    if (context.output.propertySortOrder === PropertySortOrder.ALPHABETICAL) {
      entries.sort((a, b) => {
        return a[0].localeCompare(b[0]);
      });
    }
    const properyScalars = entries
      .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
        if (combine?.includedProperties.includes(key)) {
          return;
        }

        const isRequired =
          mockOptions?.required ??
          (Array.isArray(item.required) ? item.required : []).includes(key);

        // Check to see if the property is a reference to an existing property
        // Fixes issue #910
        if (
          '$ref' in prop &&
          existingReferencedProperties.includes(
            pascal(prop.$ref.split('/').pop() ?? ''),
          )
        ) {
          return;
        }

        const resolvedValue = resolveMockValue({
          schema: {
            ...prop,
            name: key,
            path: item.path ? `${item.path}.${key}` : `#.${key}`,
          },
          mockOptions,
          operationId,
          tags,
          context,
          imports,
          existingReferencedProperties,
          splitMockImplementations,
        });

        imports.push(...resolvedValue.imports);
        includedProperties.push(key);

        const keyDefinition = getKey(key);

        if (!isRequired && !resolvedValue.overrided) {
          return `${keyDefinition}: faker.helpers.arrayElement([${resolvedValue.value}, undefined])`;
        }

        const isNullable = 'nullable' in prop && prop.nullable;
        if (isNullable && !resolvedValue.overrided) {
          return `${keyDefinition}: faker.helpers.arrayElement([${resolvedValue.value}, null])`;
        }

        return `${keyDefinition}: ${resolvedValue.value}`;
      })
      .filter(Boolean);

    if (allowOverride) {
      properyScalars.push(`...${overrideVarName}`);
    }

    value += properyScalars.join(', ');
    value +=
      !combine || combine.separator === 'oneOf' || combine.separator === 'anyOf'
        ? '}'
        : '';

    return {
      value,
      imports,
      name: item.name,
      includedProperties,
    };
  }

  if (item.additionalProperties) {
    if (isBoolean(item.additionalProperties)) {
      return { value: `{}`, imports: [], name: item.name };
    }
    if (
      isReference(item.additionalProperties) &&
      existingReferencedProperties.includes(
        item.additionalProperties.$ref.split('/').pop() ?? '',
      )
    ) {
      return { value: `{}`, imports: [], name: item.name };
    }

    const resolvedValue = resolveMockValue({
      schema: {
        ...item.additionalProperties,
        name: item.name,
        path: item.path ? `${item.path}.#` : '#',
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
      existingReferencedProperties,
      splitMockImplementations,
    });

    return {
      ...resolvedValue,
      value: `{
        [${DEFAULT_OBJECT_KEY_MOCK}]: ${resolvedValue.value}
      }`,
    };
  }

  return { value: '{}', imports: [], name: item.name };
};
