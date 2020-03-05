import {pascal} from 'case';
import cuid from 'cuid';
import get from 'lodash/get';
import {ReferenceObject, SchemaObject} from 'openapi3-ts';
import {MockOptions} from '../../types';
import {isReference} from '../isReference';
import {getRef} from './getRef';

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

const resolveValue = ({
  schema,
  schemas,
  allOf,
  mockOptions,
  operationId
}: {
  schema: SchemaObject & {name: string; parent?: string};
  schemas: {[key: string]: SchemaObject};
  operationId: string;
  allOf?: boolean;
  mockOptions?: MockOptions<{[key: string]: unknown}>;
}): MockDefinition => {
  if (isReference(schema)) {
    const value = getRef(schema.$ref);
    const newSchema = {
      ...schemas[value],
      name: value,
      parent: schema.parent ? `${schema.parent}.${schema.name}` : schema.name
    };

    if (!newSchema) {
      return {value: 'undefined', imports: [], name: value};
    }

    return getMockDefinition({
      item: newSchema,
      schemas,
      allOf,
      mockOptions,
      operationId
    });
  }

  return getMockDefinition({
    item: schema,
    schemas,
    allOf,
    mockOptions,
    operationId
  });
};

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
const getObject = ({
  item,
  schemas,
  allOf,
  mockOptions,
  operationId
}: {
  item: SchemaObject & {name: string; parent?: string};
  schemas: {[key: string]: SchemaObject};
  operationId: string;
  allOf?: boolean;
  mockOptions?: MockOptions<{[key: string]: any}>;
}): MockDefinition => {
  if (isReference(item)) {
    return resolveValue({
      schema: {...item, schemas, name: item.name},
      schemas,
      mockOptions,
      operationId
    });
  }

  if (item.allOf) {
    let imports: string[] = [];
    const value = item.allOf.reduce((acc, val, index, arr) => {
      const resolvedValue = resolveValue({
        schema: {...val, name: item.name},
        schemas,
        allOf: true,
        mockOptions,
        operationId
      });

      imports = [...imports, ...resolvedValue.imports];
      if (!index && !allOf) {
        return '{' + resolvedValue.value + ',';
      }
      if (arr.length - 1 === index) {
        return acc + resolvedValue.value + (!allOf ? '}' : '');
      }
      return acc + resolvedValue.value + ',';
    }, '');

    return {
      value,
      imports,
      name: item.name
    };
  }

  if (item.oneOf) {
    let imports: string[] = [];
    return {
      value: `faker.helpers.randomize(${item.oneOf.map(val => {
        const resolvedValue = resolveValue({
          schema: {...val, name: item.name},
          schemas,
          mockOptions,
          operationId
        });
        imports = [...imports, ...resolvedValue.imports];
        return resolvedValue.value;
      })})`,
      imports,
      name: item.name
    };
  }

  if (item.properties) {
    let value = !allOf ? '{' : '';
    let imports: string[] = [];
    value += Object.entries(item.properties)
      .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
        const isRequired = (item.required || []).includes(key);

        if (
          item.parent &&
          mockOptions?.responses?.[operationId]?.properties?.[
            `${item.parent}.${key}`
          ]
        ) {
          if (!isRequired) {
            return `${key}: faker.helpers.randomize([${
              mockOptions?.responses?.[operationId]?.properties?.[
                `${item.parent}.${key}`
              ]
            }, undefined])`;
          }

          return `${key}: ${
            mockOptions?.responses?.[operationId]?.properties?.[
              `${item.parent}.${key}`
            ]
          }`;
        }

        if (
          item.parent &&
          get(
            mockOptions?.responses?.[operationId]?.properties,
            `${item.parent}.${key}`
          )
        ) {
          if (!isRequired) {
            return `${key}: faker.helpers.randomize([${get(
              mockOptions?.responses?.[operationId]?.properties,
              `${item.parent}.${key}`
            )}, undefined])`;
          }

          return `${key}: ${get(
            mockOptions?.responses?.[operationId]?.properties,
            `${item.parent}.${key}`
          )}`;
        }

        const resolvedValue = resolveValue({
          schema: {...prop, name: key},
          schemas,
          mockOptions,
          operationId
        });
        imports = [...imports, ...resolvedValue.imports];
        if (!isRequired) {
          return `${key}: faker.helpers.randomize([${resolvedValue.value}, undefined])`;
        }

        return `${key}: ${resolvedValue.value}`;
      })
      .join(', ');
    value += !allOf ? '}' : '';
    return {value, imports, name: item.name};
  }

  if (item.additionalProperties) {
    if (typeof item.additionalProperties === 'boolean') {
      return {value: `{}`, imports: [], name: item.name};
    }
    const resolvedValue = resolveValue({
      schema: {...item.additionalProperties, name: item.name},
      schemas,
      mockOptions,
      operationId
    });

    return {
      ...resolvedValue,
      value: `{
        '${cuid()}': ${resolvedValue.value}
      }`
    };
  }

  return {value: '{}', imports: [], name: item.name};
};

interface MockDefinition {
  value: string | string[] | {[key: string]: MockDefinition};
  enums?: string[];
  imports: string[];
  name: string;
}

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#data-types
 */
export const getMockDefinition = ({
  item,
  schemas,
  allOf,
  mockOptions,
  operationId
}: {
  item: SchemaObject & {name: string; parent?: string};
  schemas: {[key: string]: SchemaObject};
  allOf?: boolean;
  mockOptions?: MockOptions<{[key: string]: any}>;
  operationId: string;
}): MockDefinition => {
  const rProperty = resolveMockProperties(
    mockOptions?.responses?.[operationId]?.properties,
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

      const {value, enums, imports, name} = resolveValue({
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
      return getObject({item, schemas, allOf, mockOptions, operationId});
    }
  }
};
