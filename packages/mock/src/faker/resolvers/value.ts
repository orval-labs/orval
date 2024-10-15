import {
  ContextSpecs,
  GeneratorImport,
  getRefInfo,
  isReference,
  isRootKey,
  MockOptions,
  pascal,
} from '@orval/core';
import get from 'lodash.get';
import { SchemaObject } from 'openapi3-ts/oas30';
import { MockDefinition, MockSchemaObject } from '../../types';
import { overrideVarName } from '../getters';
import { getMockScalar } from '../getters/scalar';

const isRegex = (key: string) => key[0] === '/' && key[key.length - 1] === '/';

export const resolveMockOverride = (
  properties: Record<string, unknown> | undefined = {},
  item: SchemaObject & { name: string; path?: string },
) => {
  const path = item.path ? item.path : `#.${item.name}`;
  const property = Object.entries(properties).find(([key]) => {
    if (isRegex(key)) {
      const regex = new RegExp(key.slice(1, key.length - 1));
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

  return {
    value: getNullable(property[1] as string, item.nullable),
    imports: [],
    name: item.name,
    overrided: true,
  };
};

export const getNullable = (value: string, nullable?: boolean) =>
  nullable ? `faker.helpers.arrayElement([${value}, null])` : value;

export const resolveMockValue = ({
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
}: {
  schema: MockSchemaObject;
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
  allowOverride?: boolean;
}): MockDefinition & { type?: string } => {
  if (isReference(schema)) {
    const {
      originalName,
      specKey = context.specKey,
      refPaths,
    } = getRefInfo(schema.$ref, context);

    const schemaRef = get(context.specs[specKey], refPaths as string[]);

    const newSchema = {
      ...schemaRef,
      name: pascal(originalName),
      path: schema.path,
      isRef: true,
    };

    const newSeparator = newSchema.allOf
      ? 'allOf'
      : newSchema.oneOf
        ? 'oneOf'
        : 'anyOf';

    const scalar = getMockScalar({
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
      context: {
        ...context,
        specKey,
      },
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
        !splitMockImplementations?.some((f) =>
          f.includes(`export const ${funcName}`),
        )
      ) {
        const discriminatedProperty = newSchema.discriminator?.propertyName;

        let type = `Partial<${newSchema.name}>`;
        if (discriminatedProperty) {
          type = `Omit<${type}, '${discriminatedProperty}'>`;
        }

        const args = `${overrideVarName}: ${type} = {}`;
        const value = newSchema.oneOf
          ? `faker.helpers.arrayElement([${scalar.value}])`
          : scalar.value;
        const func = `export const ${funcName} = (${args}): ${newSchema.name} => ({...${value}, ...${overrideVarName}});`;
        splitMockImplementations?.push(func);
      }

      if (newSchema.nullable) {
        scalar.value = `${funcName}()`;
      } else {
        scalar.value = `{...${funcName}()}`;
      }

      scalar.imports.push({
        name: newSchema.name,
        specKey: isRootKey(specKey, context.target) ? undefined : specKey,
      });
    }

    if (scalar.value && newSchema.allOf && combine?.separator === 'anyOf') {
      scalar.value = `{${scalar.value}}`;
    }

    return {
      ...scalar,
      type: newSchema.type,
    };
  }

  const scalar = getMockScalar({
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

  return {
    ...scalar,
    type: schema.type,
  };
};
