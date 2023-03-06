import {
  ContextSpecs,
  generalJSTypesWithArray,
  GeneratorImport,
  GetterResponse,
  isFunction,
  MockOptions,
  NormalizedOverrideOutput,
  resolveRef,
  stringify,
} from '@orval/core';
import { OpenAPIObject, SchemaObject } from 'openapi3-ts';
import { getMockScalar } from './getters';
import { MockValue, serializeMockValue } from './types';

const getMockPropertiesWithoutFunc = (properties: any, spec: OpenAPIObject) =>
  Object.entries(isFunction(properties) ? properties(spec) : properties).reduce<
    Record<string, string>
  >((acc, [key, value]) => {
    const implementation = isFunction(value)
      ? `(${value})()`
      : stringify(value as string)!;

    acc[key] = implementation?.replace(
      /import_faker.defaults|import_faker.faker/g,
      'faker',
    );
    return acc;
  }, {});

const getMockWithoutFunc = (
  spec: OpenAPIObject,
  override?: NormalizedOverrideOutput,
): MockOptions => ({
  arrayMin: override?.mock?.arrayMin,
  arrayMax: override?.mock?.arrayMax,
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
        operations: Object.entries(override.operations).reduce<
          Exclude<MockOptions['operations'], undefined>
        >((acc, [key, value]) => {
          if (value.mock?.properties) {
            acc[key] = {
              properties: getMockPropertiesWithoutFunc(
                value.mock.properties,
                spec,
              ),
            };
          }

          return acc;
        }, {}),
      }
    : {}),
  ...(override?.tags
    ? {
        tags: Object.entries(override.tags).reduce<
          Exclude<MockOptions['tags'], undefined>
        >((acc, [key, value]) => {
          if (value.mock?.properties) {
            acc[key] = {
              properties: getMockPropertiesWithoutFunc(
                value.mock.properties,
                spec,
              ),
            };
          }

          return acc;
        }, {}),
      }
    : {}),
});

const getMockScalarJsTypes = (
  definition: string,
  mockOptionsWithoutFunc: { [key: string]: unknown },
): MockValue | undefined => {
  const isArray = definition.endsWith('[]');
  const type = isArray ? definition.slice(0, -2) : definition;

  switch (type) {
    case 'number':
      return {
        type: 'primitive',
        value: isArray
          ? `Array.from({length: faker.datatype.number({` +
            `min: ${mockOptionsWithoutFunc.arrayMin}, ` +
            `max: ${mockOptionsWithoutFunc.arrayMax}}` +
            `)}, () => faker.datatype.number())`
          : 'faker.datatype.number().toString()',
      };
    case 'string':
      return {
        type: 'primitive',
        value: isArray
          ? `Array.from({length: faker.datatype.number({` +
            `min: ${mockOptionsWithoutFunc?.arrayMin},` +
            `max: ${mockOptionsWithoutFunc?.arrayMax}}` +
            `)}, () => faker.random.word())`
          : 'faker.random.word()',
      };
    default:
      return undefined;
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
  transformer?: (value: unknown, definition: string) => MockValue | undefined;
  context: ContextSpecs;
}) =>
  response.types.success.reduce(
    (acc, { value: definition, originalSchema, imports, isRef }) => {
      console.log('DEFINITION', definition);
      if (!definition || generalJSTypesWithArray.includes(definition)) {
        const value = getMockScalarJsTypes(definition, mockOptionsWithoutFunc);
        const mockValue =
          transformer?.(value, response.definition.success) ?? value;

        if (mockValue) {
          acc.definitions.push(mockValue);
        }

        return acc;
      }

      if (!originalSchema) {
        return acc;
      }

      const resolvedRef = resolveRef<SchemaObject>(originalSchema, context);

      const scalar = getMockScalar({
        item: {
          name: definition,
          ...resolvedRef.schema,
        },
        imports,
        mockOptions: mockOptionsWithoutFunc,
        operationId,
        tags,
        context: isRef
          ? {
              ...context,
              specKey: response.imports[0]?.specKey ?? context.specKey,
            }
          : context,
      });

      acc.imports.push(...scalar.imports);
      acc.definitions.push(
        transformer?.(scalar.value, response.definition.success) ??
          scalar.value,
      );

      return acc;
    },
    {
      definitions: [] as MockValue[],
      imports: [] as GeneratorImport[],
    },
  );

export const getMockDefinition = ({
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
  transformer?: (value: unknown, definition: string) => MockValue;
  context: ContextSpecs;
}) => {
  const mockOptionsWithoutFunc = getMockWithoutFunc(
    context.specs[context.specKey],
    override,
  );

  const { definitions, imports } = getResponsesMockDefinition({
    operationId,
    tags,
    response,
    mockOptionsWithoutFunc,
    transformer,
    context,
  });

  return {
    definitions,
    imports,
  };
};

export const getMockOptionsDataOverride = (
  operationId: string,
  override: NormalizedOverrideOutput,
): MockValue | undefined => {
  const responseOverride = override?.operations?.[operationId]?.mock?.data;
  const implementation = isFunction(responseOverride)
    ? `(${responseOverride})()`
    : stringify(responseOverride);

  const value = implementation?.replace(
    /import_faker.defaults|import_faker.faker/g,
    'faker',
  );

  return value
    ? {
        type: 'primitive',
        value,
      }
    : undefined;
};
