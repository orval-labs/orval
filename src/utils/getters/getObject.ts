import {pascal} from 'case';
import {ReferenceObject, SchemaObject} from 'openapi3-ts';
import {generalTypesFilter} from '../generalTypesFilter';
import {isReference} from '../isReference';
import {resolveValue} from '../resolvers/resolveValue';
import {getRef} from './getRef';

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
export const getObject = (
  item: SchemaObject,
  name?: string
): {
  value: string;
  imports?: string[];
  schemas?: Array<{name: string; model: string; imports?: string[]}>;
} => {
  if (isReference(item)) {
    const value = getRef(item.$ref);
    return {value, imports: [value]};
  }

  if (item.allOf) {
    return item.allOf.reduce<{
      value: string;
      imports?: string[];
      schemas?: Array<{name: string; model: string; imports?: string[]}>;
    }>(
      (acc, val) => {
        const {value, imports = [], schemas = []} = resolveValue(val, name);
        return {
          ...acc,
          value: acc.value ? `${acc.value} & ${value}` : value,
          imports: [...acc.imports, ...imports],
          schemas: [...acc.schemas, ...schemas]
        };
      },
      {value: '', imports: [], schemas: []}
    );
  }

  if (item.oneOf) {
    return item.oneOf.reduce<{
      value: string;
      imports?: string[];
      schemas?: Array<{name: string; model: string; imports?: string[]}>;
    }>(
      (acc, val) => {
        const {value, imports = [], schemas = []} = resolveValue(val, name);
        return {
          ...acc,
          value: acc.value ? `${acc.value} | ${value}` : value,
          imports: [...acc.imports, ...imports],
          schemas: [...acc.schemas, ...schemas]
        };
      },
      {value: '', imports: [], schemas: []}
    );
  }

  if (item.properties) {
    return Object.entries(item.properties).reduce<{
      value: string;
      imports?: string[];
      schemas?: Array<{name: string; model: string; imports?: string[]}>;
    }>(
      (
        acc,
        [key, prop]: [string, ReferenceObject | SchemaObject],
        index,
        arr
      ) => {
        let value = acc.value;
        let imports = acc.imports;
        let schemas = acc.schemas;
        const isRequired = (item.required || []).includes(key);
        const propName = name ? name + pascal(key) : undefined;
        const resolvedValue = resolveValue(prop, propName);
        if (!index) {
          value = value + '{';
        }
        if (
          propName &&
          !resolvedValue.isEnum &&
          resolvedValue?.type === 'object' &&
          resolvedValue.value.includes('{') &&
          resolvedValue.value.includes('}')
        ) {
          imports = [...imports, propName];

          schemas = [
            ...schemas,
            {
              name: propName,
              model: `export type ${propName} = ${resolvedValue.value}`,
              imports: generalTypesFilter(resolvedValue.imports)
            }
          ];

          value = value + `${key}${isRequired ? '' : '?'}: ${propName};`;
        } else {
          imports = [...imports, ...(resolvedValue.imports || [])];
          value =
            value + `${key}${isRequired ? '' : '?'}: ${resolvedValue.value};`;
        }

        if (arr.length - 1 === index) {
          value = value + '}';
        }

        return {
          value,
          imports,
          schemas
        };
      },
      {
        imports: [],
        schemas: [],
        value: ''
      }
    );
  }

  if (item.additionalProperties) {
    if (typeof item.additionalProperties === 'boolean') {
      return {value: `{[key: string]: object}`};
    }
    const {value, imports = [], schemas = []} = resolveValue(
      item.additionalProperties,
      name
    );
    return {value: `{[key: string]: ${value}}`, imports, schemas};
  }

  return {value: item.type === 'object' ? '{}' : 'any'};
};
