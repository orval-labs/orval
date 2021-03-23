import cuid from 'cuid';
import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { MockOptions } from '../../types';
import { MockDefinition } from '../../types/mocks';
import { isBoolean, isReference } from '../../utils/is';
import { count } from '../../utils/occurrence';
import { resolveMockValue } from '../resolvers/value.mock';
import { combineSchemasMock } from './combine.mock';

export const getMockObject = ({
  item,
  schemas,
  mockOptions,
  operationId,
  tags,
  combine,
}: {
  item: SchemaObject & { name: string; path?: string };
  schemas: { [key: string]: SchemaObject };
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: { properties: string[] };
}): MockDefinition => {
  if (isReference(item)) {
    return resolveMockValue({
      schema: {
        ...item,
        schemas,
        name: item.name,
        path: item.path ? `${item.path}.${item.name}` : item.name,
      },
      schemas,
      mockOptions,
      operationId,
      tags,
    });
  }

  if (item.allOf || item.oneOf || item.anyOf) {
    return combineSchemasMock({
      item,
      items: (item.allOf || item.oneOf || item.anyOf) as (
        | SchemaObject
        | ReferenceObject
      )[],
      schemas,
      mockOptions,
      operationId,
      tags,
      combine,
    });
  }

  if (item.properties) {
    let value = !combine ? '{' : '';
    let imports: string[] = [];
    let properties: string[] = [];
    value += Object.entries(item.properties)
      .map(([key, prop]: [string, ReferenceObject | SchemaObject], i) => {
        if (combine?.properties.includes(key)) {
          return undefined;
        }

        const isRequired =
          mockOptions?.required || (item.required || []).includes(key);

        if (count(item.path, `.${key}.`) >= 1) {
          return undefined;
        }

        const resolvedValue = resolveMockValue({
          schema: {
            ...prop,
            name: key,
            path: item.path ? `${item.path}.${key}` : `#.${key}`,
          },
          schemas,
          mockOptions,
          operationId,
          tags,
        });

        imports = [...imports, ...resolvedValue.imports];
        properties = [...properties, key];

        if (!isRequired && !resolvedValue.overrided) {
          return `${key}: faker.helpers.randomize([${resolvedValue.value}, undefined])`;
        }

        return `${key}: ${resolvedValue.value}`;
      })
      .filter(Boolean)
      .join(', ');
    value += !combine ? '}' : '';
    return {
      value,
      imports,
      name: item.name,
      properties,
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
      schemas,
      mockOptions,
      operationId,
      tags,
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
