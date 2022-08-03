import cuid from 'cuid';
import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs, MockOptions } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { MockDefinition, MockSchemaObject } from '../../types/mocks';
import { isBoolean, isReference } from '../../utils/is';
import { count } from '../../utils/occurrence';
import { resolveMockValue } from '../resolvers/value.mock';
import { combineSchemasMock } from './combine.mock';
import { getKey } from './keys';

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
    let value = !combine || combine?.separator === 'oneOf' ? '{' : '';
    let imports: GeneratorImport[] = [];
    let includedProperties: string[] = [];
    value += Object.entries(item.properties)
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
    value += !combine || combine?.separator === 'oneOf' ? '}' : '';
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
        '${cuid()}': ${resolvedValue.value}
      }`,
    };
  }

  return { value: '{}', imports: [], name: item.name };
};
