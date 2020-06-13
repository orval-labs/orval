import { SchemaObject } from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { getArray } from './array';
import { getObject } from './object';

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#data-types
 */
export const getScalar = (item: SchemaObject, name?: string): ResolverValue => {
  const nullable = item.nullable ? ' | null' : '';

  switch (item.type) {
    case 'int32':
    case 'int64':
    case 'number':
    case 'integer':
    case 'long':
    case 'float':
    case 'double': {
      let value = 'number';
      let isEnum = false;

      if (item.enum) {
        value = item.enum.join(' | ');
        isEnum = true;
      }

      return {
        value: value + nullable,
        isEnum,
        type: 'number',
        schemas: [],
        imports: [],
      };
    }

    case 'boolean':
      return {
        value: 'boolean' + nullable,
        type: 'boolean',
        isEnum: false,
        schemas: [],
        imports: [],
      };

    case 'array': {
      const { value, ...rest } = getArray(item, name);
      return {
        value: value + nullable,
        ...rest,
      };
    }

    case 'string':
    case 'byte':
    case 'binary':
    case 'date':
    case 'dateTime':
    case 'date-time':
    case 'password': {
      let value = 'string';
      let isEnum = false;

      if (item.enum) {
        value = `'${item.enum.join(`' | '`)}'`;
        isEnum = true;
      }

      if (item.format === 'binary') {
        value = 'Blob';
      }

      return {
        value: value + nullable,
        isEnum,
        type: 'string',
        imports: [],
        schemas: [],
      };
    }

    case 'object': {
      const { value, ...rest } = getObject(item, name);
      return { value: value + nullable, ...rest };
    }
    default: {
      return {
        value: 'unknown' + nullable,
        isEnum: false,
        type: 'unknown',
        imports: [],
        schemas: [],
      };
    }
  }
};
