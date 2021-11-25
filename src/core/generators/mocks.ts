import { OpenAPIObject, SchemaObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import {
  ContextSpecs,
  MockOptions,
  NormalizedOverrideOutput,
} from '../../types';
import { GeneratorImport } from '../../types/generator';
import { GetterResponse } from '../../types/getters';
import { asyncReduce } from '../../utils/async-reduce';
import { isFunction } from '../../utils/is';
import { stringify } from '../../utils/string';
import { getMockScalar } from '../getters/scalar.mock';
import { resolveRef } from '../resolvers/ref';

const getMockPropertiesWithoutFunc = (properties: any, spec: OpenAPIObject) =>
  Object.entries(isFunction(properties) ? properties(spec) : properties).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: isFunction(value) ? `(${value})()` : stringify(value as string),
    }),
    {},
  );

const getMockWithoutFunc = (
  spec: OpenAPIObject,
  override?: NormalizedOverrideOutput,
): MockOptions => ({
  required: override?.mock?.required,
  ...(override?.mock?.properties
    ? {
        properties: getMockPropertiesWithoutFunc(
          override.mock.properties,
          spec,
        ),
      }
    : {}),
  ...(override?.mock?.format
    ? {
        format: getMockPropertiesWithoutFunc(override.mock.format, spec),
      }
    : {}),
  ...(override?.operations
    ? {
        operations: Object.entries(override.operations).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value.mock?.properties
              ? {
                  properties: getMockPropertiesWithoutFunc(
                    value.mock.properties,
                    spec,
                  ),
                }
              : {},
          }),
          {},
        ),
      }
    : {}),
  ...(override?.tags
    ? {
        tags: Object.entries(override.tags).reduce(
          (acc, [key, value]) => ({
            ...acc,
            [key]: value.mock?.properties
              ? {
                  properties: getMockPropertiesWithoutFunc(
                    value.mock.properties,
                    spec,
                  ),
                }
              : {},
          }),
          {},
        ),
      }
    : {}),
});

const getMockScalarJsTypes = (definition: string) => {
  const isArray = definition.endsWith('[]');
  const type = isArray ? definition.slice(0, -2) : definition;

  switch (type) {
    case 'number':
      return isArray
        ? `Array.from({length: faker.datatype.number({min: 1, max: 10})}, () => faker.datatype.number())`
        : 'faker.datatype.number().toString()';
    case 'string':
      return isArray
        ? `Array.from({length: faker.datatype.number({min: 1, max: 10})}, () => faker.random.word())`
        : 'faker.random.word()';
    default:
      return 'undefined';
  }
};

export const getResponsesMockDefinition = ({
  operationId,
  tags,
  response,
  mockOptionsWithoutFunc,
  transformer,
  context,
}: {
  operationId: string;
  tags: string[];
  response: GetterResponse;
  mockOptionsWithoutFunc: { [key: string]: unknown };
  transformer?: (value: unknown, definition: string) => string;
  context: ContextSpecs;
}) => {
  return asyncReduce(
    response.types.success,
    async (acc, { value: definition, originalSchema }) => {
      if (!definition || generalJSTypesWithArray.includes(definition)) {
        const value = getMockScalarJsTypes(definition);

        acc.definitions = [
          ...acc.definitions,
          transformer ? transformer(value, response.definition.success) : value,
        ];
        return acc;
      }

      if (!originalSchema) {
        return acc;
      }

      const resolvedRef = await resolveRef<SchemaObject>(
        originalSchema,
        context,
      );

      const scalar = await getMockScalar({
        item: {
          name: definition,
          ...resolvedRef.schema,
          ...(response.imports.length
            ? {
                specKey: response.imports[response.imports.length - 1].specKey,
              }
            : {}),
        },
        mockOptions: mockOptionsWithoutFunc,
        operationId,
        tags,
        context,
      });

      acc.imports = [...acc.imports, ...scalar.imports];
      acc.definitions = [
        ...acc.definitions,
        transformer
          ? transformer(scalar.value, response.definition.success)
          : scalar.value.toString(),
      ];

      return acc;
    },
    {
      definitions: [] as string[],
      imports: [] as GeneratorImport[],
    },
  );
};

export const getMockDefinition = async ({
  operationId,
  tags,
  response,
  override,
  transformer,
  context,
}: {
  operationId: string;
  tags: string[];
  response: GetterResponse;
  override: NormalizedOverrideOutput;
  transformer?: (value: unknown, definition: string) => string;
  context: ContextSpecs;
}) => {
  const mockOptionsWithoutFunc = getMockWithoutFunc(
    context.specs[context.specKey],
    override,
  );

  const { definitions, imports } = await getResponsesMockDefinition({
    operationId,
    tags,
    response,
    mockOptionsWithoutFunc,
    transformer,
    context,
  });

  return {
    definition: '[' + definitions.join(', ') + ']',
    definitions,
    imports,
  };
};

export const getMockOptionsDataOverride = (
  operationId: string,
  override: NormalizedOverrideOutput,
) => {
  const responseOverride = override?.operations?.[operationId]?.mock?.data;
  return isFunction(responseOverride)
    ? `(${responseOverride})()`
    : stringify(responseOverride);
};
