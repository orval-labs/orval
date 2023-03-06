import {
  ContextSpecs,
  escape,
  GeneratorImport,
  isReference,
  isRootKey,
  mergeDeep,
  MockOptions,
} from '@orval/core';
import { DEFAULT_FORMAT_MOCK } from '../constants';
import {
  getNullable,
  resolveMockOverride,
  resolveMockValue,
} from '../resolvers';
import { MockDefinition, MockSchemaObject, serializeMockValue } from '../types';
import { getMockObject } from './object';

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
      value: getNullable(
        { type: 'primitive', value: ALL_FORMAT[item.format] },
        item.nullable,
      ),
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
          {
            type: 'primitive',
            value: `faker.datatype.number({min: ${item.minimum}, max: ${item.maximum}})`,
          },
          item.nullable,
        ),
        imports: [],
        name: item.name,
      };
    }

    case 'boolean': {
      return {
        value: { type: 'primitive', value: 'faker.datatype.boolean()' },
        imports: [],
        name: item.name,
      };
    }

    case 'array': {
      if (!item.items) {
        return {
          value: { type: 'primitive', value: '[]' },
          imports: [],
          name: item.name,
        };
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
          value: {
            type: 'primitive',
            value: `faker.helpers.arrayElements(Object.values(${enumValue}))`,
          },
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

      return {
        value: {
          type: 'primitive',
          value:
            `Array.from({ length: faker.datatype.number({ ` +
            `min: ${mockOptions?.arrayMin}, ` +
            `max: ${mockOptions?.arrayMax} }) ` +
            `}, (_, i) => i + 1).map(() => (${serializeMockValue(value)}))`,
        },
        imports: resolvedImports,
        name: item.name,
      };
    }

    case 'string': {
      let value;
      let imports: GeneratorImport[] = [];

      if (item.enum) {
        let enumValue;

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
        } else {
          enumValue = "['" + item.enum.map((e) => escape(e)).join("','") + "']";
        }

        value = `faker.helpers.arrayElement(${enumValue})`;
      } else {
        value = `faker.random.word()`;
      }

      return {
        value: getNullable({ type: 'primitive', value }, item.nullable),
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
