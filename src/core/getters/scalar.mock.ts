import { SchemaObject } from 'openapi3-ts';
import { DEFAULT_FORMAT_MOCK } from '../../constants/format.mock';
import { MockOptions } from '../../types';
import { MockDefinition } from '../../types/mocks';
import { mergeDeep } from '../../utils/mergeDeep';
import {
  getNullable,
  resolveMockOverride,
  resolveMockValue,
} from '../resolvers/value.mock';
import { getMockObject } from './object.mock';

export const getMockScalar = ({
  item,
  schemas,
  allOf,
  mockOptions,
  operationId,
  tags,
}: {
  item: SchemaObject & { name: string; path?: string; isRef?: boolean };
  schemas: { [key: string]: SchemaObject };
  allOf?: boolean;
  mockOptions?: MockOptions;
  operationId: string;
  isRef?: boolean;
  tags: string[];
}): MockDefinition => {
  const operationProperty = resolveMockOverride(
    mockOptions?.operations?.[operationId]?.properties,
    item,
  );

  if (operationProperty) {
    return operationProperty;
  }

  const overrideTag = Object.entries(mockOptions?.tags || {}).reduce<
    MockOptions | undefined
  >(
    (acc, [tag, options]) =>
      tags.includes(tag) ? mergeDeep(acc, options) : acc,
    undefined,
  );

  const tagProperty = resolveMockOverride(overrideTag?.properties, item);

  if (tagProperty) {
    return tagProperty;
  }

  const property = resolveMockOverride(mockOptions?.properties, item);

  if (property) {
    return property;
  }

  const ALL_FORMAT: Record<string, string> = {
    ...DEFAULT_FORMAT_MOCK,
    ...(mockOptions?.format || {}),
  };

  if (item.format && ALL_FORMAT[item.format]) {
    return {
      value: getNullable(ALL_FORMAT[item.format], item.nullable),
      imports: [],
      name: item.name,
      overrided: false,
    };
  }

  switch (item.type) {
    case 'number':
    case 'integer': {
      return {
        value: getNullable('faker.random.number()', item.nullable),
        imports: [],
        name: item.name,
      };
    }

    case 'boolean': {
      return { value: 'faker.random.boolean()', imports: [], name: item.name };
    }

    case 'array': {
      if (!item.items) {
        return { value: [], imports: [], name: item.name };
      }

      const { value, enums, imports, name } = resolveMockValue({
        schema: {
          ...item.items,
          name: item.name,
          path: item.path ? `${item.path}.[]` : '#.[]',
        },
        schemas,
        allOf,
        mockOptions,
        operationId,
        tags,
      });

      if (enums) {
        return {
          value: `[...Array(faker.random.number({min:1, max: ${enums.length}}))].reduce(({values, enums}) => {
            const newValue = enums[faker.random.number({min:1, max: enums.length})];
            return {
              values: [...values, newValue],
              enums: enums.filter((v: ${name}) => newValue !== v)
            }
          },{ values: [], enums: Object.values(${name})})`,
          imports,
          name: item.name,
        };
      }

      return {
        value: `[...Array(faker.random.number({min: 1, max: 10}))].map(() => (${value}))`,
        imports,
        name: item.name,
      };
    }

    case 'string': {
      let value = 'faker.random.word()';
      let imports: string[] = [];

      if (item.enum) {
        let enumValue = "['" + item.enum.join("','") + "']";

        if (item.isRef) {
          enumValue = `Object.values(${item.name})`;
          imports = [item.name];
        }

        value = `faker.helpers.randomize(${enumValue})`;
      }

      return {
        value: getNullable(value, item.nullable),
        enums: item.enum,
        name: item.name,
        imports,
      };
    }

    case 'object':
    default: {
      return getMockObject({
        item,
        schemas,
        allOf,
        mockOptions,
        operationId,
        tags,
      });
    }
  }
};
