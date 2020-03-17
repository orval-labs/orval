import {pascal} from 'case';
import {ReferenceObject, SchemaObject} from 'openapi3-ts';
import {ResolverValue} from '../../types/resolvers';
import {isReference} from '../../utils/is';
import {resolveValue} from '../resolvers/resolveValue';
import {getRef} from './getRef';

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
      type: 'object'
    };
  }

  if (item.allOf) {
    return item.allOf.reduce<ResolverValue>(
      (acc, val) => {
        const {value, imports, schemas} = resolveValue(val, name);
        return {
          ...acc,
          value: acc.value ? `${acc.value} & ${value}` : value,
          imports: [...acc.imports, ...imports],
          schemas: [...acc.schemas, ...schemas]
        };
      },
      {value: '', imports: [], schemas: [], isEnum: false, type: 'object'}
    );
  }

  if (item.oneOf) {
    return item.oneOf.reduce<ResolverValue>(
      (acc, val) => {
        const {value, imports, schemas} = resolveValue(val, name);
        return {
          ...acc,
          value: acc.value ? `${acc.value} | ${value}` : value,
          imports: [...acc.imports, ...imports],
          schemas: [...acc.schemas, ...schemas]
        };
      },
      {value: '', imports: [], schemas: [], isEnum: false, type: 'object'}
    );
  }

  if (item.properties) {
    return Object.entries(item.properties).reduce<ResolverValue>(
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
              imports: resolvedValue.imports
            }
          ];

          value = value + `${key}${isRequired ? '' : '?'}: ${propName};`;
        } else {
          imports = [...imports, ...resolvedValue.imports];
          value =
            value + `${key}${isRequired ? '' : '?'}: ${resolvedValue.value};`;
        }

        if (arr.length - 1 === index) {
          value = value + '}';
        }

        return {
          ...acc,
          value,
          imports,
          schemas
        };
      },
      {
        imports: [],
        schemas: [],
        value: '',
        isEnum: false,
        type: 'object'
      }
    );
  }

  if (item.additionalProperties) {
    if (typeof item.additionalProperties === 'boolean') {
      return {
        value: `{[key: string]: object}`,
        imports: [],
        schemas: [],
        isEnum: false,
        type: 'object'
      };
    }
    const {value, imports = [], schemas = []} = resolveValue(
      item.additionalProperties,
      name
    );
    return {
      value: `{[key: string]: ${value}}`,
      imports,
      schemas,
      isEnum: false,
      type: 'object'
    };
  }

  return {
    value: item.type === 'object' ? '{}' : 'any',
    imports: [],
    schemas: [],
    isEnum: false,
    type: 'object'
  };
};
