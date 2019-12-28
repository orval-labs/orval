import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { getRef } from './getRef';
import { isReference } from '../isReference';
import { resolveValue } from '../resolvers/resolveValue';

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
export const getObject = (item: SchemaObject): { value: string; imports?: string[] } => {
  if (isReference(item)) {
    const value = getRef(item.$ref);
    return { value, imports: [value] };
  }

  if (item.allOf) {
    let imports: string[] = [];
    return {
      value: item.allOf
        .map(val => {
          const resolvedValue = resolveValue(val);
          imports = [...imports, ...(resolvedValue.imports || [])];
          return resolvedValue.value;
        })
        .join(' & '),
      imports,
    };
  }

  if (item.oneOf) {
    let imports: string[] = [];
    return {
      value: item.oneOf
        .map(val => {
          const resolvedValue = resolveValue(val);
          imports = [...imports, ...(resolvedValue.imports || [])];
          return resolvedValue.value;
        })
        .join(' | '),
      imports,
    };
  }

  if (item.properties) {
    let imports: string[] = [];
    return {
      value:
        '{' +
        Object.entries(item.properties)
          .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
            const isRequired = (item.required || []).includes(key);
            const resolvedValue = resolveValue(prop);
            imports = [...imports, ...(resolvedValue.imports || [])];
            return `${key}${isRequired ? '' : '?'}: ${resolvedValue.value}`;
          })
          .join('; ') +
        '}',
      imports,
    };
  }

  if (item.additionalProperties) {
    const { value, imports } = resolveValue(item.additionalProperties);
    return { value: `{[key: string]: ${value}}`, imports };
  }

  return { value: item.type === 'object' ? '{}' : 'any' };
};
