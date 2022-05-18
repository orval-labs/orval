import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { isString } from '../../utils/is';
import { escape } from '../../utils/string';
import { getArray } from './array';
import { getObject } from './object';

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#data-types
 */
export const getScalar = async ({
  item,
  name,
  context,
}: {
  item: SchemaObject;
  name?: string;
  context: ContextSpecs;
}): Promise<ResolverValue> => {
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
        isRef: false,
      };
    }

    case 'boolean':
      return {
        value: 'boolean' + nullable,
        type: 'boolean',
        isEnum: false,
        schemas: [],
        imports: [],
        isRef: false,
      };

    case 'array': {
      const { value, ...rest } = await getArray({
        schema: item,
        name,
        context,
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
        value = `'${item.enum
          .map((enumItem: string) =>
            isString(enumItem) ? escape(enumItem) : enumItem,
          )
          .filter(Boolean)
          .join(`' | '`)}'`;
        isEnum = true;
      }

      if (item.format === 'binary') {
        value = 'Blob';
      }

      if (context.override.useDates) {
        if (item.format === 'date' || item.format === 'date-time') {
          value = 'Date';
        }
      }

      return {
        value: value + nullable,
        isEnum,
        type: 'string',
        imports: [],
        schemas: [],
        isRef: false,
      };
    }

    case 'object':
    default: {
      const { value, ...rest } = await getObject({
        item,
        name,
        context,
        nullable,
      });
      return { value: value, ...rest };
    }
  }
};
