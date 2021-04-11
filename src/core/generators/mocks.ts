import { OpenAPIObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { ContextSpecs, MockOptions, OverrideOutput } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { GetterResponse } from '../../types/getters';
import { asyncReduce } from '../../utils/async-reduce';
import { isFunction } from '../../utils/is';
import { stringify } from '../../utils/string';
import { getMockScalar } from '../getters/scalar.mock';
import { getSchema } from '../getters/schema';

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
  override?: OverrideOutput,
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
    response.types,
    async (acc, { value: definition, imports }) => {
      if (!definition || generalJSTypesWithArray.includes(definition)) {
        acc.definitions = [
          ...acc.definitions,
          transformer
            ? transformer(undefined, response.definition)
            : 'undefined',
        ];
        return acc;
      }

      const schemaImport = imports.find(({ name }) => name === definition);
      if (!schemaImport) {
        return acc;
      }

      const schema = {
        name: definition,
        ...getSchema(
          schemaImport.schemaName || schemaImport.name,
          context,
          schemaImport.specKey,
        ),
      };

      if (!schema) {
        return acc;
      }

      const scalar = await getMockScalar({
        item: schema,
        mockOptions: mockOptionsWithoutFunc,
        operationId,
        tags,
        context,
      });

      acc.imports = [...acc.imports, ...scalar.imports];
      acc.definitions = [
        ...acc.definitions,
        transformer
          ? transformer(scalar.value, response.definition)
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
  override?: OverrideOutput;
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
  override?: OverrideOutput,
) => {
  const responseOverride = override?.operations?.[operationId]?.mock?.data;
  return isFunction(responseOverride)
    ? `(${responseOverride})()`
    : stringify(responseOverride);
};
