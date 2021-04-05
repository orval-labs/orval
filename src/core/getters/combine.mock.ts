import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { InputTarget, MockOptions } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { asyncReduce } from '../../utils/async-reduce';
import { resolveMockValue } from '../resolvers/value.mock';

export const combineSchemasMock = async ({
  item,
  items,
  isOneOf,
  schemas,
  mockOptions,
  operationId,
  tags,
  combine,
  target,
}: {
  item: SchemaObject & { name: string; path?: string; specKey?: string };
  items: (SchemaObject | ReferenceObject)[];
  isOneOf: boolean;
  schemas: { [key: string]: SchemaObject };
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: { properties: string[] };
  target: InputTarget;
}) => {
  let imports: GeneratorImport[] = [];
  let properties: string[] = [...(combine?.properties || [])];
  const value = await asyncReduce(
    items,
    async (acc, val, index, arr) => {
      const resolvedValue = await resolveMockValue({
        schema: {
          ...val,
          name: item.name,
          path: item.path ? item.path : '#',
          specKey: item.specKey,
        },
        schemas,
        combine: !isOneOf
          ? {
              properties,
            }
          : undefined,
        mockOptions,
        operationId,
        tags,
        target,
      });

      imports = [...imports, ...resolvedValue.imports];
      properties = [...properties, ...(resolvedValue.properties || [])];

      if (!index && !combine) {
        if (resolvedValue.enums || isOneOf) {
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
        if (resolvedValue.enums || isOneOf) {
          return acc + resolvedValue.value + (!combine ? '])' : '');
        }
        return acc + resolvedValue.value + (!combine ? '}' : '');
      }
      if (!resolvedValue.value) {
        return acc;
      }
      return acc + resolvedValue.value + ',';
    },
    '',
  );

  return {
    value,
    imports,
    name: item.name,
    properties,
  };
};
