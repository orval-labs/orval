/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  type ContextSpec,
  EnumGeneration,
  escape,
  type GeneratorImport,
  isString,
  mergeDeep,
  type MockOptions,
  type OpenApiSchemaObject,
  pascal,
} from '@orval/core';

import type { MockDefinition, MockSchemaObject } from '../../types.ts';
import { isFakerVersionV9 } from '../compatible-v9.ts';
import { DEFAULT_FORMAT_MOCK } from '../constants.ts';
import {
  getNullable,
  resolveMockOverride,
  resolveMockValue,
} from '../resolvers/index.ts';
import { getMockObject } from './object.ts';

interface GetMockScalarOptions {
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
  context: ContextSpec;
  // This is used to prevent recursion when combining schemas
  // When an element is added to the array, it means on this iteration, we've already seen this property
  existingReferencedProperties: string[];
  splitMockImplementations: string[];
  // This is used to add the overrideResponse to the object
  allowOverride?: boolean;
}

export function getMockScalar({
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
}: GetMockScalarOptions): MockDefinition {
  const safeMockOptions: MockOptions = mockOptions ?? {};
  // Add the property to the existing properties to validate on object recursion
  if (item.isRef) {
    existingReferencedProperties = [...existingReferencedProperties, item.name];
  }

  const operationProperty = resolveMockOverride(
    safeMockOptions.operations?.[operationId]?.properties,
    item,
  );

  if (operationProperty) {
    return operationProperty;
  }

  let overrideTag: { properties: Record<string, unknown> } = {
    properties: {},
  };
  const sortedTags = Object.entries(safeMockOptions.tags ?? {}).toSorted(
    (a, b) => a[0].localeCompare(b[0]),
  );
  for (const [tag, options] of sortedTags) {
    if (!tags.includes(tag)) {
      continue;
    }
    overrideTag = mergeDeep(overrideTag, options);
  }

  const tagProperty = resolveMockOverride(overrideTag.properties, item);

  if (tagProperty) {
    return tagProperty;
  }

  const property = resolveMockOverride(safeMockOptions.properties, item);

  if (property) {
    return property;
  }

  if (
    (context.output.override.mock?.useExamples ||
      safeMockOptions.useExamples) &&
    item.example !== undefined
  ) {
    return {
      value: JSON.stringify(item.example),
      imports: [],
      name: item.name,
      overrided: true,
    };
  }

  const formatOverrides = safeMockOptions.format ?? {};
  const ALL_FORMAT: Record<string, string> = {
    ...DEFAULT_FORMAT_MOCK,
    ...Object.fromEntries(
      Object.entries(formatOverrides).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
  };

  const isNullable = Array.isArray(item.type) && item.type.includes('null');
  if (item.format && ALL_FORMAT[item.format]) {
    let value = ALL_FORMAT[item.format] as string;

    const dateFormats = ['date', 'date-time'];
    if (dateFormats.includes(item.format) && context.output.override.useDates) {
      value = `new Date(${value})`;
    }

    return {
      value: getNullable(value, isNullable),
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
      const numMin = (item.exclusiveMinimum ??
        item.minimum ??
        safeMockOptions.numberMin) as number | undefined;
      const numMax = (item.exclusiveMaximum ??
        item.maximum ??
        safeMockOptions.numberMax) as number | undefined;
      const intParts: string[] = [];
      if (numMin !== undefined) intParts.push(`min: ${numMin}`);
      if (numMax !== undefined) intParts.push(`max: ${numMax}`);
      if (isFakerV9 && item.multipleOf !== undefined)
        intParts.push(`multipleOf: ${item.multipleOf}`);
      let value = getNullable(
        `faker.number.${intFunction}(${intParts.length > 0 ? `{${intParts.join(', ')}}` : ''})`,
        isNullable,
      );
      if (type === 'number') {
        const floatParts: string[] = [];
        if (numMin !== undefined) floatParts.push(`min: ${numMin}`);
        if (numMax !== undefined) floatParts.push(`max: ${numMax}`);
        if (isFakerV9 && item.multipleOf !== undefined) {
          floatParts.push(`multipleOf: ${item.multipleOf}`);
        } else if (safeMockOptions.fractionDigits !== undefined) {
          floatParts.push(`fractionDigits: ${safeMockOptions.fractionDigits}`);
        }
        value = getNullable(
          `faker.number.float(${floatParts.length > 0 ? `{${floatParts.join(', ')}}` : ''})`,
          isNullable,
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
        value = JSON.stringify(item.const);
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
        value = JSON.stringify(item.const);
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
          pascal(item.items.$ref.split('/').pop() ?? ''),
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

      const arrMin = (item.minItems ?? safeMockOptions.arrayMin) as
        | number
        | undefined;
      const arrMax = (item.maxItems ?? safeMockOptions.arrayMax) as
        | number
        | undefined;
      const arrParts: string[] = [];
      if (arrMin !== undefined) arrParts.push(`min: ${arrMin}`);
      if (arrMax !== undefined) arrParts.push(`max: ${arrMax}`);
      const arrLengthArg =
        arrParts.length > 0 ? `{${arrParts.join(', ')}}` : '';

      return {
        value:
          `Array.from({ length: faker.number.int(` +
          `${arrLengthArg}) ` +
          `}, (_, i) => i + 1).map(() => (${mapValue}))`,
        imports: resolvedImports,
        name: item.name,
      };
    }

    case 'string': {
      const strMin = (item.minLength ?? safeMockOptions.stringMin) as
        | number
        | undefined;
      const strMax = (item.maxLength ?? safeMockOptions.stringMax) as
        | number
        | undefined;
      const strLenParts: string[] = [];
      if (strMin !== undefined) strLenParts.push(`min: ${strMin}`);
      if (strMax !== undefined) strLenParts.push(`max: ${strMax}`);
      const length =
        strLenParts.length > 0 ? `{length: {${strLenParts.join(', ')}}}` : '';
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
        value = JSON.stringify((item as OpenApiSchemaObject).const);
      }

      return {
        value: getNullable(value, isNullable),
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
}

function getItemType(item: MockSchemaObject) {
  if (Array.isArray(item.type) && item.type.includes('null')) {
    const typesWithoutNull = item.type.filter((x) => x !== 'null');
    const itemType =
      typesWithoutNull.length === 1 ? typesWithoutNull[0] : typesWithoutNull;

    return itemType;
  }

  if (item.type) return item.type;
  if (!item.enum) return;

  const uniqTypes = new Set(item.enum.map((value) => typeof value));
  if (uniqTypes.size > 1) return;

  const type = [...uniqTypes.values()].at(0);
  if (!type) return;
  return ['string', 'number'].includes(type) ? type : undefined;
}

function getEnum(
  item: MockSchemaObject,
  imports: GeneratorImport[],
  context: ContextSpec,
  existingReferencedProperties: string[],
  type?: 'string' | 'number',
) {
  if (!item.enum) return '';
  const joinedEnumValues = item.enum
    .filter((e) => e !== null) // TODO fix type, e can absolutely be null
    .map((e) =>
      type === 'string' || (type === undefined && isString(e))
        ? `'${escape(e)}'`
        : e,
    )
    .join(',');

  let enumValue = `[${joinedEnumValues}]`;
  if (context.output.override.enumGenerationType === EnumGeneration.ENUM) {
    if (item.isRef || existingReferencedProperties.length === 0) {
      enumValue += ` as ${item.name}${item.name.endsWith('[]') ? '' : '[]'}`;
      imports.push({ name: item.name });
    } else {
      enumValue += ` as ${existingReferencedProperties[existingReferencedProperties.length - 1]}['${item.name}']`;
      if (!item.path?.endsWith('[]')) enumValue += '[]';
      imports.push({
        name: existingReferencedProperties[
          existingReferencedProperties.length - 1
        ],
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
    });
  }

  return item.path?.endsWith('[]')
    ? `faker.helpers.arrayElements(${enumValue})`
    : `faker.helpers.arrayElement(${enumValue})`;
}
