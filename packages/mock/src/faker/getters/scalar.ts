import {
  ContextSpecs,
  escape,
  GeneratorImport,
  isReference,
  isRootKey,
  mergeDeep,
  MockOptions,
} from '@orval/core';
import { MockDefinition, MockSchemaObject } from '../../types';
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
    item.example
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
    ...(mockOptions?.format ?? {}),
  };

  if (item.format && ALL_FORMAT[item.format]) {
    const dateFormats = ['date', 'date-time'];

    const value =
      context.output.override.useDates && dateFormats.includes(item.format)
        ? `new Date(${ALL_FORMAT[item.format]})`
        : `${ALL_FORMAT[item.format]}`;

    return {
      value: getNullable(value, item.nullable),
      imports: [],
      name: item.name,
      overrided: false,
    };
  }

  const type = getItemType(item);

  switch (type) {
    case 'number':
    case 'integer': {
      let value = getNullable(
        `faker.number.int({min: ${item.minimum}, max: ${item.maximum}})`,
        item.nullable,
      );
      let numberImports: GeneratorImport[] = [];
      if (item.enum) {
        // By default the value isn't a reference, so we don't have the object explicitly defined.
        // So we have to create an array with the enum values and force them to be a const.
        const joinedEnumValues = item.enum.filter(Boolean).join(',');

        let enumValue = `[${joinedEnumValues}] as const`;

        // But if the value is a reference, we can use the object directly via the imports and using Object.values.
        if (item.isRef) {
          enumValue = `Object.values(${item.name})`;
          numberImports = [
            {
              name: item.name,
              values: true,
              ...(!isRootKey(context.specKey, context.target)
                ? { specKey: context.specKey }
                : {}),
            },
          ];
        }

        value = item.path?.endsWith('[]')
          ? `faker.helpers.arrayElements(${enumValue})`
          : `faker.helpers.arrayElement(${enumValue})`;
      }
      return {
        value,
        imports: numberImports,
        name: item.name,
      };
    }

    case 'boolean': {
      return {
        value: 'faker.datatype.boolean()',
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
        existingReferencedProperties.includes(item.items.$ref.split('/').pop()!)
      ) {
        return { value: '[]', imports: [], name: item.name };
      }

      const {
        value,
        enums,
        imports: resolvedImports,
        name,
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
        if (!isReference(item.items)) {
          return {
            value,
            imports: resolvedImports,
            name: item.name,
          };
        }

        const enumImp = imports.find(
          (imp) => name.replace('[]', '') === imp.name,
        );
        const enumValue = enumImp?.name || name;
        return {
          value: `faker.helpers.arrayElements(Object.values(${enumValue}))`,
          imports: enumImp
            ? [
                ...resolvedImports,
                {
                  ...enumImp,
                  values: true,
                  ...(!isRootKey(context.specKey, context.target)
                    ? { specKey: context.specKey }
                    : {}),
                },
              ]
            : resolvedImports,
          name: item.name,
        };
      }

      let mapValue = value;

      if (combine && !value.startsWith('faker') && !value.startsWith('{')) {
        mapValue = `{${value}}`;
      }

      return {
        value:
          `Array.from({ length: faker.number.int({ ` +
          `min: ${mockOptions?.arrayMin}, ` +
          `max: ${mockOptions?.arrayMax} }) ` +
          `}, (_, i) => i + 1).map(() => (${mapValue}))`,
        imports: resolvedImports,
        name: item.name,
      };
    }

    case 'string': {
      let value = 'faker.word.sample()';
      let imports: GeneratorImport[] = [];

      if (item.enum) {
        // By default the value isn't a reference, so we don't have the object explicitly defined.
        // So we have to create an array with the enum values and force them to be a const.
        const joindEnumValues = item.enum
          .filter(Boolean)
          .map((e) => escape(e))
          .join("','");

        let enumValue = `['${joindEnumValues}'] as const`;

        // But if the value is a reference, we can use the object directly via the imports and using Object.values.
        if (item.isRef) {
          enumValue = `Object.values(${item.name})`;
          imports = [
            {
              name: item.name,
              values: true,
              ...(!isRootKey(context.specKey, context.target)
                ? { specKey: context.specKey }
                : {}),
            },
          ];
        }

        value = item.path?.endsWith('[]')
          ? `faker.helpers.arrayElements(${enumValue})`
          : `faker.helpers.arrayElement(${enumValue})`;
      } else if (item.pattern) {
        value = `faker.helpers.fromRegExp('${item.pattern}')`;
      }

      return {
        value: getNullable(value, item.nullable),
        enums: item.enum,
        name: item.name,
        imports,
      };
    }

    case 'null':
      return {
        value: 'null',
        imports: [],
        name: item.name,
      };

    default: {
      return getMockObject({
        item,
        mockOptions,
        operationId,
        tags,
        combine,
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

  const type = Array.from(uniqTypes.values()).at(0);
  if (!type) return;
  return ['string', 'number'].includes(type) ? type : undefined;
}
