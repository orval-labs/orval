import {
  ContextSpecs,
  GeneratorImport,
  getRefInfo,
  isReference,
  MockOptions,
} from '@orval/core';
import get from 'lodash.get';
import { SchemaObject } from 'openapi3-ts/oas30';
import { getMockScalar } from '../getters/scalar';
import { MockDefinition, MockSchemaObject } from '../../types';

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
  allowOverride?: boolean;
}): MockDefinition & { type?: string } => {
  if (isReference(schema)) {
    const {
      name,
      specKey = context.specKey,
      refPaths,
    } = getRefInfo(schema.$ref, context);

    const schemaRef = get(context.specs[specKey], refPaths);

    const newSchema = {
      ...schemaRef,
      name,
      path: schema.path,
      isRef: true,
    };

    const scalar = getMockScalar({
      item: newSchema,
      mockOptions,
      operationId,
      tags,
      combine,
      context: {
        ...context,
        specKey,
      },
      imports,
      existingReferencedProperties,
      allowOverride,
    });

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
    allowOverride,
  });

  return {
    ...scalar,
    type: schema.type,
  };
};
