import {
  type ContextSpec,
  type GeneratorImport,
  getKey,
  isReference,
  type MockOptions,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  pascal,
  PropertySortOrder,
} from '@orval/core';

import type { MockDefinition, MockSchema, MockSchemaObject } from '../../types';
import { DEFAULT_OBJECT_KEY_MOCK } from '../constants';
import { resolveMockValue } from '../resolvers/value';
import { combineSchemasMock } from './combine';

export const overrideVarName = 'overrideResponse';

function getReferenceName(ref?: string): string {
  if (!ref) return '';

  return pascal(ref.split('/').pop() ?? '');
}

interface GetMockObjectOptions {
  item: MockSchemaObject;
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
  // This is used to add the overrideResponse to the object
  allowOverride?: boolean;
}

export function getMockObject({
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
}: GetMockObjectOptions): MockDefinition {
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

  const schemaItem = item as MockSchemaObject & Record<string, unknown>;
  const itemAllOf = schemaItem.allOf as MockSchema[] | undefined;
  const itemOneOf = schemaItem.oneOf as MockSchema[] | undefined;
  const itemAnyOf = schemaItem.anyOf as MockSchema[] | undefined;
  const itemType = schemaItem.type as string | string[] | undefined;
  const itemProperties = schemaItem.properties as
    | Record<string, OpenApiReferenceObject | OpenApiSchemaObject>
    | undefined;
  const itemRequired = schemaItem.required as string[] | undefined;
  const itemAdditionalProperties = schemaItem.additionalProperties as
    | boolean
    | OpenApiReferenceObject
    | OpenApiSchemaObject
    | undefined;

  if (itemAllOf || itemOneOf || itemAnyOf) {
    const separator = itemAllOf ? 'allOf' : itemOneOf ? 'oneOf' : 'anyOf';
    return combineSchemasMock({
      item: schemaItem,
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

  if (Array.isArray(itemType)) {
    // Spread the base schema into each type entry so that object properties
    // (e.g. `properties`, `required`, `additionalProperties`) are preserved.
    // Without this, `{ type: "object", properties: {...} }` collapses to
    // `{ type: "object" }` and the mock generator returns `{}` instead of
    // building the actual object shape. Mirrors the fix in core getters/object.ts.
    const baseItem = schemaItem as Record<string, unknown>;
    return combineSchemasMock({
      item: {
        anyOf: itemType.map((type) => ({
          ...baseItem,
          type,
        })) as unknown as MockSchema[],
        name: schemaItem.name,
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

  if (itemProperties) {
    let value =
      !combine || combine.separator === 'oneOf' || combine.separator === 'anyOf'
        ? '{'
        : '';
    const imports: GeneratorImport[] = [];
    const includedProperties: string[] = [];

    const entries = Object.entries(itemProperties);
    if (context.output.propertySortOrder === PropertySortOrder.ALPHABETICAL) {
      entries.sort((a, b) => {
        return a[0].localeCompare(b[0], 'en', { numeric: true });
      });
    }
    const propertyScalars = entries
      .map(
        ([key, prop]: [
          string,
          OpenApiReferenceObject | OpenApiSchemaObject,
        ]) => {
          if (combine?.includedProperties.includes(key)) {
            return;
          }

          const isRequired =
            mockOptions?.required ??
            (Array.isArray(itemRequired) ? itemRequired : []).includes(key);

          const hasNullable = 'nullable' in prop && prop.nullable === true;

          // Check to see if the property is a reference to an existing property
          // Fixes issue #910
          if (
            isReference(prop) &&
            existingReferencedProperties.includes(getReferenceName(prop.$ref))
          ) {
            if (isRequired) {
              const keyDefinition = getKey(key);
              return `${keyDefinition}: null`;
            }
            return;
          }

          const resolvedValue = resolveMockValue({
            schema: {
              ...(prop as Record<string, unknown>),
              name: key,
              path: schemaItem.path ? `${schemaItem.path}.${key}` : `#.${key}`,
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

          const hasDefault = 'default' in prop && prop.default !== undefined;

          if (!isRequired && !resolvedValue.overrided && !hasDefault) {
            const nullValue = hasNullable ? 'null' : 'undefined';
            return `${keyDefinition}: faker.helpers.arrayElement([${resolvedValue.value}, ${nullValue}])`;
          }

          const isNullable =
            Array.isArray(prop.type) && prop.type.includes('null');
          if (isNullable && !resolvedValue.overrided) {
            return `${keyDefinition}: faker.helpers.arrayElement([${resolvedValue.value}, null])`;
          }

          return `${keyDefinition}: ${resolvedValue.value}`;
        },
      )
      .filter(Boolean);

    if (allowOverride) {
      propertyScalars.push(`...${overrideVarName}`);
    }

    value += propertyScalars.join(', ');
    value +=
      !combine || combine.separator === 'oneOf' || combine.separator === 'anyOf'
        ? '}'
        : '';

    return {
      value,
      imports,
      name: schemaItem.name,
      includedProperties,
    };
  }

  if (itemAdditionalProperties) {
    if (itemAdditionalProperties === true) {
      return { value: `{}`, imports: [], name: schemaItem.name };
    }
    const additionalProperties = itemAdditionalProperties;
    if (
      isReference(additionalProperties) &&
      existingReferencedProperties.includes(
        getReferenceName(additionalProperties.$ref),
      )
    ) {
      return { value: `{}`, imports: [], name: schemaItem.name };
    }

    const resolvedValue = resolveMockValue({
      schema: {
        ...additionalProperties,
        name: schemaItem.name,
        path: schemaItem.path ? `${schemaItem.path}.#` : '#',
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

  return { value: '{}', imports: [], name: schemaItem.name };
}
