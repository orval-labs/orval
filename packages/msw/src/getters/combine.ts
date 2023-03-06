import {
  ContextSpecs,
  GeneratorImport,
  isReference,
  MockOptions,
} from '@orval/core';
import omit from 'lodash.omit';
import { resolveMockValue } from '../resolvers';
import {
  mergeValues,
  MockDefinition,
  MockSchemaObject,
  MockValue,
} from '../types';

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
}): MockDefinition => {
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
  combineImports.push(...(itemResolvedValue?.imports ?? []));

  console.log(item, separator, operationId, item[separator]);

  const value = {
    type: separator,
    value: (item[separator] ?? []).map(
      extractKeys({
        item,
        separator,
        includedProperties,
        itemResolvedValue,
        mockOptions,
        operationId,
        tags,
        context,
        imports,
        combineImports,
        combine,
      }),
    ),
  };

  console.log('COMBINE', item.name, JSON.stringify(value));

  return {
    value,
    imports: combineImports,
    name: item.name,
    includedProperties,
  };
};

const extractKeys =
  (ctx) =>
  (val): MockValue => {
    const resolvedValue = resolveMockValue({
      schema: {
        ...val,
        name: ctx.item.name,
        path: ctx.item.path ?? '#',
      },
      combine: {
        separator: ctx.separator,
        includedProperties:
          ctx.separator !== 'oneOf'
            ? ctx.includedProperties
            : ctx.itemResolvedValue?.includedProperties ?? [],
      },
      mockOptions: ctx.mockOptions,
      operationId: ctx.operationId,
      tags: ctx.tags,
      context: ctx.context,
      imports: ctx.imports,
    });

    ctx.combineImports.push(...resolvedValue.imports);
    ctx.includedProperties.push(...(resolvedValue.includedProperties ?? []));

    let currentValue = resolvedValue.value;

    if (ctx.itemResolvedValue?.value) {
      currentValue = mergeValues(currentValue, ctx.itemResolvedValue.value);
    }

    console.log('EXTRACT', val);
    console.log(currentValue);
    console.log(ctx.itemResolvedValue.value);

    return currentValue;
  };
