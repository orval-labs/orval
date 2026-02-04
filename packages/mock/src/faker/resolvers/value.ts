import {
  type ContextSpec,
  extractBrandName,
  type GeneratorImport,
  getRefInfo,
  isBrandableSchemaType,
  isReference,
  type MockOptions,
  type OpenApiSchemaObject,
  pascal,
} from '@orval/core';
import { prop } from 'remeda';

import type { MockDefinition, MockSchemaObject } from '../../types';
import { overrideVarName } from '../getters';
import { getMockScalar } from '../getters/scalar';

/**
 * Apply branded type assertion to a mock value if the schema has x-brand and is a brandable type.
 */
function maybeApplyBrandedMockType(
  scalar: MockDefinition,
  schema: MockSchemaObject,
): MockDefinition {
  const brandName = extractBrandName(schema);

  if (!brandName || !isBrandableSchemaType(schema)) {
    return scalar;
  }

  const brandedImport: GeneratorImport = {
    name: brandName,
  };

  return {
    ...scalar,
    value: `${scalar.value} as ${brandName}`,
    imports: [...scalar.imports, brandedImport],
  };
}

function isRegex(key: string) {
  return key.startsWith('/') && key.endsWith('/');
}

export function resolveMockOverride(
  properties: Record<string, unknown> | undefined = {},
  item: OpenApiSchemaObject & { name: string; path?: string },
) {
  const path = item.path ?? `#.${item.name}`;
  const property = Object.entries(properties).find(([key]) => {
    if (isRegex(key)) {
      const regex = new RegExp(key.slice(1, -1));
      if (regex.test(item.name) || regex.test(path)) {
        return true;
      }
    }

    if (`#.${key}` === path) {
      return true;
    }

    return false;
  });

  if (!property) {
    return;
  }

  const isNullable = Array.isArray(item.type) && item.type.includes('null');

  return {
    value: getNullable(property[1] as string, isNullable),
    imports: [],
    name: item.name,
    overrided: true,
  };
}

export function getNullable(value: string, nullable?: boolean) {
  return nullable ? `faker.helpers.arrayElement([${value}, null])` : value;
}

interface ResolveMockValueOptions {
  schema: MockSchemaObject;
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
  allowOverride?: boolean;
}

export function resolveMockValue({
  schema,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
  imports,
  existingReferencedProperties,
  splitMockImplementations,
  allowOverride,
}: ResolveMockValueOptions): MockDefinition & { type?: string } {
  if (isReference(schema)) {
    const { originalName, refPaths } = getRefInfo(schema.$ref, context);

    const schemaRef = Array.isArray(refPaths)
      ? (prop(
          context.spec,
          // @ts-expect-error: [ts2556] refPaths are not guaranteed to be valid keys of the spec
          ...refPaths,
        ) as Partial<OpenApiSchemaObject>)
      : undefined;

    const newSchema = {
      ...schemaRef,
      name: pascal(originalName),
      path: schema.path,
      isRef: true,
      required: [...(schemaRef?.required ?? []), ...(schema.required ?? [])],
      ...(schema.nullable === undefined ? {} : { nullable: schema.nullable }),
    };

    const newSeparator = newSchema.allOf
      ? 'allOf'
      : newSchema.oneOf
        ? 'oneOf'
        : 'anyOf';

    let scalar = getMockScalar({
      item: newSchema,
      mockOptions,
      operationId,
      tags,
      combine: combine
        ? {
            separator:
              combine.separator === 'anyOf' ? newSeparator : combine.separator,
            includedProperties:
              newSeparator === 'allOf' ? [] : combine.includedProperties,
          }
        : undefined,
      context,
      imports,
      existingReferencedProperties,
      splitMockImplementations,
      allowOverride,
    });
    if (
      scalar.value &&
      (newSchema.type === 'object' || newSchema.allOf) &&
      combine?.separator === 'oneOf'
    ) {
      const funcName = `get${pascal(operationId)}Response${pascal(newSchema.name)}Mock`;
      if (
        !splitMockImplementations.some((f) =>
          f.includes(`export const ${funcName}`),
        )
      ) {
        const discriminatedProperty = newSchema.discriminator?.propertyName;

        let type = `Partial<${newSchema.name}>`;
        if (discriminatedProperty) {
          type = `Omit<${type}, '${discriminatedProperty}'>`;
        }

        const args = `${overrideVarName}: ${type} = {}`;
        const func = `export const ${funcName} = (${args}): ${newSchema.name} => ({${scalar.value.startsWith('...') ? '' : '...'}${scalar.value}, ...${overrideVarName}});`;
        splitMockImplementations.push(func);
      }

      scalar.value = newSchema.nullable
        ? `${funcName}()`
        : `{...${funcName}()}`;

      scalar.imports.push({ name: newSchema.name });
    }

    if (context.output.override.generateBrandedTypes) {
      scalar = maybeApplyBrandedMockType(scalar, newSchema);
    }

    return {
      ...scalar,
      type: getType(newSchema),
    };
  }

  let scalar = getMockScalar({
    item: schema,
    mockOptions,
    operationId,
    tags,
    combine,
    context,
    imports,
    existingReferencedProperties,
    splitMockImplementations,
    allowOverride,
  });

  if (context.output.override.generateBrandedTypes) {
    scalar = maybeApplyBrandedMockType(scalar, schema);
  }

  return {
    ...scalar,
    type: getType(schema),
  };
}

function getType(schema: MockSchemaObject) {
  return (
    (schema.type as string | undefined) ??
    (schema.properties ? 'object' : schema.items ? 'array' : undefined)
  );
}
