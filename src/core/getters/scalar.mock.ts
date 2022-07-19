import { DEFAULT_FORMAT_MOCK } from '../../constants/format.mock';
import { ContextSpecs, MockOptions } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { MockDefinition, MockSchemaObject } from '../../types/mocks';
import { isReference } from '../../utils/is';
import { mergeDeep } from '../../utils/mergeDeep';
import { escape } from '../../utils/string';
import {
  getNullable,
  resolveMockOverride,
  resolveMockValue,
} from '../resolvers/value.mock';
import { getMockObject } from './object.mock';

export const getMockScalar = ({
  item,
  imports,
  mockOptions,
  operationId,
  tags,
  combine,
  context,
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
}): MockDefinition => {
  const operationProperty = resolveMockOverride(
    mockOptions?.operations?.[operationId]?.properties,
    item,
  );

  if (operationProperty) {
    return operationProperty;
  }

  const overrideTag = Object.entries(mockOptions?.tags ?? {}).reduce<{
    properties: Record<string, string>;
  }>(
    (acc, [tag, options]) =>
      tags.includes(tag) ? mergeDeep(acc, options) : acc,
    {} as { properties: Record<string, string> },
  );

  const tagProperty = resolveMockOverride(overrideTag?.properties, item);

  if (tagProperty) {
    return tagProperty;
  }

  const property = resolveMockOverride(mockOptions?.properties, item);

  if (property) {
    return property;
  }

  const ALL_FORMAT: Record<string, string> = {
    ...DEFAULT_FORMAT_MOCK,
    ...(mockOptions?.format ?? {}),
  };

  if (item.format && ALL_FORMAT[item.format]) {
    return {
      value: getNullable(ALL_FORMAT[item.format], item.nullable),
      imports: [],
      name: item.name,
      overrided: false,
    };
  }

  switch (item.type) {
    case 'number':
    case 'integer': {
      return {
        value: getNullable(
          `faker.datatype.number({min: ${item.minimum}, max: ${item.maximum}})`,
          item.nullable,
        ),
        imports: [],
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
          specKey: item.specKey,
        },
        combine,
        mockOptions,
        operationId,
        tags,
        context,
        imports,
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
            ? [...resolvedImports, { ...enumImp, values: true }]
            : resolvedImports,
          name: item.name,
        };
      }

      return {
        value:
          `Array.from({ length: faker.datatype.number({ ` +
          `min: ${mockOptions?.arrayMin}, ` +
          `max: ${mockOptions?.arrayMax} }) ` +
          `}, (_, i) => i + 1).map(() => (${value}))`,
        imports: resolvedImports,
        name: item.name,
      };
    }

    case 'string': {
      let value = 'faker.random.word()';
      let imports: GeneratorImport[] = [];

      if (item.enum) {
        let enumValue =
          "['" + item.enum.map((e) => escape(e)).join("','") + "']";

        if (item.isRef) {
          enumValue = `Object.values(${item.name})`;
          imports = [{ name: item.name, values: true }];
        }

        value = `faker.helpers.arrayElement(${enumValue})`;
      }

      return {
        value: getNullable(value, item.nullable),
        enums: item.enum,
        name: item.name,
        imports,
      };
    }

    case 'object':
    default: {
      return getMockObject({
        item,
        mockOptions,
        operationId,
        tags,
        combine,
        context,
        imports,
      });
    }
  }
};
