import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { isReference } from '../isReference';
import { getRef } from './getRef';

const getNullable = (value: string, nullable?: boolean) =>
  nullable ? `faker.helpers.randomize([${value}, null])` : value;

const resolveValue = (
  schema: SchemaObject,
  schemas: { [key: string]: SchemaObject },
  allOf?: boolean,
): MockDefinition => {
  if (isReference(schema)) {
    const value = getRef(schema.$ref);
    const newSchema = schemas[value];

    if (!newSchema) {
      return { value: 'undefined' };
    }

    return getMockDefinition(newSchema, schemas, allOf);
  }

  return getMockDefinition(schema, schemas, allOf);
};

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
const getObject = (item: SchemaObject, schemas: { [key: string]: SchemaObject }, allOf?: boolean): MockDefinition => {
  if (isReference(item)) {
    return resolveValue(item, schemas);
  }

  if (item.allOf) {
    return {
      value: item.allOf.reduce((acc, val, index, arr) => {
        if (!index && !allOf) {
          return '{' + resolveValue(val, schemas, true).value + ',';
        }
        if (arr.length - 1 === index) {
          return acc + resolveValue(val, schemas, true).value + (!allOf ? '}' : '');
        }
        return acc + resolveValue(val, schemas, true).value + ',';
      }, '') as any,
    };
  }

  if (item.oneOf) {
    return { value: item.oneOf.map(val => resolveValue(val, schemas).value) as any };
  }

  if (item.properties) {
    let value = !allOf ? '{' : '';
    value += Object.entries(item.properties)
      .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
        const isRequired = (item.required || []).includes(key);

        if (!isRequired) {
          return `${key}: faker.helpers.randomize([${resolveValue(prop, schemas).value}, undefined])`;
        }

        return `${key}: ${resolveValue(prop, schemas).value}`;
      })
      .join(', ');
    value += !allOf ? '}' : '';
    return { value };
  }

  if (item.additionalProperties) {
    return resolveValue(item.additionalProperties, schemas);
  }

  return { value: '{}' };
};

interface MockDefinition {
  value: string | string[] | { [key: string]: MockDefinition };
  enums?: string[];
}

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#data-types
 */
export const getMockDefinition = (
  item: SchemaObject,
  schemas: { [key: string]: SchemaObject },
  allOf?: boolean,
): MockDefinition => {
  switch (item.type) {
    case 'int32':
    case 'int64':
    case 'number':
    case 'integer':
    case 'long':
    case 'float':
    case 'double':
      return { value: getNullable('faker.random.number()', item.nullable) };

    case 'boolean':
      return { value: 'faker.random.boolean()' };

    case 'array': {
      if (!item.items) {
        return { value: [] };
      }

      const { value, enums } = resolveValue(item.items, schemas, allOf);

      if (enums) {
        return {
          value: `[...Array(faker.random.number({min:1, max: ${enums.length}}))].map(() => [${enums.map(
            e => `'${e}'`,
          )}].splice(faker.random.number({min:1, max: ${enums.length}}), 1))`,
        };
      }

      return {
        value: `[...Array(faker.random.number({min: 1, max: 10}))].map(() => (${value}))`,
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
        value = `faker.helpers.randomize([${item.enum.map(e => `'${e}'`).join(',')}])`;
      }

      return { value: getNullable(value, item.nullable), enums: item.enum };
    }

    case 'object':
    default: {
      return getObject(item, schemas, allOf);
    }
  }
};
