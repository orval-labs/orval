import omit from 'lodash.omit';
import { ContextSpecs, MockOptions } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { MockSchemaObject } from '../../types/mocks';
import { isReference } from '../../utils/is';
import { resolveMockValue } from '../resolvers/value.mock';

export const combineSchemasMock = ({
  item,
  separator,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
  imports,
}: {
  item: MockSchemaObject;
  separator: 'allOf' | 'oneOf' | 'anyOf';
  operationId: string;
  mockOptions?: MockOptions;
  tags: string[];
  combine?: {
    separator: 'allOf' | 'oneOf' | 'anyOf';
    includedProperties: string[];
  };
  context: ContextSpecs;
  imports: GeneratorImport[];
}) => {
  let combineImports: GeneratorImport[] = [];
  let includedProperties: string[] = (combine?.includedProperties ?? []).slice(
    0,
  );
  const itemResolvedValue =
    isReference(item) || item.properties
      ? resolveMockValue({
          schema: omit(item, separator) as MockSchemaObject,
          combine: {
            separator: 'allOf',
            includedProperties: [],
          },
          mockOptions,
          operationId,
          tags,
          context,
          imports,
        })
      : undefined;

  includedProperties.push(...(itemResolvedValue?.includedProperties ?? []));

  const value = (item[separator] ?? []).reduce((acc, val, index, arr) => {
    const resolvedValue = resolveMockValue({
      schema: {
        ...val,
        name: item.name,
        path: item.path ? item.path : '#',
        specKey: item.specKey,
      },
      combine: {
        separator,
        includedProperties:
          separator !== 'oneOf'
            ? includedProperties
            : itemResolvedValue?.includedProperties ?? [],
      },
      mockOptions,
      operationId,
      tags,
      context,
      imports,
    });

    combineImports.push(...resolvedValue.imports);
    includedProperties.push(...(resolvedValue.includedProperties ?? []));

    const value =
      itemResolvedValue?.value && separator === 'oneOf'
        ? `${resolvedValue.value.slice(0, -1)},${itemResolvedValue.value}}`
        : resolvedValue.value;

    if (!index && !combine) {
      if (resolvedValue.enums || separator === 'oneOf') {
        if (arr.length === 1) {
          return `faker.helpers.arrayElement([${value}])`;
        }
        return `faker.helpers.arrayElement([${value},`;
      }
      if (arr.length === 1) {
        if (resolvedValue.type !== 'object') {
          return `${value}`;
        }
        return `{${value}}`;
      }
      return `{${value},`;
    }
    if (arr.length - 1 === index) {
      if (resolvedValue.enums || separator === 'oneOf') {
        return `${acc}${value}${!combine ? '])' : ''}`;
      }
      return `${acc}${value}${
        itemResolvedValue?.value ? `,${itemResolvedValue.value}` : ''
      }${!combine ? '}' : ''}`;
    }
    if (!value) {
      return acc;
    }
    return `${acc}${value},`;
  }, '');

  return {
    value,
    imports: combineImports,
    name: item.name,
    includedProperties,
  };
};
