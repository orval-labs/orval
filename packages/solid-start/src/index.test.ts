import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '@orval/core';

import { Verbs } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { generateSolidStart } from './index';

// Minimal ContextSpec factory
function makeContext(
  parameters: unknown[] = [],
  useDates = false,
): ContextSpec {
  return {
    target: '',
    workspace: '',
    spec: {
      paths: {
        '/pets': {
          get: { parameters },
        },
      },
    },
    // @ts-expect-error -- partial mock
    output: {
      override: { useDates },
    },
  };
}

// Minimal GeneratorVerbOptions factory
function makeVerbOptions(
  overrides: Partial<GeneratorVerbOptions> = {},
): GeneratorVerbOptions {
  return {
    verb: Verbs.GET,
    route: '/pets',
    pathRoute: '/pets',
    operationId: 'listPets',
    operationName: 'listPets',
    doc: '',
    tags: [],
    // @ts-expect-error -- partial mock
    response: {
      definition: { success: 'Pet[]', errors: '' },
      imports: [],
      types: { success: [], errors: [] },
      contentTypes: ['application/json'],
      schemas: [],
      isBlob: false,
    },
    // @ts-expect-error -- partial mock
    body: {
      definition: '',
      implementation: '',
      imports: [],
      schemas: [],
      formData: undefined,
      formUrlEncoded: undefined,
      contentType: '',
      isOptional: true,
      originalSchema: {},
    },
    params: [],
    props: [],
    // @ts-expect-error -- partial mock
    override: {
      formData: { disabled: false },
      formUrlEncoded: false,
      requestOptions: false,
    },
    // @ts-expect-error -- partial mock
    originalOperation: {},
    ...overrides,
  };
}

// Minimal GeneratorOptions factory
function makeOptions(
  context: ContextSpec,
  overrides: Partial<GeneratorOptions> = {},
): GeneratorOptions {
  return {
    route: '/pets',
    pathRoute: '/pets',
    // @ts-expect-error -- partial mock
    override: {},
    output: '',
    context,
    ...overrides,
  };
}

// Context factory supporting both path-item-level and operation-level parameters
function makeContextWithPathParams(
  pathParameters: unknown[] = [],
  operationParameters: unknown[] = [],
  useDates = false,
): ContextSpec {
  return {
    target: '',
    workspace: '',
    spec: {
      paths: {
        '/pets': {
          parameters: pathParameters,
          get: { parameters: operationParameters },
        },
      },
    },
    // @ts-expect-error -- partial mock
    output: { override: { useDates } },
  };
}

// Minimal truthy queryParams object (schema content not used in the code path under test)
const STUB_QUERY_PARAMS: GeneratorVerbOptions['queryParams'] = {
  // @ts-expect-error -- partial mock
  schema: { model: 'export type ListPetsParams = { limit?: string }' },
  deps: [],
  isOptional: true,
};

describe('generateSolidStart — query string serialization', () => {
  it('uses a simple url template when there are no query params', () => {
    const verbOptions = makeVerbOptions();
    const options = makeOptions(makeContext());

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('const url = `/pets`');
    expect(implementation).not.toContain('URLSearchParams');
  });

  it('uses URLSearchParams without explode logic for non-array params', () => {
    const parameters = [
      { name: 'limit', in: 'query', schema: { type: 'string' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('new URLSearchParams()');
    // no per-element forEach for a non-array param
    expect(implementation).not.toContain('const explodeParameters');
    // standard scalar append
    expect(implementation).toContain('normalizedParams.append(key');
  });

  it('generates per-element append for an array param with explode:true', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('new URLSearchParams()');
    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain(
      'if (Array.isArray(value) && explodeParameters.includes(key))',
    );
    expect(implementation).toContain('value.forEach((v) => {');
    expect(implementation).toContain('normalizedParams.append(key,');
  });

  it('does NOT generate explode logic for an array param with explode:false', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
    // still has the regular append (which internally uses Array.isArray for comma-joining)
    expect(implementation).toContain('normalizedParams.append(key');
  });

  it('treats a query array param as exploded when style and explode are both omitted (OpenAPI default)', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain('Array.isArray(value)');
  });

  it('handles multiple exploded array params', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('"country"');
    expect(implementation).toContain('"status"');
    expect(implementation).toContain('Array.isArray(value)');
  });

  it('handles mixed exploded-array and scalar params', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    // explode path for the array param
    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain('Array.isArray(value)');
    // scalar fallback still present (the ternary after the Array.isArray branch)
    expect(implementation).toContain(
      "value === null ? 'null' : value.toString()",
    );
  });

  it('generates per-element append for an array param declared via oneOf', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["tag"]');
    expect(implementation).toContain('Array.isArray(value)');
  });
});

describe('generateSolidStart — path-level parameter merging', () => {
  it('picks up an exploded array param defined at the path-item level', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["country"]');
    expect(implementation).toContain('Array.isArray(value)');
  });

  it('operation-level parameter overrides path-level one with the same (in, name)', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
  });

  it('merges path-level and operation-level params without duplicating shared names', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('"country"');
    expect(implementation).toContain('"status"');
    // 'country' must not appear twice in the explodeParameters array literal
    expect(String(implementation).split('"country"').length - 1).toBe(1);
  });
});

describe('generateSolidStart — date-time format on array items (useDates)', () => {
  it('generates toISOString() for an exploded array<date-time> param', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["dates"]');
    expect(implementation).toContain('v instanceof Date ? v.toISOString()');
  });

  it('does NOT generate toISOString() for exploded array<date-time> when useDates is false', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["dates"]');
    expect(implementation).not.toContain('v instanceof Date ? v.toISOString()');
  });

  it('generates toISOString() for a scalar date-time param (existing behaviour unchanged)', () => {
    const parameters = [
      {
        name: 'since',
        in: 'query',
        schema: { type: 'string', format: 'date-time' },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters, true));

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).toContain(
      'value instanceof Date ? value.toISOString()',
    );
    expect(implementation).not.toContain('const explodeParameters');
  });

  it('generates toISOString() inside the map callback for a non-exploded array<date-time> param when useDates is true', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    // No explode path — array is comma-joined via the normal params implementation
    expect(implementation).not.toContain('const explodeParameters');
    // The map callback must use toISOString() for Date values
    expect(implementation).toContain('v instanceof Date ? v.toISOString()');
  });

  it('does NOT generate toISOString() in the map callback for a non-exploded array<date-time> param when useDates is false', () => {
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

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
    expect(implementation).not.toContain('v instanceof Date ? v.toISOString()');
  });
});
