import {
  ContextSpecs,
  GeneratorImport,
  isReference,
  isSchema,
  MockOptions,
  pascal,
} from '@orval/core';
import { ReferenceObject, SchemaObject } from 'openapi3-ts/oas30';
import { MockDefinition, MockSchemaObject } from '../../types';
import { resolveMockValue } from '../resolvers';

// Helper function for type safety
const getRequired = (schema: SchemaObject | ReferenceObject): string[] => {
  if ('required' in schema && Array.isArray(schema.required)) {
    return schema.required;
  }
  return [];
};

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

  // Collect all required fields from the top-level schema
  const allRequiredFields: string[] = getRequired(item);

  // For allOf, extract and combine all required fields from the schemas
  if (separator === 'allOf' && item[separator]) {
    for (const schema of item[separator]) {
      allRequiredFields.push(...getRequired(schema));
    }
  }

  // Create an enhanced mockOptions that includes the combined required fields
  const enhancedMockOptions: MockOptions = {
    ...mockOptions,
    allRequiredFields: [...new Set(allRequiredFields)], // Deduplicate
  };

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
          mockOptions: enhancedMockOptions,
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

      // Propagate required fields to each schema
      if (separator === 'allOf') {
        // Create a copy we can safely modify
        const schemaWithRequired = { ...val };

        if (isSchema(schemaWithRequired)) {
          // For SchemaObject we can safely add the required property
          (schemaWithRequired as SchemaObject).required = [
            ...new Set([
              ...allRequiredFields,
              ...getRequired(schemaWithRequired),
            ]),
          ];

          val = schemaWithRequired;
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
        mockOptions: enhancedMockOptions,
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
          return `${acc}...{${resolvedValue.value}},`;
        }
      }
      return `${acc}${resolvedValue.value},`;
    },
    `${separator === 'allOf' ? '' : 'faker.helpers.arrayElement(['}`,
  );
  let finalValue =
    value === 'undefined'
      ? value
      : `${separator === 'allOf' && !containsOnlyPrimitiveValues ? '{' : ''}${value}${separator === 'allOf' ? (containsOnlyPrimitiveValues ? '' : '}') : '])'}`;
  if (itemResolvedValue) {
    if (finalValue.startsWith('...')) {
      finalValue = `...{${finalValue}, ${itemResolvedValue.value}}`;
    } else {
      finalValue = `{...${finalValue}, ${itemResolvedValue.value}}`;
    }
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
