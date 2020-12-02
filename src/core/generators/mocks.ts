import { OpenAPIObject, SchemaObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { MockOptions, OverrideOutput } from '../../types';
import { GetterResponse } from '../../types/getters';
import { isFunction } from '../../utils/is';
import { stringify } from '../../utils/string';
import { getMockScalar } from '../getters/scalar.mock';

const getMockPropertiesWithoutFunc = (properties: any, specs: OpenAPIObject) =>
  Object.entries(
    isFunction(properties) ? properties(specs) : properties,
  ).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: isFunction(value) ? `(${value})()` : stringify(value as string),
    }),
    {},
  );

const getMockWithoutFunc = (
  specs: OpenAPIObject,
  override?: OverrideOutput,
): MockOptions => ({
  ...(override?.mock?.properties
    ? {
        properties: getMockPropertiesWithoutFunc(
          override.mock.properties,
          specs,
        ),
      }
    : {}),
  ...(override?.mock?.format
    ? {
        format: getMockPropertiesWithoutFunc(override.mock.format, specs),
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
                    specs,
                  ),
                }
              : {},
          }),
          {},
        ),
      }
    : {}),
});

export const getResponsesMockDefinition = (
  operationId: string,
  response: GetterResponse,
  schemas: {
    [key: string]: SchemaObject;
  },
  mockOptionsWithoutFunc: { [key: string]: unknown },
  transformer?: (value: unknown, definition: string) => string,
) => {
  return response.types.reduce(
    (acc, { value: type }) => {
      if (!type || generalJSTypesWithArray.includes(type)) {
        acc.definitions = [
          ...acc.definitions,
          transformer
            ? transformer(undefined, response.definition)
            : 'undefined',
        ];
        return acc;
      }

      const schema = { name: type, ...schemas[type] };
      if (!schema) {
        return acc;
      }

      const { value, imports } = getMockScalar({
        item: schema,
        schemas,
        mockOptions: mockOptionsWithoutFunc,
        operationId,
      });

      acc.imports = [...acc.imports, ...imports];
      acc.definitions = [
        ...acc.definitions,
        transformer
          ? transformer(value, response.definition)
          : value.toString(),
      ];

      return acc;
    },
    {
      definitions: [] as string[],
      imports: [] as string[],
    },
  );
};

export const getMockDefinition = (
  operationId: string,
  response: GetterResponse,
  specs: OpenAPIObject,
  override?: OverrideOutput,
  transformer?: (value: unknown, definition: string) => string,
) => {
  const schemas = Object.entries(specs.components?.schemas || []).reduce(
    (acc, [name, type]) => ({ ...acc, [name]: type }),
    {},
  ) as { [key: string]: SchemaObject };

  const mockOptionsWithoutFunc = getMockWithoutFunc(specs, override);

  const { definitions, imports } = getResponsesMockDefinition(
    operationId,
    response,
    schemas,
    mockOptionsWithoutFunc,
    transformer,
  );

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
