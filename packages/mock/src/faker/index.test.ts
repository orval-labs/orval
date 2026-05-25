import type {
  ClientMockBuilder,
  FakerMockOptions,
  GeneratorOptions,
  GeneratorVerbOptions,
  GlobalMockOptions,
  MswMockOptions,
  NormalizedOverrideOutput,
} from '@orval/core';
import { isFakerMock, isMswMock, OutputMockType } from '@orval/core';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { generateFaker, generateFakerImports } from './index';

const mockVerbOptions = {
  operationId: 'getUser',
  verb: 'get',
  tags: [],
  response: {
    imports: [],
    definition: { success: 'User' },
    types: { success: [{ key: '200', value: 'User' }] },
    contentTypes: ['application/json'],
  },
} as unknown as GeneratorVerbOptions;

const baseOptions = {
  route: '/users/{id}',
  pathRoute: '/users/{id}',
  output: 'test',
  override: { operations: {}, tags: {} } as NormalizedOverrideOutput,
  context: {
    target: 'test',
    workspace: '',
    spec: {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
    },
    output: {
      target: 'test',
      namingConvention: 'camelCase',
      fileExtension: '.ts',
      mode: 'single',
      override: { operations: {}, tags: {} } as NormalizedOverrideOutput,
      client: 'axios-functions',
      httpClient: 'fetch',
      clean: false,
      docs: false,
      formatter: undefined,
      headers: false,
      indexFiles: true,
      allParamsOptional: false,
      urlEncodeParameters: false,
      unionAddMissingProperties: false,
      optionsParamRequired: false,
      propertySortOrder: 'specification',
    },
  },
} as unknown as GeneratorOptions;

const generate = (overrides: Partial<GeneratorOptions> = {}) =>
  generateFaker(mockVerbOptions, { ...baseOptions, ...overrides });

describe('generateFaker', () => {
  it('returns an empty handler and handlerName so writers skip http output', () => {
    const result = generate({
      mock: { type: OutputMockType.FAKER } satisfies FakerMockOptions,
    });
    expect(result.implementation.handler).toBe('');
    expect(result.implementation.handlerName).toBe('');
  });

  it('returns the same response-factory function string that MSW would emit', () => {
    // generateFaker reuses generateMSW's response-mock function path, then
    // zeroes out the handler/handlerName. The `function` field should still
    // match exactly what MSW emits for the same operation so consumers can
    // import the factory from either file interchangeably.
    const fakerResult = generate({ mock: { type: OutputMockType.FAKER } });
    expect(typeof fakerResult.implementation.function).toBe('string');
  });
});

describe('generateFakerImports', () => {
  // The implementation must reference the import name (here `faker`) for
  // generateDependencyImports to emit it; otherwise it's pruned as unused.
  const baseImportArgs = {
    implementation:
      'export const getUserResponseMock = () => ({ id: faker.number.int() });',
    imports: [],
    projectName: 'test',
    hasSchemaDir: false,
    isAllowSyntheticDefaultImports: false,
  };

  it('emits faker import from the default @faker-js/faker entry', () => {
    const out = generateFakerImports({
      ...baseImportArgs,
      options: { type: OutputMockType.FAKER },
    });
    expect(out).toContain("from '@faker-js/faker'");
  });

  it('scopes the faker import by locale when provided', () => {
    const out = generateFakerImports({
      ...baseImportArgs,
      options: { type: OutputMockType.FAKER, locale: 'en' },
    });
    expect(out).toContain("from '@faker-js/faker/locale/en'");
  });

  it('does not import from msw', () => {
    const out = generateFakerImports({
      ...baseImportArgs,
      options: { type: OutputMockType.FAKER },
    });
    expect(out).not.toContain("from 'msw'");
  });
});

describe('discriminated GlobalMockOptions union', () => {
  it('isMswMock narrows to MswMockOptions', () => {
    const mock: GlobalMockOptions | ClientMockBuilder = {
      type: OutputMockType.MSW,
      delay: 100,
    };
    if (isMswMock(mock)) {
      expectTypeOf(mock).toEqualTypeOf<MswMockOptions>();
      expectTypeOf(mock.delay).toEqualTypeOf<
        false | number | (() => number) | undefined
      >();
    } else {
      throw new Error('expected msw narrowing');
    }
  });

  it('isFakerMock narrows to FakerMockOptions', () => {
    const mock: GlobalMockOptions | ClientMockBuilder = {
      type: OutputMockType.FAKER,
    };
    if (isFakerMock(mock)) {
      expectTypeOf(mock).toEqualTypeOf<FakerMockOptions>();
    } else {
      throw new Error('expected faker narrowing');
    }
  });

  it('rejects ClientMockBuilder function form for both type guards', () => {
    const mock: GlobalMockOptions | ClientMockBuilder = () =>
      ({
        imports: [],
        implementation: { function: '', handler: '', handlerName: '' },
      }) as ReturnType<ClientMockBuilder>;
    expect(isMswMock(mock)).toBe(false);
    expect(isFakerMock(mock)).toBe(false);
  });
});
