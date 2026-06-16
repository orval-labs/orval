import type {
  ClientMockBuilder,
  FakerMockOptions,
  GeneratorOptions,
  GeneratorSchema,
  GeneratorVerbOptions,
  GlobalMockOptions,
  MswMockOptions,
  NormalizedOverrideOutput,
} from '@orval/core';
import { isFakerMock, isMswMock, OutputMockType } from '@orval/core';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { createTestContextSpec } from '../../../core/src/test-utils/context';
import { dedupeStrictMockTypeDeclarations } from '../mock-types';
import {
  generateFaker,
  generateFakerForSchemas,
  generateFakerImports,
} from './index';
import { resolveMockValue } from './resolvers';

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

describe('generateFakerForSchemas property overrides (schemas: true)', () => {
  const idOverride = () => 'faker.string.uuid()';
  const createdOverride = () => 'faker.date.recent().toISOString()';
  const archiveDurationOverride = () =>
    `P${'faker.number.int({ min: 1, max: 365 })'}D`;

  const context = createTestContextSpec({
    override: {
      mock: {
        properties: {
          '/^([Ii]d)$/': idOverride,
          '/^([Cc]reated)$/': createdOverride,
          '/^([Aa]rchive[Dd]uration)$/': archiveDurationOverride,
        },
      },
    },
  });

  const petSchema: GeneratorSchema = {
    name: 'Pet',
    model: 'Pet',
    imports: [],
    schema: {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        created: { type: 'string', format: 'date-time' },
        archiveDuration: { type: 'string' },
      },
    },
  };

  it('invokes override.mock.properties functions as IIFEs, not raw arrow functions', () => {
    const result = generateFakerForSchemas([petSchema], context, {
      type: OutputMockType.FAKER,
      schemas: true,
    });

    expect(result.implementation).toContain(`id: (${String(idOverride)})()`);
    expect(result.implementation).toContain(
      `created: (${String(createdOverride)})()`,
    );
    expect(result.implementation).toContain(
      `archiveDuration: (${String(archiveDurationOverride)})()`,
    );
    expect(result.implementation).not.toMatch(/\bid: \(\) =>/);
    expect(result.implementation).not.toMatch(/\bcreated: \(\) =>/);
    expect(result.implementation).not.toMatch(/\barchiveDuration: \(\) =>/);
  });

  it('keeps default faker generation for non-overridden properties', () => {
    const result = generateFakerForSchemas([petSchema], context, {
      type: OutputMockType.FAKER,
      schemas: true,
    });

    expect(result.implementation).toContain('name: faker.string.alpha(');
  });
});

describe('generateFakerForSchemas strict mock types (#3525)', () => {
  const context = createTestContextSpec({
    override: {
      mock: {
        required: true,
        nonNullable: true,
      },
    },
  });

  it('exposes strict schema names and omits inline type declarations', () => {
    const result = generateFakerForSchemas(
      [
        {
          name: 'Pet',
          model: 'Pet',
          imports: [],
          schema: {
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
              tag: { type: 'string', nullable: true },
            },
          },
        },
      ],
      context,
      { type: OutputMockType.FAKER, schemas: true },
    );

    expect(result.strictMockSchemaTypeNames).toEqual(['Pet']);
    expect(result.implementation).not.toContain('export type PetMock = {');
    expect(result.implementation).not.toContain('export type KeysWithNull<O>');
    expect(result.implementation).toContain(
      'export const getPetMock = <O extends Partial<Pet> = {}>(overrideResponse?: O): MockWithNullableOverrides<Pet, O, PetMock> =>',
    );
    expect(result.implementation).toContain(
      ') as MockWithNullableOverrides<Pet, O, PetMock>;',
    );
    expect(result.implementation).not.toContain(', null]');
  });

  it('includes non-overridable strict schemas in strictMockSchemaTypeNames', () => {
    const result = generateFakerForSchemas(
      [
        {
          name: 'Status',
          model: 'Status',
          imports: [],
          schema: {
            type: 'string',
            enum: ['active', 'inactive'],
          },
        },
      ],
      context,
      { type: OutputMockType.FAKER, schemas: true },
    );

    expect(result.strictMockSchemaTypeNames).toEqual(['Status']);
    expect(result.implementation).not.toContain('overrideResponse');
    expect(result.implementation).toContain(
      'export const getStatusMock = (): StatusMock =>',
    );
    expect(result.implementation).not.toContain('export type StatusMock = {');

    const finalized = dedupeStrictMockTypeDeclarations(result.implementation, {
      mockOptions: { required: true, nonNullable: true },
      strictSchemaTypeNames: result.strictMockSchemaTypeNames,
    });

    expect(finalized).toContain('export type StatusMock = {');
    expect(finalized).toContain('export type KeysWithNull<O>');
    expect(finalized.indexOf('export type StatusMock')).toBeLessThan(
      finalized.indexOf('export const getStatusMock'),
    );
  });
});

describe('resolveMockValue returns one factory import per ref-property (#3606)', () => {
  // Delegation to a `get<X>Mock` factory requires output.schemas to be set and
  // the $ref to point at a components schema.
  const context = createTestContextSpec({
    output: {
      schemas: 'model',
      mock: {
        indexMockFiles: false,
        generators: [{ type: OutputMockType.FAKER, schemas: true }],
      },
    },
    spec: {
      components: {
        schemas: {
          LeafDTO: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    },
  });

  // Resolve N identical $ref properties the way the object-property caller in
  // getters/object.ts does: one shared `imports` array threaded through every
  // call, collecting what each resolution reports as the imports IT added.
  const collectImportsFor = (refPropCount: number) => {
    const imports: { name: string }[] = [];
    const collected: { name: string }[] = [];

    for (let i = 0; i < refPropCount; i++) {
      const result = resolveMockValue({
        schema: {
          $ref: '#/components/schemas/LeafDTO',
          path: `#.p${i}`,
        },
        mockOptions: undefined,
        operationId: 'getUser',
        tags: [],
        context,
        imports,
        existingReferencedProperties: [],
        splitMockImplementations: [],
      } as Parameters<typeof resolveMockValue>[0]);

      collected.push(...result.imports);
    }

    return collected;
  };

  it.each([8, 16, 32])(
    'collects exactly N factory imports for N ref-properties (N=%i)',
    (refPropCount) => {
      const collected = collectImportsFor(refPropCount);
      expect(collected).toHaveLength(refPropCount);
    },
  );
});
