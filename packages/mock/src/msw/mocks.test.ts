import type {
  NormalizedOverrideOutput,
  OpenApiDocument,
  ResReqTypesValue,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../../core/src/test-utils/context';
import { getMockWithoutFunc, getResponsesMockDefinition } from './mocks';

describe('getResponsesMockDefinition', () => {
  it('aggregates imports when response.imports is undefined (#3590)', () => {
    const context = createTestContextSpec();

    const splitImplementation = [
      'export const getExampleResponsePointInFutureAbsoluteMock = (',
      '  overrideResponse: Partial<PointInFutureAbsolute> = {},',
      '): PointInFutureAbsolute => ({ kind: "absolute" });',
    ].join('\n');

    const result = getResponsesMockDefinition({
      operationId: 'getPetPhoto',
      tags: ['Pets'],
      returnType: 'Blob',
      responses: [
        {
          value: 'Blob',
          originalSchema: { type: 'string', format: 'binary' },
          contentType: 'application/octet-stream',
          imports: undefined,
          isRef: false,
        } as unknown as ResReqTypesValue,
      ],
      mockOptionsWithoutFunc: {},
      context,
      splitMockImplementations: [splitImplementation],
    });

    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]).toContain('ArrayBuffer');
    expect(result.imports).toEqual([
      { name: 'PointInFutureAbsolute', values: false },
    ]);
  });
});

describe('getResponsesMockDefinition (useExamples + transformer)', () => {
  const petResponse = {
    key: '200',
    value: 'Pet',
    contentType: 'application/json',
    originalSchema: {
      type: 'object',
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
        birthDate: { type: 'string', format: 'date' },
      },
    },
    examples: {
      default: {
        value: {
          createdAt: '2023-12-31T06:46:39.477Z',
          birthDate: '2023-12-31',
        },
      },
    },
    imports: [],
    schemas: [],
    type: 'object',
    isEnum: false,
    isRef: false,
    hasReadonlyProps: false,
    dependencies: [],
  } satisfies ResReqTypesValue;

  const baseOptions = {
    operationId: 'getPet',
    tags: [],
    returnType: 'Pet',
    responses: [petResponse],
    mockOptionsWithoutFunc: {},
    context: createTestContextSpec({
      override: { useDates: true, mock: { useExamples: true } },
    }),
    splitMockImplementations: [],
  };

  it('formats date examples before passing them to transformer', () => {
    const { definitions } = getResponsesMockDefinition({
      ...baseOptions,
      transformer: (value) => `wrap(${String(value)})`,
    });

    expect(definitions[0]).toBe(
      'wrap({ createdAt: new Date("2023-12-31T06:46:39.477Z"), birthDate: new Date("2023-12-31") })',
    );
  });
});

describe('getResponsesMockDefinition (generator useExamples for property examples)', () => {
  const propertyExampleResponse = {
    key: '200',
    value: 'Patient',
    contentType: 'application/json',
    originalSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'abc-123' },
        category: { type: 'string', example: 'cardiology' },
      },
      required: ['id', 'category'],
    },
    imports: [],
    schemas: [],
    type: 'object',
    isEnum: false,
    isRef: false,
    hasReadonlyProps: false,
    dependencies: [],
  } satisfies ResReqTypesValue;

  const baseOptions = {
    operationId: 'getPatient',
    tags: [],
    returnType: 'Patient',
    responses: [propertyExampleResponse],
    mockOptionsWithoutFunc: {},
    context: createTestContextSpec(),
    splitMockImplementations: [],
  };

  it('uses property-level schema examples when generator useExamples is true', () => {
    const { definitions } = getResponsesMockDefinition({
      ...baseOptions,
      mockOptions: { type: 'msw', useExamples: true },
    });

    expect(definitions[0]).toContain('id: "abc-123"');
    expect(definitions[0]).toContain('category: "cardiology"');
  });

  it('keeps faker-generated values when generator useExamples is false', () => {
    const { definitions } = getResponsesMockDefinition({
      ...baseOptions,
      mockOptions: { type: 'msw', useExamples: false },
    });

    expect(definitions[0]).not.toContain('id: "abc-123"');
    expect(definitions[0]).not.toContain('category: "cardiology"');
    expect(definitions[0]).toContain('faker.string.alpha()');
  });
});

describe('getMockWithoutFunc (override.mock.schemas)', () => {
  const spec = {} as OpenApiDocument;

  it('serializes function-valued schema-scoped overrides into IIFE strings', () => {
    const colorFn = () => 'faker.color.human()';
    const override = {
      mock: { schemas: { Apple: { properties: { color: colorFn } } } },
    } as unknown as NormalizedOverrideOutput;

    const result = getMockWithoutFunc(spec, override);

    expect(result.schemas).toEqual({
      Apple: { properties: { color: `(${String(colorFn)})()` } },
    });
  });

  it('keeps non-function schema-scoped overrides as stringified values', () => {
    const override = {
      mock: { schemas: { Car: { properties: { color: 'midnight black' } } } },
    } as unknown as NormalizedOverrideOutput;

    const result = getMockWithoutFunc(spec, override);

    expect(result.schemas?.Car.properties.color).toBe("'midnight black'");
  });

  it('omits schemas when no schema-scoped overrides are configured', () => {
    const result = getMockWithoutFunc(spec, {} as NormalizedOverrideOutput);
    expect(result.schemas).toBeUndefined();
  });
});
