import type {
  ClientMockBuilder,
  FakerMockOptions,
  GeneratorImport,
  GeneratorOptions,
  GeneratorSchema,
  GeneratorVerbOptions,
  GlobalMockOptions,
  MswMockOptions,
  NormalizedOverrideOutput,
  OpenApiSchemaObject,
} from '@orval/core';
import {
  EnumGeneration,
  isFakerMock,
  isMswMock,
  OutputMockType,
} from '@orval/core';
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

describe('generateFakerForSchemas enum factories (#3747)', () => {
  it('casts a top-level enum to its own array type', () => {
    const context = createTestContextSpec({
      override: { enumGenerationType: EnumGeneration.ENUM },
    });

    const result = generateFakerForSchemas(
      [
        {
          name: 'PetStatus',
          model: 'PetStatus',
          imports: [],
          schema: {
            type: 'string',
            enum: ['available', 'pending', 'sold'],
          },
        },
      ],
      context,
      { type: OutputMockType.FAKER, schemas: true },
    );

    expect(result.implementation).toContain(
      "faker.helpers.arrayElement(['available','pending','sold'] as PetStatus[])",
    );
    expect(result.implementation).not.toContain("PetStatus['PetStatus']");
  });
});

describe('generateFakerForSchemas schema-scoped overrides (override.mock.schemas)', () => {
  const appleColor = () => `'red'`;
  const carColor = () => `'midnight black'`;

  const context = createTestContextSpec({
    override: {
      mock: {
        schemas: {
          Apple: { properties: { color: appleColor } },
          Car: { properties: { color: carColor } },
        },
      },
    },
  });

  const appleSchema: GeneratorSchema = {
    name: 'Apple',
    model: 'Apple',
    imports: [],
    schema: {
      type: 'object',
      required: ['color'],
      properties: { color: { type: 'string' } },
    },
  };

  const carSchema: GeneratorSchema = {
    name: 'Car',
    model: 'Car',
    imports: [],
    schema: {
      type: 'object',
      required: ['color'],
      properties: { color: { type: 'string' } },
    },
  };

  it('applies a different override to the same property name per schema', () => {
    const result = generateFakerForSchemas([appleSchema, carSchema], context, {
      type: OutputMockType.FAKER,
      schemas: true,
    });

    expect(result.implementation).toContain(`color: (${String(appleColor)})()`);
    expect(result.implementation).toContain(`color: (${String(carColor)})()`);
  });

  it('applies the Apple schema-scoped override inside a referencing schema', () => {
    const basketSchema: GeneratorSchema = {
      name: 'Basket',
      model: 'Basket',
      imports: [],
      schema: {
        type: 'object',
        required: ['apple'],
        properties: { apple: { $ref: '#/components/schemas/Apple' } },
      },
    };

    context.spec.components = {
      schemas: {
        Apple: appleSchema.schema as Record<string, unknown>,
      },
    };

    const result = generateFakerForSchemas(
      [appleSchema, basketSchema],
      context,
      { type: OutputMockType.FAKER, schemas: true },
    );

    // `Apple.color` resolves through the Apple schema-scoped override whether
    // Basket inlines Apple's body or delegates to getAppleMock() — the factory
    // is built with the same mock options, so the override is baked into both.
    const basketBody = result.implementation.slice(
      result.implementation.indexOf('getBasketMock'),
    );
    expect(basketBody).toMatch(
      /apple: (\{ \.\.\.getAppleMock\(\) \}|\{color: \(\(\) => `'red'`\)\(\)\})/,
    );
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
    expect(result.strictMockSchemaKinds).toEqual({ Status: 'alias' });
    expect(result.implementation).not.toContain('overrideResponse');
    expect(result.implementation).toContain(
      'export const getStatusMock = (): StatusMock =>',
    );
    expect(result.implementation).not.toContain('export type StatusMock = {');

    const finalized = dedupeStrictMockTypeDeclarations(result.implementation, {
      mockOptions: { required: true, nonNullable: true },
      strictSchemaTypeNames: result.strictMockSchemaTypeNames,
      strictMockSchemaKinds: result.strictMockSchemaKinds,
    });

    expect(finalized).toContain('export type StatusMock = Status;');
    expect(finalized).not.toContain(
      'export type StatusMock = {\n  [K in keyof Required<Status>]',
    );
    expect(finalized).toContain('export type KeysWithNull<O>');
    expect(finalized.indexOf('export type StatusMock')).toBeLessThan(
      finalized.indexOf('export const getStatusMock'),
    );
  });

  it('does not emit null for nullable object schemas under strict nonNullable', () => {
    const result = generateFakerForSchemas(
      [
        {
          name: 'Widget',
          model: 'Widget',
          imports: [],
          schema: {
            type: ['object', 'null'],
            properties: {
              id: { type: 'string' },
            },
          },
        },
      ],
      context,
      { type: OutputMockType.FAKER, schemas: true },
    );

    expect(result.implementation).toContain(
      'export const getWidgetMock = <O extends Partial<Widget> = {}>(overrideResponse?: O): MockWithNullableOverrides<Widget, O, WidgetMock> =>',
    );
    expect(result.implementation).not.toContain(', null]');
  });
});

describe('generateFakerForSchemas recursion guards', () => {
  const strictContext = createTestContextSpec({
    override: {
      mock: {
        required: true,
        nonNullable: true,
      },
    },
  });

  const run = (schemas: Record<string, OpenApiSchemaObject>, root: string) => {
    strictContext.spec.components = { schemas };
    return generateFakerForSchemas(
      [
        {
          name: root,
          model: root,
          imports: [],
          schema: schemas[root]!,
        },
      ],
      strictContext,
      { type: OutputMockType.FAKER, schemas: true },
    );
  };

  it('does not overflow on a mutual allOf cycle (A allOf B, B allOf A)', () => {
    expect(() =>
      run(
        {
          A: { allOf: [{ $ref: '#/components/schemas/B' }] },
          B: { allOf: [{ $ref: '#/components/schemas/A' }] },
        },
        'A',
      ),
    ).not.toThrow();
  });

  it('does not overflow on a multi-hop allOf inheritance cycle', () => {
    expect(() =>
      run(
        {
          A: { allOf: [{ $ref: '#/components/schemas/B' }] },
          B: { allOf: [{ $ref: '#/components/schemas/C' }] },
          C: { allOf: [{ $ref: '#/components/schemas/A' }] },
        },
        'A',
      ),
    ).not.toThrow();
  });
});

describe('generateFakerForSchemas recursive reference terminators', () => {
  const run = (
    schemas: Record<string, OpenApiSchemaObject>,
    roots: string[],
    context = createTestContextSpec(),
  ) => {
    context.spec.components = { schemas };
    return generateFakerForSchemas(
      roots.map((root) => ({
        name: root,
        model: root,
        imports: [],
        schema: schemas[root]!,
      })),
      context,
      { type: OutputMockType.FAKER, schemas: true },
    );
  };

  const factoryBody = (implementation: string, factoryName: string) => {
    const start = implementation.indexOf(`export const ${factoryName}`);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = implementation.indexOf('export const', start + 1);
    return implementation.slice(start, end === -1 ? undefined : end);
  };

  const levelSchema = {
    type: 'object',
    required: ['entityType', 'nextLevelsWithConditions'],
    properties: {
      entityType: { type: 'string' },
      nextLevelsWithConditions: {
        type: 'array',
        items: { $ref: '#/components/schemas/LevelWithCondition' },
      },
    },
  } satisfies OpenApiSchemaObject;
  const levelWithConditionSchema = {
    type: 'object',
    required: ['condition', 'level'],
    properties: {
      condition: { type: 'string' },
      level: { $ref: '#/components/schemas/Level' },
    },
  } satisfies OpenApiSchemaObject;
  const levelSchemas: Record<string, OpenApiSchemaObject> = {
    Level: levelSchema,
    LevelWithCondition: levelWithConditionSchema,
  };

  it('stubs a required non-nullable recursive $ref instead of emitting null', () => {
    const result = run(levelSchemas, ['LevelWithCondition', 'Level']);

    expect(result.implementation).not.toContain('level: null');
    // The re-expansion terminates through the array guard one hop deeper.
    const levelMock = factoryBody(result.implementation, 'getLevelMock');
    expect(levelMock).toContain('level: {entityType:');
    expect(levelMock).toContain('nextLevelsWithConditions: []');
  });

  it('picks a concrete variant for a union member referencing its parent union', () => {
    const result = run(
      {
        TracingValue: {
          oneOf: [
            { $ref: '#/components/schemas/StringTracingValue' },
            { $ref: '#/components/schemas/RangeTracingValue' },
          ],
        },
        StringTracingValue: {
          type: 'object',
          required: ['value', 'type'],
          properties: {
            value: { type: 'string' },
            type: { type: 'string', enum: ['StringTracingValue'] },
          },
        },
        RangeTracingValue: {
          type: 'object',
          required: ['from', 'to', 'type'],
          properties: {
            from: { $ref: '#/components/schemas/TracingValue' },
            to: { $ref: '#/components/schemas/TracingValue' },
            type: { type: 'string', enum: ['RangeTracingValue'] },
          },
        },
      },
      ['StringTracingValue', 'RangeTracingValue', 'TracingValue'],
    );

    expect(result.implementation).not.toContain('from: null');
    expect(result.implementation).not.toContain('to: null');
    const helper = factoryBody(
      result.implementation,
      'getTracingValueResponseRangeTracingValueMock',
    );
    expect(helper).toContain(
      'from: faker.helpers.arrayElement([{...getTracingValueResponseStringTracingValueMock()}',
    );
  });

  it('keeps null for a required recursive $ref to a nullable schema', () => {
    const schemas: Record<string, OpenApiSchemaObject> = {
      ...levelSchemas,
      Level: {
        ...levelSchema,
        type: ['object', 'null'],
      },
    };
    const result = run(schemas, ['Level']);

    const levelMock = factoryBody(result.implementation, 'getLevelMock');
    expect(levelMock).toContain('level: null');
  });

  it('still omits an optional recursive $ref', () => {
    const schemas: Record<string, OpenApiSchemaObject> = {
      ...levelSchemas,
      LevelWithCondition: {
        ...levelWithConditionSchema,
        required: ['condition'],
      },
    };
    const result = run(schemas, ['Level']);

    const levelMock = factoryBody(result.implementation, 'getLevelMock');
    expect(levelMock).not.toContain('level:');
  });

  it('terminates a fully-required self cycle with a cast after one re-expansion', () => {
    const result = run(
      {
        Ouro: {
          type: 'object',
          required: ['next'],
          properties: { next: { $ref: '#/components/schemas/Ouro' } },
        },
      },
      ['Ouro'],
    );

    expect(result.implementation).not.toContain('next: null');
    expect(result.implementation).toContain('next: {} as unknown as Ouro');
  });

  it('terminates a fully-required mutual cycle with a cast', () => {
    const result = run(
      {
        A: {
          type: 'object',
          required: ['b'],
          properties: { b: { $ref: '#/components/schemas/B' } },
        },
        B: {
          type: 'object',
          required: ['a'],
          properties: { a: { $ref: '#/components/schemas/A' } },
        },
      },
      ['A', 'B'],
    );

    expect(result.implementation).not.toContain('a: null');
    expect(result.implementation).not.toContain('b: null');
    expect(result.implementation).toContain('as unknown as');
  });

  it('casts undefined for a required $ref union whose variants are all recursive', () => {
    const result = run(
      {
        OnlyRange: {
          oneOf: [{ $ref: '#/components/schemas/RangeOnly' }],
        },
        RangeOnly: {
          type: 'object',
          required: ['from'],
          properties: { from: { $ref: '#/components/schemas/OnlyRange' } },
        },
      },
      ['RangeOnly'],
    );

    expect(result.implementation).not.toContain('from: undefined}');
    expect(result.implementation).toContain(
      'from: undefined as unknown as OnlyRange',
    );
  });

  it('collapses a re-expansion that still needed casts inside', () => {
    const result = run(
      {
        Wrap: {
          type: 'object',
          required: ['inner'],
          properties: {
            inner: {
              type: 'object',
              required: ['next'],
              properties: { next: { $ref: '#/components/schemas/Wrap' } },
            },
          },
        },
      },
      ['Wrap'],
    );

    expect(result.implementation).toContain('next: {} as unknown as Wrap');
    expect(result.implementation).not.toContain('next: {inner:');
  });

  it('keeps output bounded on a dense cluster of mutually required refs', () => {
    const names = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5'];
    const schemas: Record<string, OpenApiSchemaObject> = Object.fromEntries(
      names.map((name) => [
        name,
        {
          type: 'object',
          required: names.filter((other) => other !== name),
          properties: Object.fromEntries(
            names
              .filter((other) => other !== name)
              .map((other) => [
                other,
                { $ref: `#/components/schemas/${other}` },
              ]),
          ),
        },
      ]),
    );

    const result = run(schemas, names);

    expect(result.implementation.length).toBeLessThan(300_000);
  });

  it('does not delegate a recursive $ref to its own factory (runtime cycle)', () => {
    const context = createTestContextSpec({
      output: {
        schemas: 'model',
        mock: {
          indexMockFiles: false,
          generators: [{ type: OutputMockType.FAKER, schemas: true }],
        },
      },
    });
    const result = run(
      {
        TreeNode: {
          type: 'object',
          required: ['next'],
          properties: { next: { $ref: '#/components/schemas/TreeNode' } },
        },
      },
      ['TreeNode'],
      context,
    );

    expect(result.implementation).not.toContain('next: { ...getTreeNodeMock()');
    expect(result.implementation).toContain('next: {} as unknown as TreeNode');
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

  const resolveLeafRef = (imports: GeneratorImport[]) =>
    resolveMockValue({
      schema: { $ref: '#/components/schemas/LeafDTO' },
      operationId: 'getUser',
      tags: [],
      context,
      imports,
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

  it('returns only its own factory import', () => {
    // Shared imports array given to both calls. The first call can't reveal the
    // bug since imports is empty.
    const imports: GeneratorImport[] = [];

    const first = resolveLeafRef(imports);
    expect(first.imports).toHaveLength(1);
    expect(first.imports[0]).toMatchObject({
      name: 'getLeafDTOMock',
      schemaFactory: true,
    });

    const second = resolveLeafRef(imports);
    expect(second.imports).toHaveLength(1);
    expect(second.imports[0]).toMatchObject({
      name: 'getLeafDTOMock',
      schemaFactory: true,
    });
  });
});

describe('oneOf split helpers forward body imports (#3656)', () => {
  // A oneOf variant that resolves to an object is split into its own
  // `get<Op>Response<Variant>Mock` helper. Any import the helper body uses as
  // a runtime value — e.g. a $ref'd string enum rendered as
  // `Object.values(ReasonEnum)` — must reach the shared imports array:
  // mutating that array suppresses the caller-side merge of the returned
  // imports, so forwarding only the variant's type import loses the enum
  // value import and the generated mock fails tsc with TS2304.
  // `enum` generation makes the $ref'd enum a runtime object, so the helper
  // renders it as `Object.values(ReasonEnum)` (see #3690 — `union` inlines the
  // values instead and forwards no value import).
  const context = createTestContextSpec({
    override: { enumGenerationType: EnumGeneration.ENUM },
    spec: {
      components: {
        schemas: {
          UpdatedDetails: {
            type: 'object',
            required: ['event_type', 'reason'],
            properties: {
              event_type: { type: 'string', enum: ['updated'] },
              reason: { $ref: '#/components/schemas/ReasonEnum' },
            },
          },
          ReasonEnum: { type: 'string', enum: ['queue_rebalance'] },
        },
      },
    },
  });

  it('registers the enum value import used by the split helper', () => {
    const imports: GeneratorImport[] = [];
    const splitMockImplementations: string[] = [];

    resolveMockValue({
      schema: { $ref: '#/components/schemas/UpdatedDetails' },
      operationId: 'listEvents',
      tags: [],
      combine: { separator: 'oneOf', includedProperties: [] },
      context,
      imports,
      existingReferencedProperties: [],
      splitMockImplementations,
    });

    // Precondition: the helper body references the enum as a runtime value.
    expect(splitMockImplementations).toHaveLength(1);
    expect(splitMockImplementations[0]).toContain('Object.values(ReasonEnum)');

    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'ReasonEnum', values: true }),
    );
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'UpdatedDetails', values: false }),
    );
  });
});

describe('schema-scoped overrides are preserved through factory delegation', () => {
  // A schema-scoped override targets a schema's *own* properties, so its
  // get<X>Mock factory bakes the override in. A referencing schema can keep
  // delegating to that factory — the override rides along.
  const appleColor = () => `'red'`;
  const context = createTestContextSpec({
    output: {
      schemas: 'model',
      mock: {
        indexMockFiles: false,
        generators: [{ type: OutputMockType.FAKER, schemas: true }],
      },
    },
    override: {
      mock: { schemas: { Apple: { properties: { color: appleColor } } } },
    },
    spec: {
      components: {
        schemas: {
          Apple: {
            type: 'object',
            required: ['color'],
            properties: { color: { type: 'string' } },
          },
        },
      },
    },
  });

  it('bakes the override into the factory and delegates from referencing schemas', () => {
    const result = generateFakerForSchemas(
      [
        {
          name: 'Apple',
          model: 'Apple',
          imports: [],
          schema: {
            type: 'object',
            required: ['color'],
            properties: { color: { type: 'string' } },
          },
        },
        {
          name: 'Basket',
          model: 'Basket',
          imports: [],
          schema: {
            type: 'object',
            required: ['apple'],
            properties: { apple: { $ref: '#/components/schemas/Apple' } },
          },
        },
      ],
      context,
      { type: OutputMockType.FAKER, schemas: true },
    );

    // Factory carries the override; Basket delegates to it.
    expect(result.implementation).toContain(`color: (${String(appleColor)})()`);
    expect(result.implementation).toContain('apple: { ...getAppleMock() }');
  });
});
