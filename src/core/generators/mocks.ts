import { OpenAPIObject, SchemaObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { InputTarget, MockOptions, OverrideOutput } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { GetterResponse } from '../../types/getters';
import { asyncReduce } from '../../utils/async-reduce';
import { isFunction, isReference } from '../../utils/is';
import { stringify } from '../../utils/string';
import { getMockScalar } from '../getters/scalar.mock';
import { getSchema } from '../getters/schema';

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
  required: override?.mock?.required,
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
  ...(override?.tags
    ? {
        tags: Object.entries(override.tags).reduce(
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

export const getResponsesMockDefinition = ({
  operationId,
  tags,
  response,
  schemas,
  mockOptionsWithoutFunc,
  transformer,
  target,
}: {
  operationId: string;
  tags: string[];
  response: GetterResponse;
  schemas: {
    [key: string]: SchemaObject;
  };
  mockOptionsWithoutFunc: { [key: string]: unknown };
  transformer?: (value: unknown, definition: string) => string;
  target: InputTarget;
}) => {
  return asyncReduce(
    response.types,
    async (acc, { value: definition, type, imports }) => {
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
          type === 'ref'
            ? schemaImport.name.replace('Response', '')
            : schemaImport.name,
          schemas,
          schemaImport.specKey,
        ),
      };

      if (!schema) {
        return acc;
      }

      const scalar = await getMockScalar({
        item: schema,
        schemas,
        mockOptions: mockOptionsWithoutFunc,
        operationId,
        tags,
        target,
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
  specs,
  override,
  transformer,
  target,
}: {
  operationId: string;
  tags: string[];
  response: GetterResponse;
  specs: OpenAPIObject;
  override?: OverrideOutput;
  transformer?: (value: unknown, definition: string) => string;
  target: InputTarget;
}) => {
  const schemas = Object.entries(specs.components?.schemas || []).reduce(
    (acc, [name, type]) => ({ ...acc, [name]: type }),
    {},
  ) as { [key: string]: SchemaObject };

  const responses = Object.entries(specs.components?.responses || []).reduce(
    (acc, [name, type]) => ({
      ...acc,
      [name]: isReference(type)
        ? type
        : type.content?.['application/json']?.schema,
    }),
    {},
  ) as { [key: string]: SchemaObject };

  const mockOptionsWithoutFunc = getMockWithoutFunc(specs, override);

  const { definitions, imports } = await getResponsesMockDefinition({
    operationId,
    tags,
    response,
    schemas: { ...schemas, ...responses },
    mockOptionsWithoutFunc,
    transformer,
    target,
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
