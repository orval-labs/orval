import {ReferenceObject, SchemaObject} from 'openapi3-ts';
import {isReference} from '../isReference';
import {resolveValue} from '../resolvers/resolveValue';
import {getRef} from './getRef';

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
export const getObject = (
  item: SchemaObject
): {value: string; imports?: string[]} => {
  if (isReference(item)) {
    const value = getRef(item.$ref);
    return {value, imports: [value]};
  }

  if (item.allOf) {
    return item.allOf.reduce<{value: string; imports?: string[]}>(
      (acc, val) => {
        const {value, imports = []} = resolveValue(val);
        return {
          ...acc,
          value: acc.value ? `${acc.value} & ${value}` : value,
          imports: [...acc.imports, ...imports]
        };
      },
      {value: '', imports: []}
    );
  }

  if (item.oneOf) {
    return item.oneOf.reduce<{value: string; imports?: string[]}>(
      (acc, val) => {
        const {value, imports = []} = resolveValue(val);
        return {
          ...acc,
          value: acc.value ? `${acc.value} | ${value}` : value,
          imports: [...acc.imports, ...imports]
        };
      },
      {value: '', imports: []}
    );
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
      imports
    };
  }

  if (item.additionalProperties) {
    if (typeof item.additionalProperties === 'boolean') {
      return {value: `{[key: string]: object}`};
    }
    const {value, imports} = resolveValue(item.additionalProperties);
    return {value: `{[key: string]: ${value}}`, imports};
  }

  return {value: item.type === 'object' ? '{}' : 'any'};
};
