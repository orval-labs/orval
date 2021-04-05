import { SchemaObject } from 'openapi3-ts';
import { InputTarget, MockOptions } from '../../types';
import { MockDefinition } from '../../types/mocks';
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
  nullable ? `faker.helpers.randomize([${value}, null])` : value;

export const resolveMockValue = async ({
  schema,
  schemas,
  mockOptions,
  operationId,
  tags,
  combine,
  target,
}: {
  schema: SchemaObject & { name: string; path?: string; specKey?: string };
  schemas: { [key: string]: SchemaObject };
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: { properties: string[] };
  target: InputTarget;
}): Promise<MockDefinition> => {
  if (isReference(schema)) {
    const { name, specKey } = await getRefInfo(schema.$ref, {
      ...target,
      path: schema.specKey || target.path,
    });

    const newSchema = {
      ...getSchema(name, schemas, specKey || schema.specKey),
      name,
      path: schema.path,
      isRef: true,
      specKey: specKey || schema.specKey,
    };

    return getMockScalar({
      item: newSchema,
      schemas,
      mockOptions,
      operationId,
      tags,
      combine,
      target,
    });
  }

  return getMockScalar({
    item: schema,
    schemas,
    mockOptions,
    operationId,
    tags,
    combine,
    target,
  });
};
