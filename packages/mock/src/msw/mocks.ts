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

import { getMockScalar } from '../faker/getters';

function getMockPropertiesWithoutFunc(
  properties:
    | Record<string, unknown>
    | ((spec: OpenApiDocument) => Record<string, unknown>),
  spec: OpenApiDocument,
) {
  const resolvedProperties =
    typeof properties === 'function' ? properties(spec) : properties;
  const mockProperties: Record<string, string> = {};

  for (const [key, value] of Object.entries(resolvedProperties)) {
    const implementation = isFunction(value)
      ? `(${String(value)})()`
      : (stringify(value) ?? 'undefined');

    mockProperties[key] = implementation.replaceAll(
      /import_faker\.defaults|import_faker\.faker|_faker\.faker/g,
      'faker',
    );
  }

  return mockProperties;
}

function getMockWithoutFunc(
  spec: OpenApiDocument,
  override?: NormalizedOverrideOutput,
): MockOptions {
  const operations = override?.operations
    ? (() => {
        const operationMocks: Exclude<MockOptions['operations'], undefined> =
          {};

        for (const [key, value] of Object.entries(override.operations)) {
          if (!value?.mock?.properties) {
            continue;
          }

          operationMocks[key] = {
            properties: getMockPropertiesWithoutFunc(
              value.mock.properties,
              spec,
            ),
          };
        }

        return operationMocks;
      })()
    : undefined;
  const tags = override?.tags
    ? (() => {
        const tagMocks: Exclude<MockOptions['tags'], undefined> = {};

        for (const [key, value] of Object.entries(override.tags)) {
          if (!value?.mock?.properties) {
            continue;
          }

          tagMocks[key] = {
            properties: getMockPropertiesWithoutFunc(
              value.mock.properties,
              spec,
            ),
          };
        }

        return tagMocks;
      })()
    : undefined;

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
    ...(operations ? { operations } : {}),
    ...(tags ? { tags } : {}),
  };
}

function getMockNumberOption(
  mockOptionsWithoutFunc: Record<string, unknown>,
  key: 'arrayMin' | 'arrayMax',
) {
  const value = mockOptionsWithoutFunc[key];
  return typeof value === 'number' ? value : undefined;
}

function getMockScalarJsTypes(
  definition: string,
  mockOptionsWithoutFunc: Record<string, unknown>,
) {
  const isArray = definition.endsWith('[]');
  const type = isArray ? definition.slice(0, -2) : definition;
  const arrayMin = getMockNumberOption(mockOptionsWithoutFunc, 'arrayMin');
  const arrayMax = getMockNumberOption(mockOptionsWithoutFunc, 'arrayMax');

  switch (type) {
    case 'number': {
      const numArrParts: string[] = [];
      if (arrayMin !== undefined) numArrParts.push(`min: ${arrayMin}`);
      if (arrayMax !== undefined) numArrParts.push(`max: ${arrayMax}`);
      const numArrArg =
        numArrParts.length > 0 ? `{${numArrParts.join(', ')}}` : '';
      return isArray
        ? `Array.from({length: faker.number.int(${numArrArg})}, () => faker.number.int())`
        : 'faker.number.int()';
    }
    case 'string': {
      const strArrParts: string[] = [];
      if (arrayMin !== undefined) strArrParts.push(`min: ${arrayMin}`);
      if (arrayMax !== undefined) strArrParts.push(`max: ${arrayMax}`);
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
  mockOptionsWithoutFunc: Record<string, unknown>;
  transformer?: (value: unknown, definition: string) => string;
  context: ContextSpec;
  mockOptions?: GlobalMockOptions;
  splitMockImplementations: string[];
}

function getExampleEntries(examples: unknown): unknown[] {
  if (Array.isArray(examples)) {
    return examples;
  }

  if (examples && typeof examples === 'object') {
    return Object.values(examples as Record<string, unknown>);
  }

  return [];
}

function unwrapExampleValue(example: unknown): unknown {
  if (example && typeof example === 'object' && 'value' in example) {
    return (example as { value?: unknown }).value;
  }

  return example;
}

export function getResponsesMockDefinition({
  operationId,
  tags,
  returnType,
  responses,
  mockOptionsWithoutFunc,
  transformer,
  context,
  mockOptions,
  splitMockImplementations,
}: GetResponsesMockDefinitionOptions) {
  const result = {
    definitions: [] as string[],
    imports: [] as GeneratorImport[],
  };

  for (const response of responses) {
    const { value: definition, example, examples, imports } = response;
    let { originalSchema } = response;

    if (context.output.override.mock?.useExamples || mockOptions?.useExamples) {
      const exampleValue = unwrapExampleValue(
        example ??
          originalSchema?.example ??
          getExampleEntries(examples)[0] ??
          getExampleEntries(originalSchema?.examples)[0],
      );

      if (exampleValue !== undefined) {
        result.definitions.push(
          transformer
            ? transformer(exampleValue, returnType)
            : JSON.stringify(exampleValue),
        );
        continue;
      }
    }

    if (!definition || generalJSTypesWithArray.includes(definition)) {
      const value = getMockScalarJsTypes(definition, mockOptionsWithoutFunc);

      result.definitions.push(
        transformer ? transformer(value, returnType) : value,
      );
      continue;
    }

    if (!originalSchema && definition === 'Blob') {
      originalSchema = { type: 'string', format: 'binary' };
    } else if (!originalSchema) {
      continue;
    }

    const resolvedSchema = resolveRef<OpenApiSchemaObject>(
      originalSchema,
      context,
    ).schema;

    const scalar = getMockScalar({
      item: {
        ...(resolvedSchema as Record<string, unknown>),
        name: definition,
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

    result.imports.push(...scalar.imports);
    result.definitions.push(
      transformer ? transformer(scalar.value, returnType) : scalar.value,
    );
  }

  return result;
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
    ? `(${String(responseOverride)})()`
    : stringify(responseOverride);

  return implementation?.replaceAll(
    /import_faker\.defaults|import_faker\.faker|_faker\.faker/g,
    'faker',
  );
}
