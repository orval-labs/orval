import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { pascal } from '../../utils/case';
import { isBoolean, isReference } from '../../utils/is';
import { resolveObject } from '../resolvers/object';
import { resolveValue } from '../resolvers/value';
import { getKey } from './keys';
import { getRef } from './ref';

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
export const getObject = (item: SchemaObject, name?: string): ResolverValue => {
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
    return item.allOf.reduce<ResolverValue>(
      (acc, val) => {
        const propName = name ? name + 'Data' : undefined;
        const resolvedValue = resolveObject(val, propName);

        return {
          ...acc,
          value: acc.value
            ? `${acc.value} & ${resolvedValue.value}`
            : resolvedValue.value,
          imports: [...acc.imports, ...resolvedValue.imports],
          schemas: [...acc.schemas, ...resolvedValue.schemas],
        };
      },
      { value: '', imports: [], schemas: [], isEnum: false, type: 'object' },
    );
  }

  if (item.oneOf) {
    return item.oneOf.reduce<ResolverValue>(
      (acc, val) => {
        const propName = name ? name + 'Data' : undefined;
        const resolvedValue = resolveObject(val, propName);
        return {
          ...acc,
          value: acc.value
            ? `${acc.value} | ${resolvedValue.value}`
            : resolvedValue.value,
          imports: [...acc.imports, ...resolvedValue.imports],
          schemas: [...acc.schemas, ...resolvedValue.schemas],
        };
      },
      { value: '', imports: [], schemas: [], isEnum: false, type: 'object' },
    );
  }

  if (item.properties) {
    return Object.entries(item.properties).reduce<ResolverValue>(
      (
        acc,
        [key, prop]: [string, ReferenceObject | SchemaObject],
        index,
        arr,
      ) => {
        const isRequired = (item.required || []).includes(key);
        const propName = name ? name + pascal(key) : undefined;
        const resolvedValue = resolveObject(prop, propName);
        const isReadOnly = item.readOnly || (prop as SchemaObject).readOnly;
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
    const { value, imports = [], schemas = [] } = resolveValue(
      item.additionalProperties,
      name,
    );
    return {
      value: `{[key: string]: ${value}}`,
      imports,
      schemas,
      isEnum: false,
      type: 'object',
    };
  }

  return {
    value: item.type === 'object' ? '{}' : 'any',
    imports: [],
    schemas: [],
    isEnum: false,
    type: 'object',
  };
};
