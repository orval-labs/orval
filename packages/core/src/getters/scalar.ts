import { isArray } from 'remeda';

import { resolveExampleRefs } from '../resolvers';
import type { ContextSpec, OpenApiSchemaObject, ScalarValue } from '../types';
import { escape, isString } from '../utils';
import { getArray } from './array';
import { combineSchemas } from './combine';
import { getObject } from './object';

interface GetScalarOptions {
  item: OpenApiSchemaObject;
  name?: string;
  context: ContextSpec;
}

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.1.md#data-types
 */
export function getScalar({
  item,
  name,
  context,
}: GetScalarOptions): ScalarValue {
  const nullable =
    isArray(item.type) && item.type.includes('null') ? ' | null' : '';

  const enumItems = item.enum?.filter((enumItem) => enumItem !== null);

  let itemType = item.type;
  if (!itemType && item.items) {
    item.type = 'array';
    itemType = 'array';
  }
  if (isArray(item.type) && item.type.includes('null')) {
    const typesWithoutNull = item.type.filter((x) => x !== 'null');
    itemType =
      typesWithoutNull.length === 1 ? typesWithoutNull[0] : typesWithoutNull;
  }

  switch (itemType) {
    case 'number':
    case 'integer': {
      let value =
        context.output.override.useBigInt &&
        (item.format === 'int64' || item.format === 'uint64')
          ? 'bigint'
          : 'number';
      let isEnum = false;

      if (enumItems) {
        value = enumItems
          .map((enumItem: number | null) => `${enumItem}`)
          .join(' | ');
        isEnum = true;
      }

      value += nullable;

      const itemWithConst = item;
      if (itemWithConst.const !== undefined) {
        value = itemWithConst.const;
      }

      return {
        value,
        isEnum,
        type: 'number',
        schemas: [],
        imports: [],
        isRef: false,
        hasReadonlyProps: item.readOnly || false,
        dependencies: [],
        example: item.example,
        examples: resolveExampleRefs(item.examples, context),
      };
    }

    case 'boolean': {
      let value = 'boolean' + nullable;

      const itemWithConst = item;
      if (itemWithConst.const !== undefined) {
        value = itemWithConst.const;
      }

      return {
        value: value,
        type: 'boolean',
        isEnum: false,
        schemas: [],
        imports: [],
        isRef: false,
        hasReadonlyProps: item.readOnly || false,
        dependencies: [],
        example: item.example,
        examples: resolveExampleRefs(item.examples, context),
      };
    }

    case 'array': {
      const { value, ...rest } = getArray({
        schema: item,
        name,
        context,
      });
      return {
        value: value + nullable,
        ...rest,
        dependencies: rest.dependencies ?? [],
      };
    }

    case 'string': {
      let value = 'string';
      let isEnum = false;

      if (enumItems) {
        value = enumItems
          .map((enumItem: string | null) =>
            isString(enumItem) ? `'${escape(enumItem)}'` : `${enumItem}`,
          )
          .filter(Boolean)
          .join(` | `);

        isEnum = true;
      }

      if (item.format === 'binary') {
        value = 'Blob';
      }

      if (
        context.output.override.useDates &&
        (item.format === 'date' || item.format === 'date-time')
      ) {
        value = 'Date';
      }

      value += nullable;

      const itemWithConst = item;
      if (itemWithConst.const) {
        value = `'${itemWithConst.const}'`;
      }

      return {
        value: value,
        isEnum,
        type: 'string',
        imports: [],
        schemas: [],
        isRef: false,
        hasReadonlyProps: item.readOnly || false,
        dependencies: [],
        example: item.example,
        examples: resolveExampleRefs(item.examples, context),
      };
    }

    case 'null': {
      return {
        value: 'null',
        isEnum: false,
        type: 'null',
        imports: [],
        schemas: [],
        isRef: false,
        hasReadonlyProps: item.readOnly || false,
        dependencies: [],
      };
    }

    case 'object':
    default: {
      if (isArray(itemType)) {
        return combineSchemas({
          schema: {
            anyOf: itemType.map((type) => ({
              ...item,
              type,
            })),
          },
          name,
          separator: 'anyOf',
          context,
          nullable,
        });
      }

      if (enumItems) {
        const value = enumItems
          .map((enumItem: unknown) =>
            isString(enumItem) ? `'${escape(enumItem)}'` : `${enumItem}`,
          )
          .filter(Boolean)
          .join(` | `);

        return {
          value: value + nullable,
          isEnum: true,
          type: 'string',
          imports: [],
          schemas: [],
          isRef: false,
          hasReadonlyProps: item.readOnly || false,
          dependencies: [],
          example: item.example,
          examples: resolveExampleRefs(item.examples, context),
        };
      }

      const { value, ...rest } = getObject({
        item,
        name,
        context,
        nullable,
      });
      return { value: value, ...rest };
    }
  }
}
