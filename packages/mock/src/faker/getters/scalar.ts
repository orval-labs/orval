import {
  type ContextSpecs,
  EnumGeneration,
  escape,
  type GeneratorImport,
  isReference,
  isRootKey,
  mergeDeep,
  type MockOptions,
  pascal,
} from '@orval/core';
import type { SchemaObject as SchemaObject31 } from 'openapi3-ts/oas31';

import type { MockDefinition, MockSchemaObject } from '../../types';
import { isFakerVersionV9 } from '../compatibleV9';
import { DEFAULT_FORMAT_MOCK } from '../constants';
import {
  getNullable,
  resolveMockOverride,
  resolveMockValue,
} from '../resolvers';
import { getMockObject } from './object';

export const getMockScalar = ({
  item,
  imports,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
  existingReferencedProperties,
  splitMockImplementations,
  allowOverride = false,
}: {
  item: MockSchemaObject;
  imports: GeneratorImport[];
  mockOptions?: MockOptions;
  operationId: string;
  isRef?: boolean;
  tags: string[];
  combine?: {
    separator: 'allOf' | 'oneOf' | 'anyOf';
    includedProperties: string[];
  };
  context: ContextSpecs;
  // This is used to prevent recursion when combining schemas
  // When an element is added to the array, it means on this iteration, we've already seen this property
  existingReferencedProperties: string[];
  splitMockImplementations: string[];
  // This is used to add the overrideResponse to the object
  allowOverride?: boolean;
}): MockDefinition => {
  // Add the property to the existing properties to validate on object recursion
  if (item.isRef) {
    existingReferencedProperties = [...existingReferencedProperties, item.name];
  }

  const operationProperty = resolveMockOverride(
    mockOptions?.operations?.[operationId]?.properties,
    item,
  );

  if (operationProperty) {
    return operationProperty;
  }

  const overrideTag = Object.entries(mockOptions?.tags ?? {})
    .sort((a, b) => {
      return a[0].localeCompare(b[0]);
    })
    .reduce(
      (acc, [tag, options]) =>
        tags.includes(tag) ? mergeDeep(acc, options) : acc,
      {} as { properties: Record<string, unknown> },
    );

  const tagProperty = resolveMockOverride(overrideTag?.properties, item);

  if (tagProperty) {
    return tagProperty;
  }

  const property = resolveMockOverride(mockOptions?.properties, item);

  if (property) {
    return property;
  }

  if (
    (context.output.override?.mock?.useExamples || mockOptions?.useExamples) &&
    item.example !== undefined
  ) {
    return {
      value: JSON.stringify(item.example),
      imports: [],
      name: item.name,
      overrided: true,
    };
  }

  const ALL_FORMAT = {
    ...DEFAULT_FORMAT_MOCK,
    ...mockOptions?.format,
  };

  if (item.format && ALL_FORMAT[item.format]) {
    let value = ALL_FORMAT[item.format] as string;

    const dateFormats = ['date', 'date-time'];
    if (dateFormats.includes(item.format) && context.output.override.useDates) {
      value = `new Date(${value})`;
    }

    return {
      value: getNullable(value, item.nullable),
      imports: [],
      name: item.name,
      overrided: false,
    };
  }

  const type = getItemType(item);
  const isFakerV9 =
    !!context.output.packageJson &&
    isFakerVersionV9(context.output.packageJson);

  switch (type) {
    case 'number':
    case 'integer': {
      const intFunction =
        context.output.override.useBigInt &&
        (item.format === 'int64' || item.format === 'uint64')
          ? 'bigInt'
          : 'int';
      let value = getNullable(
        `faker.number.${intFunction}({min: ${item.minimum ?? mockOptions?.numberMin}, max: ${item.maximum ?? mockOptions?.numberMax}${isFakerV9 && item.multipleOf !== undefined ? `, multipleOf: ${item.multipleOf}` : ''}})`,
        item.nullable,
      );
      if (type === 'number') {
        value = getNullable(
          `faker.number.float({min: ${item.minimum ?? mockOptions?.numberMin}, max: ${item.maximum ?? mockOptions?.numberMax}${isFakerV9 && item.multipleOf !== undefined ? `, multipleOf: ${item.multipleOf}` : `, fractionDigits: ${mockOptions?.fractionDigits}`}})`,
          item.nullable,
        );
      }
      const numberImports: GeneratorImport[] = [];

      if (item.enum) {
        value = getEnum(
          item,
          numberImports,
          context,
          existingReferencedProperties,
          'number',
        );
      } else if ('const' in item) {
        value = '' + JSON.stringify((item as SchemaObject31).const);
      }

      return {
        value,
        enums: item.enum,
        imports: numberImports,
        name: item.name,
      };
    }

    case 'boolean': {
      let value = 'faker.datatype.boolean()';
      if ('const' in item) {
        value = '' + JSON.stringify((item as SchemaObject31).const);
      }
      return {
        value,
        imports: [],
        name: item.name,
      };
    }

    case 'array': {
      if (!item.items) {
        return { value: '[]', imports: [], name: item.name };
      }

      if (
        '$ref' in item.items &&
        existingReferencedProperties.includes(
          pascal(item.items.$ref.split('/').pop()!),
        )
      ) {
        return { value: '[]', imports: [], name: item.name };
      }

      const {
        value,
        enums,
        imports: resolvedImports,
      } = resolveMockValue({
        schema: {
          ...item.items,
          name: item.name,
          path: item.path ? `${item.path}.[]` : '#.[]',
        },
        combine,
        mockOptions,
        operationId,
        tags,
        context,
        imports,
        existingReferencedProperties,
        splitMockImplementations,
      });

      if (enums) {
        return {
          value,
          imports: resolvedImports,
          name: item.name,
        };
      }

      let mapValue = value;

      if (
        combine &&
        !value.startsWith('faker') &&
        !value.startsWith('{') &&
        !value.startsWith('Array.from')
      ) {
        mapValue = `{${value}}`;
      }

      return {
        value:
          `Array.from({ length: faker.number.int({ ` +
          `min: ${item.minItems ?? mockOptions?.arrayMin}, ` +
          `max: ${item.maxItems ?? mockOptions?.arrayMax} }) ` +
          `}, (_, i) => i + 1).map(() => (${mapValue}))`,
        imports: resolvedImports,
        name: item.name,
      };
    }

    case 'string': {
      const length = `{length: {min: ${item.minLength ?? mockOptions?.stringMin}, max: ${item.maxLength ?? mockOptions?.stringMax}}}`;
      let value = `faker.string.alpha(${length})`;
      const stringImports: GeneratorImport[] = [];

      if (item.enum) {
        value = getEnum(
          item,
          stringImports,
          context,
          existingReferencedProperties,
          'string',
        );
      } else if (item.pattern) {
        value = `faker.helpers.fromRegExp('${item.pattern}')`;
      } else if ('const' in item) {
        value = `'${JSON.stringify((item as SchemaObject31).const)}'`;
      }

      return {
        value: getNullable(value, item.nullable),
        enums: item.enum,
        name: item.name,
        imports: stringImports,
      };
    }

    case 'null': {
      return {
        value: 'null',
        imports: [],
        name: item.name,
      };
    }

    default: {
      if (item.enum) {
        const enumImports: GeneratorImport[] = [];
        const value = getEnum(
          item,
          enumImports,
          context,
          existingReferencedProperties,
        );

        return {
          value,
          enums: item.enum,
          imports: enumImports,
          name: item.name,
        };
      }

      return getMockObject({
        item,
        mockOptions,
        operationId,
        tags,
        combine: combine
          ? {
              separator: combine.separator,
              includedProperties: [],
            }
          : undefined,
        context,
        imports,
        existingReferencedProperties,
        splitMockImplementations,
        allowOverride,
      });
    }
  }
};

function getItemType(item: MockSchemaObject) {
  if (item.type) return item.type;
  if (!item.enum) return;

  const uniqTypes = new Set(item.enum.map((value) => typeof value));
  if (uniqTypes.size > 1) return;

  const type = [...uniqTypes.values()].at(0);
  if (!type) return;
  return ['string', 'number'].includes(type) ? type : undefined;
}

const getEnum = (
  item: MockSchemaObject,
  imports: GeneratorImport[],
  context: ContextSpecs,
  existingReferencedProperties: string[],
  type?: 'string' | 'number',
) => {
  if (!item.enum) return '';
  const joindEnumValues = item.enum
    .filter((e) => e !== null)
    .map((e) =>
      type === 'string' || (type === undefined && typeof e === 'string')
        ? `'${escape(e)}'`
        : e,
    )
    .join(',');

  let enumValue = `[${joindEnumValues}]`;
  if (context.output.override.enumGenerationType === EnumGeneration.ENUM) {
    if (item.isRef || existingReferencedProperties.length === 0) {
      enumValue += ` as ${item.name}${item.name.endsWith('[]') ? '' : '[]'}`;
      imports.push({
        name: item.name,
        ...(isRootKey(context.specKey, context.target)
          ? {}
          : { specKey: context.specKey }),
      });
    } else {
      enumValue += ` as ${existingReferencedProperties[existingReferencedProperties.length - 1]}['${item.name}']`;
      if (!item.path?.endsWith('[]')) enumValue += '[]';
      imports.push({
        name: existingReferencedProperties[
          existingReferencedProperties.length - 1
        ],
        ...(isRootKey(context.specKey, context.target)
          ? {}
          : { specKey: context.specKey }),
      });
    }
  } else {
    enumValue += ' as const';
  }

  // But if the value is a reference, we can use the object directly via the imports and using Object.values.
  if (item.isRef && type === 'string') {
    enumValue = `Object.values(${item.name})`;
    imports.push({
      name: item.name,
      values: true,
      ...(isRootKey(context.specKey, context.target)
        ? {}
        : { specKey: context.specKey }),
    });
  }

  return item.path?.endsWith('[]')
    ? `faker.helpers.arrayElements(${enumValue})`
    : `faker.helpers.arrayElement(${enumValue})`;
};
