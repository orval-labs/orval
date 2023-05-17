import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { resolveObject, resolveRef, resolveValue } from '../resolvers';
import { ContextSpecs, ScalarValue, SchemaType } from '../types';
import { isBoolean, isReference, jsDoc, pascal } from '../utils';
import { combineSchemas } from './combine';
import { getKey } from './keys';
import { getRefInfo } from './ref';

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
export const getObject = ({
  item,
  name,
  context,
  nullable,
}: {
  item: SchemaObject;
  name?: string;
  context: ContextSpecs;
  nullable: string;
}): ScalarValue => {
  if (isReference(item)) {
    const { name, specKey } = getRefInfo(item.$ref, context);
    return {
      value: name + nullable,
      imports: [{ name, specKey }],
      schemas: [],
      isEnum: false,
      type: 'object',
      isRef: true,
      hasReadonlyProps: item.readOnly || false,
    };
  }

  if (item.allOf || item.oneOf || item.anyOf) {
    const separator = item.allOf ? 'allOf' : item.oneOf ? 'oneOf' : 'anyOf';

    return combineSchemas({
      schema: item,
      name,
      separator,
      context,
      nullable,
    });
  }

  if (item.type instanceof Array) {
    return combineSchemas({
      schema: { anyOf: item.type.map((type) => ({ type })) },
      name,
      separator: 'anyOf',
      context,
      nullable,
    });
  }

  if (item.properties && Object.entries(item.properties).length > 0) {
    return Object.entries(item.properties).reduce(
      (
        acc,
        [key, schema]: [string, ReferenceObject | SchemaObject],
        index,
        arr,
      ) => {
        const isRequired = (
          Array.isArray(item.required) ? item.required : []
        ).includes(key);

        let propName = '';

        if (name) {
          const isKeyStartWithUnderscore = key.startsWith('_');

          propName += pascal(
            `${isKeyStartWithUnderscore ? '_' : ''}${name}_${key}`,
          );
        }

        const allSpecSchemas =
          context.specs[context.target]?.components?.schemas ?? {};

        const isNameAlreadyTaken = Object.keys(allSpecSchemas).some(
          (schemaName) => pascal(schemaName) === propName,
        );

        if (isNameAlreadyTaken) {
          propName = propName + 'Property';
        }

        const resolvedValue = resolveObject({
          schema,
          propName,
          context,
        });

        const isReadOnly = item.readOnly || (schema as SchemaObject).readOnly;
        if (!index) {
          acc.value += '{';
        }

        const doc = jsDoc(resolvedValue.originalSchema, true);

        acc.hasReadonlyProps ||= isReadOnly || false;
        acc.imports.push(...resolvedValue.imports);
        acc.value += `\n  ${doc ? `${doc}  ` : ''}${
          isReadOnly ? 'readonly ' : ''
        }${getKey(key)}${isRequired ? '' : '?'}: ${resolvedValue.value};`;
        acc.schemas.push(...resolvedValue.schemas);

        if (arr.length - 1 === index) {
          if (item.additionalProperties) {
            if (isBoolean(item.additionalProperties)) {
              acc.value += `\n  [key: string]: any;\n }`;
            } else {
              const resolvedValue = resolveValue({
                schema: item.additionalProperties,
                name,
                context,
              });
              acc.value += `\n  [key: string]: ${resolvedValue.value};\n}`;
            }
          } else {
            acc.value += '\n}';
          }

          acc.value += nullable;
        }

        return acc;
      },
      {
        imports: [],
        schemas: [],
        value: '',
        isEnum: false,
        type: 'object' as SchemaType,
        isRef: false,
        schema: {},
        hasReadonlyProps: false,
      } as ScalarValue,
    );
  }

  if (item.additionalProperties) {
    if (isBoolean(item.additionalProperties)) {
      return {
        value: `{ [key: string]: any }` + nullable,
        imports: [],
        schemas: [],
        isEnum: false,
        type: 'object',
        isRef: false,
        hasReadonlyProps: item.readOnly || false,
      };
    }
    const resolvedValue = resolveValue({
      schema: item.additionalProperties,
      name,
      context,
    });
    return {
      value: `{[key: string]: ${resolvedValue.value}}` + nullable,
      imports: resolvedValue.imports ?? [],
      schemas: resolvedValue.schemas ?? [],
      isEnum: false,
      type: 'object',
      isRef: false,
      hasReadonlyProps: resolvedValue.hasReadonlyProps,
    };
  }

  return {
    value:
      item.type === 'object' ? '{ [key: string]: any }' : 'unknown' + nullable,
    imports: [],
    schemas: [],
    isEnum: false,
    type: 'object',
    isRef: false,
    hasReadonlyProps: item.readOnly || false,
  };
};
