import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '@orval/core';
import { Verbs } from '@orval/core';

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

  it('does NOT generate explode logic for an array param without explode:true', () => {
    const parameters = [
      {
        name: 'country',
        in: 'query',
        // explode not set (defaults to false for non-form styles)
        schema: { type: 'array', items: { type: 'string' } },
      },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const { implementation } = generateSolidStart(verbOptions, options);

    expect(implementation).not.toContain('const explodeParameters');
    expect(implementation).not.toContain('Array.isArray(value)');
    // still has the regular append
    expect(implementation).toContain('normalizedParams.append(key');
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
    // scalar fallback still present
    expect(implementation).toContain(
      'normalizedParams.append(key, value === null',
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
