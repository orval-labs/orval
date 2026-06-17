import {
  type ContextSpec,
  type GeneratorImport,
  getKey,
  getRefInfo,
  isReference,
  type MockOptions,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  PropertySortOrder,
} from '@orval/core';

import type { MockDefinition, MockSchema, MockSchemaObject } from '../../types';
import { DEFAULT_OBJECT_KEY_MOCK } from '../constants';
import {
  resolveMockValue,
  getNullable,
  isNullableSchema,
} from '../resolvers/value';
import { mergeReturnedMockImports } from '../imports';
import { combineSchemasMock } from './combine';

export const overrideVarName = 'overrideResponse';

function wrapRootNullableObjectValue(
  value: string,
  schemaItem: MockSchemaObject,
  mockOptions: MockOptions | undefined,
  combine?: GetMockObjectOptions['combine'],
): { value: string; nullWrapped: boolean } {
  const nullableAtRoot =
    !combine && isNullableSchema(schemaItem) && !mockOptions?.nonNullable;

  return {
    value: nullableAtRoot ? getNullable(value, true) : value,
    nullWrapped: nullableAtRoot,
  };
}

function getReferenceName(
  ref: string | undefined,
  context: ContextSpec,
): string {
  if (!ref) return '';

  return getRefInfo(ref, context).name;
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
  // Tracks the current contiguous `allOf` composition to break cyclic
  // inheritance. See `existingReferencedAllOfRefs` docs in getters/combine.ts.
  existingReferencedAllOfRefs?: string[];
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
  existingReferencedAllOfRefs = [],
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
      existingReferencedAllOfRefs,
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
      existingReferencedAllOfRefs,
      splitMockImplementations,
    });
  }

  if (Array.isArray(itemType)) {
    const nonNullTypes = mockOptions?.nonNullable
      ? itemType.filter((type) => type !== 'null')
      : itemType;

    if (nonNullTypes.length === 0) {
      return { value: 'null', imports: [], name: schemaItem.name };
    }

    if (nonNullTypes.length === 1) {
      return getMockObject({
        item: {
          ...schemaItem,
          type: nonNullTypes[0],
        } as MockSchemaObject & Record<string, unknown>,
        mockOptions,
        operationId,
        tags,
        combine,
        context,
        imports,
        existingReferencedProperties,
        existingReferencedAllOfRefs,
        splitMockImplementations,
        allowOverride,
      });
    }

    // Spread the base schema into each type entry so that object properties
    // (e.g. `properties`, `required`, `additionalProperties`) are preserved.
    // Without this, `{ type: "object", properties: {...} }` collapses to
    // `{ type: "object" }` and the mock generator returns `{}` instead of
    // building the actual object shape. Mirrors the fix in core getters/object.ts.
    const baseItem = schemaItem as Record<string, unknown>;
    return combineSchemasMock({
      item: {
        anyOf: nonNullTypes.map((type) => ({
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
      existingReferencedAllOfRefs,
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
            existingReferencedProperties.includes(
              getReferenceName(prop.$ref, context),
            )
          ) {
            if (isRequired) {
              const keyDefinition = getKey(key);
              return `${keyDefinition}: null`;
            }
            return;
          }

          const importsBefore = imports.length;
          const resolvedValue = resolveMockValue({
            schema: {
              ...(prop as Record<string, unknown>),
              name: key,
              parentName: schemaItem.name,
              path: schemaItem.path ? `${schemaItem.path}.${key}` : `#.${key}`,
            },
            mockOptions,
            operationId,
            tags,
            context,
            imports,
            existingReferencedProperties,
            // A property value is a fresh mock instance, not part of this
            // object's allOf composition — reset the chain.
            // See `existingReferencedAllOfRefs` docs in getters/combine.ts.
            existingReferencedAllOfRefs: [],
            splitMockImplementations,
          });

          mergeReturnedMockImports(
            imports,
            importsBefore,
            resolvedValue.imports,
          );

          includedProperties.push(key);

          const keyDefinition = getKey(key);

          const hasDefault = 'default' in prop && prop.default !== undefined;

          if (!isRequired && !resolvedValue.overrided && !hasDefault) {
            const omitValue =
              mockOptions?.nonNullable || !hasNullable ? 'undefined' : 'null';
            return `${keyDefinition}: faker.helpers.arrayElement([${resolvedValue.value}, ${omitValue}])`;
          }

          const isNullable =
            Array.isArray(prop.type) && prop.type.includes('null');
          if (
            isNullable &&
            !resolvedValue.nullWrapped &&
            !resolvedValue.overrided &&
            !mockOptions?.nonNullable
          ) {
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

    const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
      value,
      schemaItem,
      mockOptions,
      combine,
    );

    return {
      value: finalValue,
      nullWrapped,
      imports,
      name: schemaItem.name,
      includedProperties,
    };
  }

  if (itemAdditionalProperties) {
    if (itemAdditionalProperties === true) {
      const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
        `{}`,
        schemaItem,
        mockOptions,
        combine,
      );

      return {
        value: finalValue,
        nullWrapped,
        imports: [],
        name: schemaItem.name,
      };
    }
    const additionalProperties = itemAdditionalProperties;
    if (
      isReference(additionalProperties) &&
      existingReferencedProperties.includes(
        getReferenceName(additionalProperties.$ref, context),
      )
    ) {
      const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
        `{}`,
        schemaItem,
        mockOptions,
        combine,
      );

      return {
        value: finalValue,
        nullWrapped,
        imports: [],
        name: schemaItem.name,
      };
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
      // An additionalProperties value is a fresh mock instance — reset the
      // chain, as with property values above.
      // See `existingReferencedAllOfRefs` docs in getters/combine.ts.
      existingReferencedAllOfRefs: [],
      splitMockImplementations,
    });

    const objectValue = `{
        [${DEFAULT_OBJECT_KEY_MOCK}]: ${resolvedValue.value}
      }`;
    const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
      objectValue,
      schemaItem,
      mockOptions,
      combine,
    );

    return {
      ...resolvedValue,
      value: finalValue,
      nullWrapped: nullWrapped || resolvedValue.nullWrapped,
    };
  }

  const { value: finalValue, nullWrapped } = wrapRootNullableObjectValue(
    '{}',
    schemaItem,
    mockOptions,
    combine,
  );

  return { value: finalValue, nullWrapped, imports: [], name: schemaItem.name };
}
