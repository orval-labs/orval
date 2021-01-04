import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { MockOptions } from '../../types';
import { resolveMockValue } from '../resolvers/value.mock';

export const combineSchemasMock = ({
  item,
  items,
  schemas,
  mockOptions,
  operationId,
  tags,
  combine,
}: {
  item: SchemaObject & { name: string; path?: string };
  items: (SchemaObject | ReferenceObject)[];
  schemas: { [key: string]: SchemaObject };
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: { properties: string[] };
}) => {
  let imports: string[] = [];
  let properties: string[] = [...(combine?.properties || [])];
  const value = items.reduce((acc, val, index, arr) => {
    const resolvedValue = resolveMockValue({
      schema: {
        ...val,
        name: item.name,
        path: item.path ? item.path : '#',
      },
      schemas,
      combine: {
        properties,
      },
      mockOptions,
      operationId,
      tags,
    });

    imports = [...imports, ...resolvedValue.imports];
    properties = [...properties, ...(resolvedValue.properties || [])];

    if (!index && !combine) {
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
        return acc + resolvedValue.value + (!combine ? '])' : '');
      }
      return acc + resolvedValue.value + (!combine ? '}' : '');
    }
    if (!resolvedValue.value) {
      return acc;
    }
    return acc + resolvedValue.value + ',';
  }, '');

  return {
    value,
    imports,
    name: item.name,
    properties,
  };
};
