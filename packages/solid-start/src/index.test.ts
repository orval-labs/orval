import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiParameterObject,
  OpenApiReferenceObject,
} from '@orval/core';
import {
  GetterPropType,
  OutputClient,
  PropertySortOrder,
  Verbs,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  createTestContextSpec,
  createTestGeneratorOptions,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
import { generateSolidStart, generateSolidStartHeader } from './index';

type SolidStartGeneratorOptions = Parameters<typeof generateSolidStart>[1];
type SolidStartGeneratorResult = Awaited<ReturnType<typeof generateSolidStart>>;
type OpenApiParameterLike = OpenApiParameterObject | OpenApiReferenceObject;

type TestParameter = {
  name: string;
  in: string;
  style?: string;
  explode?: boolean;
  schema?: Record<string, unknown>;
};

function makeContext(
  parameters: TestParameter[] = [],
  useDates = false,
): ContextSpec {
  const context = createTestContextSpec({
    spec: {
      paths: {
        '/pets': {
          get: {
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    },
    output: {
      propertySortOrder: PropertySortOrder.ALPHABETICAL,
    },
    override: { useDates },
  });
  const operation = context.spec.paths?.['/pets']?.get;
  if (operation) {
    operation.parameters = parameters as OpenApiParameterLike[];
  }
  return context;
}

function makeVerbOptions(
  overrides: Parameters<typeof createTestGeneratorVerbOptions>[0] = {},
): GeneratorVerbOptions {
  const { override, ...rest } = overrides;
  return createTestGeneratorVerbOptions({
    verb: Verbs.GET,
    route: '/pets',
    pathRoute: '/pets',
    operationId: 'listPets',
    operationName: 'listPets',
    typeName: 'listPets',
    response: {
      definition: { success: 'Pet[]', errors: '' },
      contentTypes: ['application/json'],
    },
    ...rest,
    override: {
      requestOptions: false,
      formUrlEncoded: false,
      ...override,
    },
  });
}

function makeOptions(
  context: ContextSpec,
  overrides: Partial<GeneratorOptions> = {},
): SolidStartGeneratorOptions {
  return {
    ...createTestGeneratorOptions({
      route: '/pets',
      pathRoute: '/pets',
    }),
    context,
    ...overrides,
  } satisfies SolidStartGeneratorOptions;
}

function makeContextWithPathParams(
  pathParameters: TestParameter[] = [],
  operationParameters: TestParameter[] = [],
  useDates = false,
): ContextSpec {
  const context = createTestContextSpec({
    spec: {
      paths: {
        '/pets': {
          get: {
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    },
    output: {
      propertySortOrder: PropertySortOrder.ALPHABETICAL,
    },
    override: { useDates },
  });
  const pathItem = context.spec.paths?.['/pets'];
  if (pathItem) {
    pathItem.parameters = pathParameters as OpenApiParameterLike[];
    if (pathItem.get) {
      pathItem.get.parameters = operationParameters as OpenApiParameterLike[];
    }
  }
  return context;
}

const STUB_QUERY_PARAMS = {
  schema: {
    name: 'ListPetsParams',
    model: 'export type ListPetsParams = { limit?: string }',
    imports: [],
  },
  deps: [],
  isOptional: true,
} satisfies NonNullable<GeneratorVerbOptions['queryParams']>;

async function generateImplementation(
  verbOptions: GeneratorVerbOptions,
  options: SolidStartGeneratorOptions,
): Promise<SolidStartGeneratorResult['implementation']> {
  const result = await generateSolidStart(
    verbOptions,
    options,
    OutputClient.SOLID_START,
  );

  return result.implementation;
}

describe('generateSolidStart — query string serialization', () => {
  it('uses a simple url template when there are no query params', async () => {
    const verbOptions = makeVerbOptions();
    const options = makeOptions(makeContext());

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const url = `/pets`');
    expect(implementation).not.toContain('URLSearchParams');
  });

  it('uses URLSearchParams without explode logic for non-array params', async () => {
    const parameters = [
      { name: 'limit', in: 'query', schema: { type: 'string' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('new URLSearchParams()');
    // no per-element forEach for a non-array param
    expect(implementation).not.toContain('const explodeParameters');
    // standard scalar append
    expect(implementation).toContain('normalizedParams.append(key');
  });

  it('generates per-element append for an array param with explode:true', async () => {
    const parameters = [
      {
        name: 'country',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('new URLSearchParams()');
    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain(
      'if (Array.isArray(value) && explodeParameters.includes(key))',
    );
    expect(implementation).toContain('value.forEach((v) => {');
    expect(implementation).toContain('normalizedParams.append(key,');
  });

  it('does NOT generate explode logic for an array param with explode:false', async () => {
    const parameters = [
      {
        name: 'country',
        in: 'query',
        explode: false,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
    // still has the regular append (which internally uses Array.isArray for comma-joining)
    expect(implementation).toContain('normalizedParams.append(key');
  });

  it('treats a query array param as exploded when style and explode are both omitted (OpenAPI default)', async () => {
    // Per OpenAPI spec: omitted style defaults to 'form', and 'form' defaults explode to true.
    const parameters = [
      {
        name: 'country',
        in: 'query',
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain('Array.isArray(value)');
  });

  it('handles multiple exploded array params', async () => {
    const parameters = [
      {
        name: 'country',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
      {
        name: 'status',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('"country"');
    expect(implementation).toContain('"status"');
    expect(implementation).toContain('Array.isArray(value)');
  });

  it('handles mixed exploded-array and scalar params', async () => {
    const parameters = [
      {
        name: 'country',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    // explode path for the array param
    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain('Array.isArray(value)');
    // scalar fallback still present (the ternary after the Array.isArray branch)
    expect(implementation).toContain("value === null ? 'null' : String(value)");
  });

  it('generates per-element append for an array param declared via oneOf', async () => {
    const parameters = [
      {
        name: 'tag',
        in: 'query',
        explode: true,
        schema: {
          oneOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'null' },
          ],
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["tag"]');
    expect(implementation).toContain('Array.isArray(value)');
  });
});

describe('generateSolidStart — path-level parameter merging', () => {
  it('picks up an exploded array param defined at the path-item level', async () => {
    const context = makeContextWithPathParams([
      {
        name: 'country',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ]);
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(context);

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain('Array.isArray(value)');
  });

  it('operation-level parameter overrides path-level one with the same (in, name)', async () => {
    // path-item has explode:true; operation overrides to explode:false — explode logic must be absent
    const context = makeContextWithPathParams(
      [
        {
          name: 'status',
          in: 'query',
          explode: true,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ],
      [
        {
          name: 'status',
          in: 'query',
          explode: false,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ],
    );
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(context);

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
  });

  it('merges path-level and operation-level params without duplicating shared names', async () => {
    // path-item contributes 'country'; operation contributes 'status'; 'country' appears only once
    const context = makeContextWithPathParams(
      [
        {
          name: 'country',
          in: 'query',
          explode: true,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ],
      [
        {
          name: 'status',
          in: 'query',
          explode: true,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ],
    );
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(context);

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('"country"');
    expect(implementation).toContain('"status"');
    // 'country' must not appear twice in the explodeParameters array literal
    expect(implementation.split('"country"').length - 1).toBe(1);
  });
});

describe('generateSolidStart — deepObject query parameters', () => {
  it('generates bracket notation for a style:deepObject query param', async () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: {
            call_id: { type: 'string' },
          },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).toContain(
      "typeof value === 'object' && value !== null && !Array.isArray(value) && deepObjectParameters.includes(key)",
    );
    expect(implementation).toContain(
      'Object.entries(value).forEach(([subKey, subValue])',
    );
    expect(implementation).toContain('deepObjectEntries.push(');
    expect(implementation).toContain('encodeURIComponent(key)');
    expect(implementation).toContain('encodeURIComponent(subKey)');
    expect(implementation).toContain(
      "[normalizedParams.toString(), deepObjectEntries.join('&')].filter(Boolean).join('&')",
    );
  });

  it('does NOT generate deepObjectEntries when there are no deepObject params', async () => {
    const parameters = [
      { name: 'limit', in: 'query', schema: { type: 'string' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('deepObjectEntries');
  });

  it('does NOT generate deepObject logic for a plain object param without style:deepObject', async () => {
    const parameters = [
      {
        name: 'filter',
        in: 'query',
        schema: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('deepObjectParameters');
    expect(implementation).toContain('normalizedParams.append(key');
  });

  it('handles mixed deepObject and scalar params', async () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { call_id: { type: 'string' } },
        },
      },
      { name: 'limit', in: 'query', schema: { type: 'integer' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).toContain('deepObjectEntries.push(');
    // scalar fallback still present for `limit`
    expect(implementation).toContain("value === null ? 'null' : String(value)");
  });

  it('handles mixed deepObject and exploded array params', async () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { call_id: { type: 'string' } },
        },
      },
      {
        name: 'tags',
        in: 'query',
        explode: true,
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["tags"]');
    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    // both branches handle all params, so no scalar fallback
    expect(implementation).not.toContain(
      "value === null ? 'null' : String(value)",
    );
  });

  it('picks up a deepObject param defined at the path-item level', async () => {
    const context = makeContextWithPathParams([
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { call_id: { type: 'string' } },
        },
      },
    ]);
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(context);

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).toContain('deepObjectEntries.push(');
  });

  it('handles multiple deepObject params', async () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { call_id: { type: 'string' } },
        },
      },
      {
        name: 'filter',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: { status: { type: 'string' } },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('"scope"');
    expect(implementation).toContain('"filter"');
    expect(implementation).toContain('deepObjectEntries.push(');
  });

  it('generates toISOString() for deepObject properties with date-time format when useDates is true', async () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: {
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, true));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).toContain(
      'subValue instanceof Date ? subValue.toISOString()',
    );
  });

  it('does NOT generate toISOString() for deepObject when useDates is false', async () => {
    const parameters = [
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          properties: {
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, false));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).not.toContain(
      'subValue instanceof Date ? subValue.toISOString()',
    );
  });
});

describe('generateSolidStart — date-time format on array items (useDates)', () => {
  it('generates toISOString() for an exploded array<date-time> param', async () => {
    const parameters = [
      {
        name: 'dates',
        in: 'query',
        explode: true,
        schema: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, true));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["dates"]');
    expect(implementation).toContain('v instanceof Date ? v.toISOString()');
  });

  it('does NOT generate toISOString() for exploded array<date-time> when useDates is false', async () => {
    const parameters = [
      {
        name: 'dates',
        in: 'query',
        explode: true,
        schema: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, false));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["dates"]');
    expect(implementation).not.toContain('v instanceof Date ? v.toISOString()');
  });

  it('generates toISOString() for a scalar date-time param (existing behaviour unchanged)', async () => {
    const parameters = [
      {
        name: 'since',
        in: 'query',
        schema: { type: 'string', format: 'date-time' },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, true));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).toContain(
      'value instanceof Date ? value.toISOString()',
    );
    expect(implementation).not.toContain('const explodeParameters');
  });

  it('generates toISOString() inside the map callback for a non-exploded array<date-time> param when useDates is true', async () => {
    const parameters = [
      {
        name: 'dates',
        in: 'query',
        explode: false,
        schema: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, true));

    const implementation = await generateImplementation(verbOptions, options);

    // No explode path — array is comma-joined via the normal params implementation
    expect(implementation).not.toContain('const explodeParameters');
    // The map callback must use toISOString() for Date values
    expect(implementation).toContain('v instanceof Date ? v.toISOString()');
  });

  it('does NOT generate toISOString() in the map callback for a non-exploded array<date-time> param when useDates is false', async () => {
    const parameters = [
      {
        name: 'dates',
        in: 'query',
        explode: false,
        schema: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, false));

    const implementation = await generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
    expect(implementation).not.toContain('v instanceof Date ? v.toISOString()');
  });
});

describe('generateSolidStartHeader namespace collision', () => {
  const verbImporting = (
    tags: string[],
    importNames: string[],
  ): GeneratorVerbOptions => {
    return makeVerbOptions({
      tags,
      response: {
        definition: { success: 'Pet[]', errors: '' },
        contentTypes: ['application/json'],
        imports: importNames.map((name) => ({ name })),
      },
    });
  };

  const namespaceFor = (
    title: string,
    verbOptions: Record<string, GeneratorVerbOptions>,
    tag?: string,
  ) => {
    const header = generateSolidStartHeader({
      title,
      isRequestOptions: false,
      isMutator: false,
      isGlobalMutator: false,
      provideIn: false,
      hasAwaitedType: false,
      output: createTestContextSpec().output,
      verbOptions,
      tag,
      clientImplementation: '',
    });
    const source = typeof header === 'string' ? header : header.implementation;
    return /export const (\w+) = \{/.exec(source)?.[1];
  };

  it('keeps the plain tag name when nothing in the file collides', () => {
    expect(
      namespaceFor(
        'Pets',
        { listPets: verbImporting(['pets'], ['Pet']) },
        'pets',
      ),
    ).toBe('Pets');
  });

  it('suffixes when this file imports a schema of the same name', () => {
    expect(
      namespaceFor(
        'Pets',
        { listPets: verbImporting(['pets'], ['Pets']) },
        'pets',
      ),
    ).toBe('PetsApi');
  });

  it('does not suffix when only another tag imports the colliding name', () => {
    expect(
      namespaceFor(
        'Health',
        {
          healthCheck: verbImporting(['health'], []),
          listPets: verbImporting(['pets'], ['Health']),
        },
        'health',
      ),
    ).toBe('Health');
  });

  it('escalates past a suffixed name that is also taken', () => {
    expect(
      namespaceFor(
        'Pets',
        { listPets: verbImporting(['pets'], ['Pets', 'PetsApi']) },
        'pets',
      ),
    ).toBe('PetsApi2');
  });

  it('scans every operation when there is no tag bucket (single-file mode)', () => {
    expect(
      namespaceFor('Pets', { listPets: verbImporting([], ['Pets']) }),
    ).toBe('PetsApi');
  });
});

describe('generateSolidStart — Content-Type header escaping', () => {
  it('escapes single quotes in the request body media type key', async () => {
    const verbOptions = makeVerbOptions({
      verb: Verbs.POST,
      mutator: {
        name: 'customInstance',
        path: './custom-instance.ts',
        default: false,
        hasErrorType: false,
        errorTypeName: '',
        hasSecondArg: true,
        hasThirdArg: false,
        isHook: false,
      },
      body: {
        definition: 'SubmitDataBody',
        implementation: 'submitDataBody: SubmitDataBody',
        contentType: "application/json', 'X-Evil': 'injected",
        isOptional: false,
      },
    });

    const implementation = await generateImplementation(
      verbOptions,
      makeOptions(makeContext()),
    );

    expect(implementation).toContain(
      String.raw`'Content-Type': 'application/json\', \'X-Evil\': \'injected'`,
    );
    expect(implementation).not.toContain("'X-Evil': 'injected'");
  });
});

describe('generateSolidStart — mutator body type', () => {
  const generateCreatePet = (definition: string, petIdType = 'PetStatus') =>
    generateImplementation(
      makeVerbOptions({
        verb: Verbs.POST,
        operationId: 'createPet',
        operationName: 'createPet',
        mutator: {
          name: 'customInstance',
          path: './custom-instance',
          default: false,
          hasErrorType: false,
          errorTypeName: '',
          hasSecondArg: false,
          hasThirdArg: false,
          isHook: false,
          bodyTypeName: 'BodyType',
        },
        body: {
          ...makeVerbOptions().body,
          definition,
          implementation: 'pet',
          isOptional: false,
        },
        props: [
          {
            name: 'petId',
            definition: `petId: ${petIdType}`,
            implementation: `petId: ${petIdType}`,
            default: false,
            required: true,
            type: GetterPropType.PARAM,
          },
          {
            name: 'pet',
            definition: `pet: ${definition}`,
            implementation: `pet: ${definition}`,
            default: false,
            required: true,
            type: GetterPropType.BODY,
          },
        ],
      }),
      makeOptions(makeContextWithPathParams()),
    );

  it.each([['Pet'], ['Pet[]'], ['Pet | Cat'], ["'$1' | 'b'"], ["'$&'"]])(
    'wraps a %s body in the mutator BodyType envelope',
    async (definition) => {
      expect(await generateCreatePet(definition)).toContain(
        `(petId: PetStatus,\n    pet: BodyType<${definition}>,)`,
      );
    },
  );

  it('wraps the body rather than a path param of the same type', async () => {
    expect(await generateCreatePet('PetStatus', 'PetStatus')).toContain(
      `(petId: PetStatus,\n    pet: BodyType<PetStatus>,)`,
    );
  });
});
