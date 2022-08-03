import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs, MockOptions } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { MockDefinition, MockSchemaObject } from '../../types/mocks';
import { isReference } from '../../utils/is';
import { getRefInfo } from '../getters/ref';
import { getMockScalar } from '../getters/scalar.mock';
import { getSchema } from '../getters/schema';

const isRegex = (key: string) => key[0] === '/' && key[key.length - 1] === '/';

export const resolveMockOverride = (
  properties: Record<string, string> | undefined = {},
  item: SchemaObject & { name: string; path?: string },
) => {
  const property = Object.entries(properties).find(([key]) => {
    if (isRegex(key)) {
      const regex = new RegExp(key.slice(1, key.length - 1));
      if (regex.test(item.name)) {
        return true;
      }
    }

    if (`#.${key}` === (item.path ? item.path : `#.${item.name}`)) {
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
}): MockDefinition & { type?: string } => {
  if (isReference(schema)) {
    const { name, specKey = context.specKey } = getRefInfo(
      schema.$ref,
      context,
    );

    const newSchema = {
      ...getSchema(name, context, specKey),
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
  });

  return {
    ...scalar,
    type: schema.type,
  };
};
