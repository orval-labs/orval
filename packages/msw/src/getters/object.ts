import {
  ContextSpecs,
  count,
  GeneratorImport,
  getKey,
  isBoolean,
  isReference,
  MockOptions,
} from '@orval/core';
import cuid from 'cuid';
import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { getOptional, resolveMockValue } from '../resolvers/value';
import { MockDefinition, MockSchemaObject, MockValue } from '../types';
import { combineSchemasMock } from './combine';

export const getMockObject = ({
  item,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
  imports,
}: {
  item: MockSchemaObject;
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: {
    separator: 'allOf' | 'oneOf' | 'anyOf';
    includedProperties: string[];
  };
  context: ContextSpecs;
  imports: GeneratorImport[];
}): MockDefinition => {
  if (isReference(item)) {
    return resolveMockValue({
      schema: {
        ...item,
        name: item.name,
        path: item.path ? `${item.path}.${item.name}` : item.name,
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
    });
  }

  if (item.allOf || item.oneOf || item.anyOf) {
    const separator = item.allOf ? 'allOf' : item.oneOf ? 'oneOf' : 'anyOf';
    return combineSchemasMock({
      item,
      separator,
      mockOptions,
      operationId,
      tags,
      combine,
      context,
      imports,
    });
  }

  if (item.properties) {
    let includedProperties: string[] = [];

    const value = Object.entries(item.properties)
      .filter(([key]) => {
        if (combine?.includedProperties.includes(key)) {
          return false;
        }

        if (count(item.path, `\\.${key}\\.`) >= 1) {
          return false;
        }

        return true;
      })
      .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
        const resolvedValue = resolveMockValue({
          schema: {
            ...prop,
            name: key,
            path: item.path ? `${item.path}.${key}` : `#.${key}`,
          },
          mockOptions,
          operationId,
          tags,
          context,
          imports,
        });

        imports.push(...resolvedValue.imports);
        includedProperties.push(key);

        const isRequired =
          mockOptions?.required ||
          (Array.isArray(item.required) ? item.required : []).includes(key);

        const keyDefinition = getKey(key);
        if (!isRequired && !resolvedValue.overrided) {
          return {
            [keyDefinition]: getOptional(resolvedValue.value),
          };
        }

        return { [keyDefinition]: resolvedValue.value };
      })
      .reduce((acc, cur) => ({ ...acc, ...cur }), {});

    return {
      value: { type: 'object', value },
      imports,
      name: item.name,
      includedProperties,
    };
  }

  if (item.additionalProperties) {
    if (isBoolean(item.additionalProperties)) {
      return {
        value: { type: 'object', value: {} },
        imports: [],
        name: item.name,
      };
    }

    const resolvedValue = resolveMockValue({
      schema: {
        ...item.additionalProperties,
        name: item.name,
        path: item.path ? `${item.path}.#` : '#',
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
    });

    return {
      ...resolvedValue,
      value: {
        type: 'object',
        value: {
          [cuid()]: resolvedValue.value,
        },
      },
    };
  }

  return { value: { type: 'object', value: {} }, imports: [], name: item.name };
};
