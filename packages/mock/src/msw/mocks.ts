import {
  type ContextSpec,
  generalJSTypesWithArray,
  type GeneratorImport,
  type GlobalMockOptions,
  isFunction,
  type MockOptions,
  type NormalizedOverrideOutput,
  type OpenApiDocument,
  type OpenApiSchemaObject,
  resolveRef,
  type ResReqTypesValue,
  stringify,
} from '@orval/core';

import { getMockScalar } from '../faker/getters/index.ts';

function getMockPropertiesWithoutFunc(properties: any, spec: OpenApiDocument) {
  return Object.entries(
    isFunction(properties) ? properties(spec) : properties,
  ).reduce<Record<string, string>>((acc, [key, value]) => {
    const implementation = isFunction(value)
      ? `(${value})()`
      : stringify(value as string)!;

    acc[key] = implementation.replaceAll(
      /import_faker\.defaults|import_faker\.faker|_faker\.faker/g,
      'faker',
    );
    return acc;
  }, {});
}

function getMockWithoutFunc(
  spec: OpenApiDocument,
  override?: NormalizedOverrideOutput,
): MockOptions {
  return {
    arrayMin: override?.mock?.arrayMin,
    arrayMax: override?.mock?.arrayMax,
    stringMin: override?.mock?.stringMin,
    stringMax: override?.mock?.stringMax,
    numberMin: override?.mock?.numberMin,
    numberMax: override?.mock?.numberMax,
    required: override?.mock?.required,
    fractionDigits: override?.mock?.fractionDigits,
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
            if (value?.mock?.properties) {
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
            if (value?.mock?.properties) {
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
  };
}

function getMockScalarJsTypes(
  definition: string,
  mockOptionsWithoutFunc: Record<string, unknown>,
) {
  const isArray = definition.endsWith('[]');
  const type = isArray ? definition.slice(0, -2) : definition;

  switch (type) {
    case 'number': {
      const numArrParts: string[] = [];
      if (mockOptionsWithoutFunc.arrayMin !== undefined)
        numArrParts.push(`min: ${mockOptionsWithoutFunc.arrayMin}`);
      if (mockOptionsWithoutFunc.arrayMax !== undefined)
        numArrParts.push(`max: ${mockOptionsWithoutFunc.arrayMax}`);
      const numArrArg =
        numArrParts.length > 0 ? `{${numArrParts.join(', ')}}` : '';
      return isArray
        ? `Array.from({length: faker.number.int(${numArrArg})}, () => faker.number.int())`
        : 'faker.number.int()';
    }
    case 'string': {
      const strArrParts: string[] = [];
      if (mockOptionsWithoutFunc?.arrayMin !== undefined)
        strArrParts.push(`min: ${mockOptionsWithoutFunc.arrayMin}`);
      if (mockOptionsWithoutFunc?.arrayMax !== undefined)
        strArrParts.push(`max: ${mockOptionsWithoutFunc.arrayMax}`);
      const strArrArg =
        strArrParts.length > 0 ? `{${strArrParts.join(', ')}}` : '';
      return isArray
        ? `Array.from({length: faker.number.int(${strArrArg})}, () => faker.word.sample())`
        : 'faker.word.sample()';
    }
    default: {
      return 'undefined';
    }
  }
}

interface GetResponsesMockDefinitionOptions {
  operationId: string;
  tags: string[];
  returnType: string;
  responses: ResReqTypesValue[];
  imports: GeneratorImport[];
  mockOptionsWithoutFunc: Record<string, unknown>;
  transformer?: (value: unknown, definition: string) => string;
  context: ContextSpec;
  mockOptions?: GlobalMockOptions;
  splitMockImplementations: string[];
}

export function getResponsesMockDefinition({
  operationId,
  tags,
  returnType,
  responses,
  imports: responseImports,
  mockOptionsWithoutFunc,
  transformer,
  context,
  mockOptions,
  splitMockImplementations,
}: GetResponsesMockDefinitionOptions) {
  return responses.reduce(
    (
      acc,
      { value: definition, originalSchema, example, examples, imports, isRef },
    ) => {
      if (
        context.output.override.mock?.useExamples ||
        mockOptions?.useExamples
      ) {
        let exampleValue =
          example ??
          originalSchema?.example ??
          Object.values(examples ?? {})[0] ??
          originalSchema?.examples?.[0];
        exampleValue = exampleValue?.value ?? exampleValue;
        if (exampleValue) {
          acc.definitions.push(
            transformer
              ? transformer(exampleValue, returnType)
              : JSON.stringify(exampleValue),
          );
          return acc;
        }
      }
      if (!definition || generalJSTypesWithArray.includes(definition)) {
        const value = getMockScalarJsTypes(definition, mockOptionsWithoutFunc);

        acc.definitions.push(
          transformer ? transformer(value, returnType) : value,
        );

        return acc;
      }

      if (!originalSchema && definition === 'Blob') {
        originalSchema = { type: 'string', format: 'binary' };
      } else if (!originalSchema) {
        return acc;
      }

      const resolvedRef = resolveRef<OpenApiSchemaObject>(
        originalSchema,
        context,
      );

      const scalar = getMockScalar({
        item: {
          name: definition,
          ...resolvedRef.schema,
        },
        imports,
        mockOptions: mockOptionsWithoutFunc,
        operationId,
        tags,
        context,
        existingReferencedProperties: [],
        splitMockImplementations,
        allowOverride: true,
      });

      acc.imports.push(...scalar.imports);
      acc.definitions.push(
        transformer ? transformer(scalar.value, returnType) : scalar.value,
      );

      return acc;
    },
    {
      definitions: [] as string[],
      imports: [] as GeneratorImport[],
    },
  );
}

interface GetMockDefinitionOptions {
  operationId: string;
  tags: string[];
  returnType: string;
  responses: ResReqTypesValue[];
  imports: GeneratorImport[];
  override: NormalizedOverrideOutput;
  transformer?: (value: unknown, definition: string) => string;
  context: ContextSpec;
  mockOptions?: GlobalMockOptions;
  splitMockImplementations: string[];
}

export function getMockDefinition({
  operationId,
  tags,
  returnType,
  responses,
  imports: responseImports,
  override,
  transformer,
  context,
  mockOptions,
  splitMockImplementations,
}: GetMockDefinitionOptions) {
  const mockOptionsWithoutFunc = getMockWithoutFunc(context.spec, override);

  const { definitions, imports } = getResponsesMockDefinition({
    operationId,
    tags,
    returnType,
    responses,
    imports: responseImports,
    mockOptionsWithoutFunc,
    transformer,
    context,
    mockOptions,
    splitMockImplementations,
  });

  return {
    definition: '[' + definitions.join(', ') + ']',
    definitions,
    imports,
  };
}

export function getMockOptionsDataOverride(
  operationTags: string[],
  operationId: string,
  override: NormalizedOverrideOutput,
) {
  const responseOverride =
    override.operations[operationId]?.mock?.data ??
    operationTags
      .map((operationTag) => override.tags[operationTag]?.mock?.data)
      .find((e) => e !== undefined);
  const implementation = isFunction(responseOverride)
    ? `(${responseOverride})()`
    : stringify(responseOverride);

  return implementation?.replaceAll(
    /import_faker\.defaults|import_faker\.faker|_faker\.faker/g,
    'faker',
  );
}
