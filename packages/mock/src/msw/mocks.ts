import {
  ContextSpecs,
  generalJSTypesWithArray,
  GeneratorImport,
  GetterResponse,
  GlobalMockOptions,
  isFunction,
  MockOptions,
  NormalizedOverrideOutput,
  resolveRef,
  stringify,
} from '@orval/core';
import { OpenAPIObject, SchemaObject } from 'openapi3-ts';
import { getMockScalar } from '../faker/getters';

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
) => {
  const isArray = definition.endsWith('[]');
  const type = isArray ? definition.slice(0, -2) : definition;

  switch (type) {
    case 'number':
      return isArray
        ? `Array.from({length: faker.number.int({` +
            `min: ${mockOptionsWithoutFunc.arrayMin}, ` +
            `max: ${mockOptionsWithoutFunc.arrayMax}}` +
            `)}, () => faker.number.int())`
        : 'faker.number.int().toString()';
    case 'string':
      return isArray
        ? `Array.from({length: faker.number.int({` +
            `min: ${mockOptionsWithoutFunc?.arrayMin},` +
            `max: ${mockOptionsWithoutFunc?.arrayMax}}` +
            `)}, () => faker.word.sample())`
        : 'faker.word.sample()';
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
  mockOptions,
}: {
  operationId: string;
  tags: string[];
  response: GetterResponse;
  mockOptionsWithoutFunc: { [key: string]: unknown };
  transformer?: (value: unknown, definition: string) => string;
  context: ContextSpecs;
  mockOptions?: GlobalMockOptions;
}) => {
  return response.types.success.reduce(
    (
      acc,
      { value: definition, originalSchema, example, examples, imports, isRef },
    ) => {
      if (
        context.output.override?.mock?.useExamples ||
        mockOptions?.useExamples
      ) {
        const exampleValue =
          example ||
          originalSchema?.example ||
          Object.values(examples || {})[0]?.value ||
          originalSchema?.examples?.[0];
        if (exampleValue) {
          acc.definitions.push(
            transformer
              ? transformer(exampleValue, response.definition.success)
              : JSON.stringify(exampleValue),
          );
          return acc;
        }
      }
      if (!definition || generalJSTypesWithArray.includes(definition)) {
        const value = getMockScalarJsTypes(definition, mockOptionsWithoutFunc);

        acc.definitions.push(
          transformer ? transformer(value, response.definition.success) : value,
        );

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
        existingReferencedProperties: [],
      });

      acc.imports.push(...scalar.imports);
      acc.definitions.push(
        transformer
          ? transformer(scalar.value, response.definition.success)
          : scalar.value.toString(),
      );

      return acc;
    },
    {
      definitions: [] as string[],
      imports: [] as GeneratorImport[],
    },
  );
};

export const getMockDefinition = ({
  operationId,
  tags,
  response,
  override,
  transformer,
  context,
  mockOptions,
}: {
  operationId: string;
  tags: string[];
  response: GetterResponse;
  override: NormalizedOverrideOutput;
  transformer?: (value: unknown, definition: string) => string;
  context: ContextSpecs;
  mockOptions?: GlobalMockOptions;
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
    mockOptions,
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
  const implementation = isFunction(responseOverride)
    ? `(${responseOverride})()`
    : stringify(responseOverride);

  return implementation?.replace(
    /import_faker.defaults|import_faker.faker/g,
    'faker',
  );
};
