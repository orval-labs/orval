import { SchemaObject, SchemasObject } from 'openapi3-ts';
import { OverrideOutput } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { getArray } from './array';
import { getObject } from './object';

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#data-types
 */
export const getScalar = ({
  item,
  name,
  schemas = {},
  override,
}: {
  item: SchemaObject;
  name?: string;
  schemas: SchemasObject;
  override: OverrideOutput;
}): ResolverValue => {
  const nullable = item.nullable ? ' | null' : '';

  if (!item.type && item.items) {
    item.type = 'array';
  }

  switch (item.type) {
    case 'number':
    case 'integer': {
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
      const { value, ...rest } = getArray({
        schema: item,
        name,
        schemas,
        override,
      });
      return {
        value: value + nullable,
        ...rest,
      };
    }

    case 'string': {
      let value = 'string';
      let isEnum = false;

      if (item.enum) {
        value = `'${item.enum.join(`' | '`)}'`;
        isEnum = true;
      }

      if (item.format === 'binary') {
        value = 'Blob';
      }

      if (
        override.date &&
        (item.format === 'date' || item.format === 'date-time')
      ) {
        return {
          value: 'Date' + nullable,
          isEnum: false,
          type: 'string',
          imports: [],
          schemas: [],
        };
      }

      return {
        value: value + nullable,
        isEnum,
        type: 'string',
        imports: [],
        schemas: [],
      };
    }

    case 'object':
    default: {
      const { value, ...rest } = getObject({ item, name, schemas, override });
      return { value: value + nullable, ...rest };
    }
  }
};
