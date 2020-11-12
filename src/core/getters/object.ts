import { ReferenceObject, SchemaObject, SchemasObject } from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { pascal } from '../../utils/case';
import { isBoolean, isReference } from '../../utils/is';
import { resolveObject } from '../resolvers/object';
import { resolveValue } from '../resolvers/value';
import { combineSchemas } from './combine';
import { getKey } from './keys';
import { getRef } from './ref';

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
export const getObject = (
  item: SchemaObject,
  name?: string,
  schemas: SchemasObject = {},
): ResolverValue => {
  if (isReference(item)) {
    const value = getRef(item.$ref);
    return {
      value,
      imports: [value],
      schemas: [],
      isEnum: false,
      type: 'object',
    };
  }

  if (item.allOf) {
    return combineSchemas({ items: item.allOf, name, schemas, separator: '&' });
  }

  if (item.oneOf) {
    return combineSchemas({ items: item.oneOf, name, schemas, separator: '|' });
  }

  if (item.anyOf) {
    return combineSchemas({ items: item.anyOf, name, schemas, separator: '|' });
  }

  if (item.properties) {
    return Object.entries(item.properties).reduce<ResolverValue>(
      (
        acc,
        [key, schema]: [string, ReferenceObject | SchemaObject],
        index,
        arr,
      ) => {
        const isRequired = (item.required || []).includes(key);
        const propName = name ? name + pascal(key) : undefined;
        const resolvedValue = resolveObject({ schema, propName, schemas });
        const isReadOnly = item.readOnly || (schema as SchemaObject).readOnly;
        if (!index) {
          acc.value += '{';
        }
        acc.imports = [...acc.imports, ...resolvedValue.imports];
        acc.value += `\n  ${isReadOnly ? 'readonly ' : ''}${getKey(key)}${
          isRequired ? '' : '?'
        }: ${resolvedValue.value};`;
        acc.schemas = [...acc.schemas, ...resolvedValue.schemas];

        if (arr.length - 1 === index) {
          acc.value += '\n}';
        }

        return acc;
      },
      {
        imports: [],
        schemas: [],
        value: '',
        isEnum: false,
        type: 'object',
      },
    );
  }

  if (item.additionalProperties) {
    if (isBoolean(item.additionalProperties)) {
      return {
        value: `{[key: string]: object}`,
        imports: [],
        schemas: [],
        isEnum: false,
        type: 'object',
      };
    }
    const resolvedValue = resolveValue({
      schema: item.additionalProperties,
      name,
      schemas,
    });
    return {
      value: `{[key: string]: ${resolvedValue.value}}`,
      imports: resolvedValue.imports || [],
      schemas: resolvedValue.schemas || [],
      isEnum: false,
      type: 'object',
    };
  }

  return {
    value: item.type === 'object' ? '{}' : 'unknown',
    imports: [],
    schemas: [],
    isEnum: false,
    type: 'object',
  };
};
