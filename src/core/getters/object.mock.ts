import cuid from 'cuid';
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
  tags,
}: {
  item: SchemaObject & { name: string; path?: string };
  schemas: { [key: string]: SchemaObject };
  operationId: string;
  allOf?: boolean;
  mockOptions?: MockOptions;
  tags: string[];
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

  if (item.allOf) {
    let imports: string[] = [];
    const value = item.allOf.reduce((acc, val, index, arr) => {
      const resolvedValue = resolveMockValue({
        schema: {
          ...val,
          name: item.name,
          path: item.path ? item.path : '#',
        },
        schemas,
        allOf: true,
        mockOptions,
        operationId,
        tags,
      });

      imports = [...imports, ...resolvedValue.imports];
      if (!index && !allOf) {
        if (resolvedValue.enums) {
          if (arr.length === 1) {
            return `faker.helpers.randomize([${resolvedValue.value}])`;
          }
          return `faker.helpers.randomize([${resolvedValue.value},`;
        }
        if (arr.length === 1) {
          return `{${resolvedValue.value}}`;
        }
        return `{${resolvedValue.value},`;
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
        schema: {
          ...val,
          name: item.name,
          path: item.path ? item.path : '#',
        },
        schemas,
        allOf: true,
        mockOptions,
        operationId,
        tags,
      });

      imports = [...imports, ...resolvedValue.imports];
      if (!index && !allOf) {
        if (resolvedValue.enums) {
          if (arr.length === 1) {
            return `faker.helpers.randomize([${resolvedValue.value}])`;
          }
          return `faker.helpers.randomize([${resolvedValue.value},`;
        }
        if (arr.length === 1) {
          return `{${resolvedValue.value}}`;
        }
        return `{${resolvedValue.value},`;
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

        if (item.path?.includes(`.${key}.`) && Math.random() >= 0.5) {
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

        if (!isRequired && !resolvedValue.overrided) {
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
