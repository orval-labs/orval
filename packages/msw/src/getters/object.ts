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
import { resolveMockValue } from '../resolvers/value';
import { MockDefinition, MockSchemaObject } from '../types';
import { combineSchemasMock } from './combine';
import { DEFAULT_OBJECT_KEY_MOCK } from '../constants';

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
    let value =
      !combine ||
      combine?.separator === 'oneOf' ||
      combine?.separator === 'anyOf'
        ? '{'
        : '';
    let imports: GeneratorImport[] = [];
    let includedProperties: string[] = [];
    value += Object.entries(item.properties)
      .sort((a, b) => {
        return a[0].localeCompare(b[0]);
      })
      .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
        if (combine?.includedProperties.includes(key)) {
          return undefined;
        }

        const isRequired =
          mockOptions?.required ||
          (Array.isArray(item.required) ? item.required : []).includes(key);

        if (count(item.path, `\\.${key}\\.`) >= 1) {
          return undefined;
        }

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

        const keyDefinition = getKey(key);
        if (!isRequired && !resolvedValue.overrided) {
          return `${keyDefinition}: faker.helpers.arrayElement([${resolvedValue.value}, undefined])`;
        }

        return `${keyDefinition}: ${resolvedValue.value}`;
      })
      .filter(Boolean)
      .join(', ');
    value +=
      !combine ||
      combine?.separator === 'oneOf' ||
      combine?.separator === 'anyOf'
        ? '}'
        : '';
    return {
      value,
      imports,
      name: item.name,
      includedProperties,
    };
  }

  if (item.additionalProperties) {
    if (isBoolean(item.additionalProperties)) {
      return { value: `{}`, imports: [], name: item.name };
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
      value: `{
        [${DEFAULT_OBJECT_KEY_MOCK}]: ${resolvedValue.value}
      }`,
    };
  }

  return { value: '{}', imports: [], name: item.name };
};
