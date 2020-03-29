import {pascal} from 'case';
import {SchemaObject} from 'openapi3-ts';
import {MockOptions} from '../../types';
import {MockDefinition} from '../../types/mocks';
import {resolveMockValue} from '../resolvers/value.mock';
import {getMockObject} from './object.mock';

const resolveMockProperties = (
  properties: any = {},
  item: SchemaObject & {name: string; parent?: string}
) =>
  Object.entries(properties).reduce((acc, [key, value]) => {
    const regex =
      key[0] === '/' && key[key.length - 1] === '/'
        ? new RegExp(key.slice(1, key.length - 1))
        : new RegExp(key);

    if (acc || !regex.test(item.name)) {
      return acc;
    }
    return {
      value: getNullable(value as string, item.nullable),
      imports: [],
      name: item.name
    };
  }, undefined as any);

const getNullable = (value: string, nullable?: boolean) =>
  nullable ? `faker.helpers.randomize([${value}, null])` : value;

export const getMockScalar = ({
  item,
  schemas,
  allOf,
  mockOptions,
  operationId
}: {
  item: SchemaObject & {name: string; parent?: string};
  schemas: {[key: string]: SchemaObject};
  allOf?: boolean;
  mockOptions?: MockOptions;
  operationId: string;
}): MockDefinition => {
  const rProperty = resolveMockProperties(
    mockOptions?.operations?.[operationId]?.properties,
    item
  );

  if (rProperty) {
    return rProperty;
  }

  const property = resolveMockProperties(mockOptions?.properties, item);

  if (property) {
    return property;
  }

  switch (item.type) {
    case 'int32':
    case 'int64':
    case 'number':
    case 'integer':
    case 'long':
    case 'float':
    case 'double': {
      return {
        value: getNullable('faker.random.number()', item.nullable),
        imports: [],
        name: item.name
      };
    }

    case 'boolean': {
      return {value: 'faker.random.boolean()', imports: [], name: item.name};
    }

    case 'array': {
      if (!item.items) {
        return {value: [], imports: [], name: item.name};
      }

      const {value, enums, imports, name} = resolveMockValue({
        schema: {...item.items, name: item.name},
        schemas,
        allOf,
        mockOptions,
        operationId
      });

      if (enums) {
        return {
          value: `[...Array(faker.random.number({min:1, max: ${enums.length}}))].reduce(({values, enums}) => {
            const newValue = enums[faker.random.number({min:1, max: enums.length})];
            return {
              values: [...values, newValue],
              enums: enums.filter(v => newValue !== v)
            }
          },{ values: [], enums: Object.values(${name})})`,
          imports,
          name: item.name
        };
      }

      return {
        value: `[...Array(faker.random.number({min: 1, max: 10}))].map(() => (${value}))`,
        imports,
        name: item.name
      };
    }

    case 'string':
    case 'byte':
    case 'binary':
    case 'date':
    case 'dateTime':
    case 'date-time':
    case 'password': {
      let value = 'faker.random.word()';

      if (item.enum) {
        value = `faker.helpers.randomize(Object.values(${item.name}))`;
      }

      return {
        value: getNullable(value, item.nullable),
        enums: item.enum,
        name: item.name,
        imports: item.enum ? [pascal(item.name)] : []
      };
    }

    case 'object':
    default: {
      return getMockObject({item, schemas, allOf, mockOptions, operationId});
    }
  }
};
