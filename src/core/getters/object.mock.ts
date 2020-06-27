import cuid from 'cuid';
import get from 'lodash/get';
import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { MockOptions } from '../../types';
import { MockDefinition } from '../../types/mocks';
import { isBoolean, isReference } from '../../utils/is';
import { resolveMockValue } from '../resolvers/value.mock';

export const getMockObject = ({
  item,
  schemas,
  allOf,
  mockOptions,
  operationId,
}: {
  item: SchemaObject & { name: string; parents?: string[] };
  schemas: { [key: string]: SchemaObject };
  operationId: string;
  allOf?: boolean;
  mockOptions?: MockOptions;
}): MockDefinition => {
  if (isReference(item)) {
    return resolveMockValue({
      schema: { ...item, schemas, name: item.name },
      schemas,
      mockOptions,
      operationId,
    });
  }

  if (item.allOf) {
    let imports: string[] = [];
    const value = item.allOf.reduce((acc, val, index, arr) => {
      const resolvedValue = resolveMockValue({
        schema: { ...val, name: item.name },
        schemas,
        allOf: true,
        mockOptions,
        operationId,
      });

      imports = [...imports, ...resolvedValue.imports];
      if (!index && !allOf) {
        if (resolvedValue.enums) {
          return 'faker.helpers.randomize([' + resolvedValue.value + ',';
        }
        return '{' + resolvedValue.value + ',';
      }
      if (arr.length - 1 === index) {
        if (resolvedValue.enums) {
          return acc + resolvedValue.value + (!allOf ? '])' : '');
        }
        return acc + resolvedValue.value + (!allOf ? '}' : '');
      }
      return acc + resolvedValue.value + ',';
    }, '');

    return {
      value,
      imports,
      name: item.name,
    };
  }

  if (item.oneOf) {
    let imports: string[] = [];
    const value = item.oneOf.reduce((acc, val, index, arr) => {
      const resolvedValue = resolveMockValue({
        schema: { ...val, name: item.name },
        schemas,
        allOf: true,
        mockOptions,
        operationId,
      });

      imports = [...imports, ...resolvedValue.imports];
      if (!index && !allOf) {
        if (resolvedValue.enums) {
          return 'faker.helpers.randomize([' + resolvedValue.value + ',';
        }
        return '{' + resolvedValue.value + ',';
      }
      if (arr.length - 1 === index) {
        if (resolvedValue.enums) {
          return acc + resolvedValue.value + (!allOf ? '])' : '');
        }
        return acc + resolvedValue.value + (!allOf ? '}' : '');
      }
      return acc + resolvedValue.value + ',';
    }, '');

    return {
      value,
      imports,
      name: item.name,
    };
  }

  if (item.properties) {
    let value = !allOf ? '{' : '';
    let imports: string[] = [];
    value += Object.entries(item.properties)
      .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
        const isRequired = (item.required || []).includes(key);

        if (
          item.parents &&
          mockOptions?.operations?.[operationId]?.properties?.[
            `${item.parents.join('.')}.${key}`
          ]
        ) {
          if (!isRequired) {
            return `${key}: faker.helpers.randomize([${
              mockOptions?.operations?.[operationId]?.properties?.[
                `${item.parents.join('.')}.${key}`
              ]
            }, undefined])`;
          }

          return `${key}: ${
            mockOptions?.operations?.[operationId]?.properties?.[
              `${item.parents.join('.')}.${key}`
            ]
          }`;
        }

        if (
          item.parents &&
          get(
            mockOptions?.operations?.[operationId]?.properties,
            `${item.parents.join('.')}.${key}`,
          )
        ) {
          if (!isRequired) {
            return `${key}: faker.helpers.randomize([${get(
              mockOptions?.operations?.[operationId]?.properties,
              `${item.parents.join('.')}.${key}`,
            )}, undefined])`;
          }

          return `${key}: ${get(
            mockOptions?.operations?.[operationId]?.properties,
            `${item.parents.join('.')}.${key}`,
          )}`;
        }

        const resolvedValue = resolveMockValue({
          schema: {
            ...prop,
            name: key,
            parents: item.parents,
          },
          schemas,
          mockOptions,
          operationId,
        });
        imports = [...imports, ...resolvedValue.imports];
        if (!isRequired) {
          return `${key}: faker.helpers.randomize([${resolvedValue.value}, undefined])`;
        }

        return `${key}: ${resolvedValue.value}`;
      })
      .join(', ');
    value += !allOf ? '}' : '';
    return { value, imports, name: item.name };
  }

  if (item.additionalProperties) {
    if (isBoolean(item.additionalProperties)) {
      return { value: `{}`, imports: [], name: item.name };
    }
    const resolvedValue = resolveMockValue({
      schema: { ...item.additionalProperties, name: item.name },
      schemas,
      mockOptions,
      operationId,
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
