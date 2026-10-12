import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type {
  ContextSpec,
  GeneratorOperation,
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiParameterObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResReqTypesValue,
} from '@orval/core';
import {
  GetterPropType,
  HTTP_STATUS_CODE_SHARED_TYPES,
  OutputClient,
  PropertySortOrder,
  Verbs,
} from '@orval/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestContextSpec,
  createTestGeneratorOptions,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
import {
  generateClient,
  generateFetchFooter,
  generateFetchHeader,
  generateRequestFunction,
} from './index';
import { RUNTIME_TEMPLATE } from './runtime';

type OpenApiParameterLike = OpenApiParameterObject | OpenApiReferenceObject;

type TestParameter = {
  name: string;
  in: string;
  style?: string;
  explode?: boolean;
  // Record keeps widened fixture objects assignable. OpenApiSchemaObject
  // adds JSON Schema booleans, which Record<string, unknown> rejects.
  schema?: OpenApiSchemaObject | Record<string, unknown>;
};

const successType = (
  overrides: Partial<ResReqTypesValue> &
    Pick<ResReqTypesValue, 'key' | 'value'>,
): ResReqTypesValue => ({
  contentType: 'application/json',
  hasReadonlyProps: false,
  imports: [],
  isEnum: false,
  isRef: false,
  schemas: [],
  type: 'object',
  dependencies: [],
  ...overrides,
});

function makeContext(
  parameters: TestParameter[] = [],
  useDates = false,
  schemas?: ContextSpec['output']['schemas'],
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
      ...(schemas === undefined ? {} : { schemas }),
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
      fetch: {
        includeHttpResponseReturnType: false,
        forceSuccessResponse: false,
        runtimeValidation: { enabled: false, strategy: 'throw' },
      },
      ...override,
    },
  });
}

function makeOptions(
  context: ContextSpec,
  overrides: Partial<GeneratorOptions> = {},
): GeneratorOptions {
  return {
    ...createTestGeneratorOptions({
      route: '/pets',
      pathRoute: '/pets',
    }),
    context,
    ...overrides,
  } satisfies GeneratorOptions;
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

function generateImplementation(
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
): string {
  return generateRequestFunction(verbOptions, options);
}

describe('generateRequestFunction — deepObject query parameters', () => {
  it('generates bracket notation for a style:deepObject query param', () => {
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

    const implementation = generateImplementation(verbOptions, options);

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

  it('does NOT decode brackets when there are no deepObject params', () => {
    const parameters = [
      { name: 'limit', in: 'query', schema: { type: 'string' } },
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('deepObjectEntries');
  });

  it('does NOT generate deepObject logic for a plain object param without style:deepObject', () => {
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

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).not.toContain('deepObjectParameters');
    expect(implementation).toContain('normalizedParams.append(key');
  });

  it('handles mixed deepObject and scalar params', () => {
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

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).toContain('deepObjectEntries.push(');
    // scalar fallback still present for `limit`
    expect(implementation).toContain("value === null ? 'null' : String(value)");
  });

  it('handles mixed deepObject and exploded array params', () => {
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

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const explodeParameters = ["tags"]');
    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    // both explode and deepObject are the only params, so no scalar fallback
    expect(implementation).not.toContain(
      "value === null ? 'null' : String(value)",
    );
  });

  it('omits scalar fallback when all params are deepObject', () => {
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
    ];
    const verbOptions = makeVerbOptions({ queryParams: STUB_QUERY_PARAMS });
    const options = makeOptions(makeContext(parameters));

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).not.toContain(
      "value === null ? 'null' : String(value)",
    );
  });

  it('generates toISOString() for deepObject properties with date-time format when useDates is true', () => {
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

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).toContain(
      'subValue instanceof Date ? subValue.toISOString()',
    );
  });

  it('does NOT generate toISOString() for deepObject when useDates is false', () => {
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

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('const deepObjectParameters = ["scope"]');
    expect(implementation).not.toContain(
      'subValue instanceof Date ? subValue.toISOString()',
    );
  });

  it('handles multiple deepObject params', () => {
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

    const implementation = generateImplementation(verbOptions, options);

    expect(implementation).toContain('"scope"');
    expect(implementation).toContain('"filter"');
    expect(implementation).toContain('deepObjectEntries.push(');
  });
});

describe('generateRequestFunction — zod runtimeValidation response typing (#3938)', () => {
  const ZOD_RESPONSE: GeneratorVerbOptions['response'] = {
    definition: { success: 'Pets', errors: 'Error' },
    imports: [{ name: 'Pets', schemaName: 'Pets', values: true }],
    types: {
      success: [
        successType({
          key: '200',
          value: 'Pets',
          isRef: true,
        }),
      ],
      errors: [],
    },
    contentTypes: ['application/json'],
    schemas: [],
    isBlob: false,
  };

  function makeZodValidationVerbOptions(
    overrides: Parameters<typeof makeVerbOptions>[0] = {},
  ): GeneratorVerbOptions {
    return makeVerbOptions({
      response: ZOD_RESPONSE,
      typeName: 'listPets',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
          runtimeValidation: { enabled: true, strategy: 'throw' },
        },
      },
      ...overrides,
    });
  }

  function makeZodContext(): ContextSpec {
    return makeContext([], false, {
      path: './model',
      type: 'zod',
      splitByTags: false,
    });
  }

  it('declares the parsed response as the zod output alias', () => {
    const implementation = generateRequestFunction(
      makeZodValidationVerbOptions(),
      makeOptions(makeZodContext()),
    );

    expect(implementation).toContain('): Promise<PetsOutput> =>');
    expect(implementation).toContain('Pets.parse(parsedBody)');
    expect(implementation).not.toContain('Promise<Pets>');
  });

  it('uses the output alias for the data field with includeHttpResponseReturnType', () => {
    const verbOptions = makeZodValidationVerbOptions();
    verbOptions.override.fetch.includeHttpResponseReturnType = true;

    const implementation = generateRequestFunction(
      verbOptions,
      makeOptions(makeZodContext()),
    );

    expect(implementation).toContain('data: PetsOutput');
    expect(implementation).toContain('): Promise<listPetsResponse> =>');
  });

  it('keeps the schema (input) type when a custom mutator owns the request', () => {
    const verbOptions = makeZodValidationVerbOptions({
      mutator: {
        name: 'customFetch',
        path: './mutator.ts',
        default: false,
        hasErrorType: false,
        errorTypeName: '',
        hasSecondArg: false,
        hasThirdArg: false,
        isHook: false,
      },
    });

    const implementation = generateRequestFunction(
      verbOptions,
      makeOptions(makeZodContext()),
    );

    expect(implementation).toContain('): Promise<Pets> =>');
    expect(implementation).not.toContain('PetsOutput');
  });

  it('keeps the Zod schema in the second argument alongside error metadata', () => {
    const operation = makeZodValidationVerbOptions({
      mutator: {
        name: 'customFetch',
        path: './mutator.ts',
        default: false,
        hasErrorType: false,
        errorTypeName: '',
        hasSecondArg: true,
        hasThirdArg: true,
        isHook: false,
      },
    });
    Object.assign(operation.override.fetch, {
      includeHttpResponseReturnType: true,
      forceSuccessResponse: true,
      includeHttpErrorResponse: true,
    });
    const context = makeZodContext();
    context.output.override.includeZodSchemaInArguments = true;
    const implementation = generateRequestFunction(
      operation,
      makeOptions(context),
    );
    expect(implementation).toMatch(/schema: Pets\s*}\s*,/);
    expect(implementation).toContain(JSON.stringify({ errorResponses: [] }));
  });

  it('keeps the schema (input) type when the schemas output is not zod', () => {
    const implementation = generateRequestFunction(
      makeZodValidationVerbOptions(),
      makeOptions(makeContext()),
    );

    expect(implementation).toContain('): Promise<Pets> =>');
    expect(implementation).not.toContain('PetsOutput');
  });
});

describe('generateRequestFunction — inline array response validation (#4106)', () => {
  // An inline `type: array` response resolves to the definition `Item[]`, which
  // is never an import name, so the exact-name gate skipped validation entirely
  // while a `$ref` to a named array component validated normally.
  function makeArrayResponse(
    definition: string,
    imports: { name: string }[],
  ): GeneratorVerbOptions['response'] {
    return {
      definition: { success: definition, errors: 'Error' },
      imports,
      types: {
        success: [
          successType({
            key: '200',
            value: definition,
            type: 'array',
          }),
        ],
        errors: [],
      },
      contentTypes: ['application/json'],
      schemas: [],
      isBlob: false,
    };
  }

  function makeArrayVerbOptions(
    definition: string,
    imports: { name: string }[],
  ): GeneratorVerbOptions {
    return makeVerbOptions({
      response: makeArrayResponse(definition, imports),
      typeName: 'listPets',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
          runtimeValidation: { enabled: true, strategy: 'throw' },
        },
      },
    });
  }

  function makeZodOptions() {
    return makeOptions(
      makeContext([], false, {
        path: './model',
        type: 'zod',
        splitByTags: false,
      }),
    );
  }

  it('validates an inline array through its element schema', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('Pet[]', [{ name: 'Pet' }]),
      makeZodOptions(),
    );

    expect(implementation).toContain('zod.array(Pet).parse(parsedBody)');
    expect(implementation).toContain('): Promise<PetOutput[]> =>');
  });

  it('references the Error schema by its aliased binding', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('Error[]', [{ name: 'Error' }]),
      makeZodOptions(),
    );

    expect(implementation).toContain(
      'zod.array(ErrorSchema).parse(parsedBody)',
    );
  });

  it('leaves a primitive element array unvalidated', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('string[]', [{ name: 'Pet' }]),
      makeZodOptions(),
    );

    expect(implementation).not.toContain('zod.array(');
  });

  it('leaves a nested array unvalidated', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('Pet[][]', [{ name: 'Pet' }]),
      makeZodOptions(),
    );

    expect(implementation).not.toContain('zod.array(');
  });

  it('leaves an array whose element has no schema import unvalidated', () => {
    const implementation = generateRequestFunction(
      makeArrayVerbOptions('Pet[]', []),
      makeZodOptions(),
    );

    expect(implementation).not.toContain('zod.array(');
  });
});

describe('generateRequestFunction — response status precedence', () => {
  it('excludes exact responses from matching wildcard responses', () => {
    const response: GeneratorVerbOptions['response'] = {
      definition: { success: 'Pet | void', errors: '' },
      imports: [],
      types: {
        success: [
          successType({ key: '200', value: 'Pet' }),
          successType({ key: '2XX', value: 'void', contentType: '' }),
        ],
        errors: [],
      },
      contentTypes: ['application/json'],
      schemas: [],
      isBlob: false,
    };
    const verbOptions = makeVerbOptions({
      response,
      override: {
        fetch: { includeHttpResponseReturnType: true },
      },
    });

    const implementation = generateRequestFunction(
      verbOptions,
      makeOptions(makeContext()),
    );

    expect(implementation).toContain('status: Exclude<HTTPStatusCode2xx, 200>');
  });

  // GHSA-rw75-cc5p-q7c9: the key lands in `status: <key>`, an unquoted type
  // position, so a key that closes the object early turns the rest into a
  // top-level statement. A type-stripping build (esbuild, Vite, tsx, swc) then
  // runs it at import time.
  it('refuses a response status key that is not a status code', () => {
    const injected =
      'number }; globalThis.__pwned = 1; type _Ignore = { _z: number';
    const response: GeneratorVerbOptions['response'] = {
      definition: { success: 'Pet', errors: '' },
      imports: [],
      types: {
        success: [
          successType({ key: '200', value: 'Pet' }),
          successType({ key: injected, value: 'Pet' }),
        ],
        errors: [],
      },
      contentTypes: ['application/json'],
      schemas: [],
      isBlob: false,
    };
    const verbOptions = makeVerbOptions({
      response,
      override: {
        fetch: { includeHttpResponseReturnType: true },
      },
    });

    expect(() =>
      generateRequestFunction(verbOptions, makeOptions(makeContext())),
    ).toThrow(/not a status code/);
  });
});

describe('generateRequestFunction — Content-Type header escaping', () => {
  it('escapes single quotes in the request body media type key', () => {
    const verbOptions = makeVerbOptions({
      verb: Verbs.POST,
      body: {
        definition: 'SubmitDataBody',
        implementation: 'submitDataBody: SubmitDataBody',
        contentType: "application/json', 'X-Evil': 'injected",
        isOptional: false,
      },
    });

    const implementation = generateImplementation(
      verbOptions,
      makeOptions(makeContext()),
    );

    expect(implementation).toContain(
      String.raw`'Content-Type': 'application/json\', \'X-Evil\': \'injected'`,
    );
    expect(implementation).not.toContain("'X-Evil': 'injected'");
  });
});

describe('generateRequestFunction — getHeaders helper (#4034)', () => {
  const verbOptionsWithHeaders = () =>
    makeVerbOptions({
      verb: Verbs.POST,
      override: { ...makeVerbOptions().override, requestOptions: true },
      body: {
        definition: 'CreatePetBody',
        implementation: 'createPetBody: CreatePetBody',
        contentType: 'application/json',
        isOptional: false,
      },
    });

  it('keeps static body headers without referencing disabled request options', () => {
    const verb = verbOptionsWithHeaders();
    verb.override.requestOptions = false;
    const implementation = generateImplementation(
      verb,
      makeOptions(makeContext()),
    );
    expect(implementation).toContain("'Content-Type': 'application/json'");
    expect(implementation).not.toContain('options?.headers');
    expect(implementation).not.toContain('const getHeaders');
  });

  it('narrows on iterability rather than array-ness', () => {
    const implementation = generateImplementation(
      verbOptionsWithHeaders(),
      makeOptions(makeContext()),
    );

    // `RequestInit['headers']` is declared per runtime. Outside the DOM its
    // non-record member need not be an array — `@cloudflare/workers-types`
    // uses `Iterable<Iterable<string>>` — so `Array.isArray` cannot narrow it
    // and the fall-through `return h` failed the declared return type.
    expect(implementation).toContain('if (Symbol.iterator in h)');
    expect(implementation).not.toContain('if (Array.isArray(h))');
  });

  it('materializes each entry before Object.fromEntries', () => {
    const implementation = generateImplementation(
      verbOptionsWithHeaders(),
      makeOptions(makeContext()),
    );

    // `Object.fromEntries` reads `[0]`/`[1]` off each entry rather than
    // iterating it, so a non-indexable entry — `new Set([new Set(['X-Trace',
    // '1'])])` satisfies the declared `Iterable<Iterable<string>>` — produced
    // a single `undefined` key and lost the real header.
    expect(implementation).toContain(
      'Array.from(h as Iterable<Iterable<string>>, (entry) => Array.from(entry) as [string, string])',
    );
    expect(implementation).not.toContain(
      'Object.fromEntries(h as Iterable<readonly [string, string]>)',
    );
  });

  it('still short-circuits empty input and unwraps a Headers instance', () => {
    const implementation = generateImplementation(
      verbOptionsWithHeaders(),
      makeOptions(makeContext()),
    );

    expect(implementation).toContain('if (!h) return {};');
    expect(implementation).toContain(
      'if (h instanceof Headers) return Object.fromEntries(h.entries());',
    );
  });

  it('builds the record branch entry by entry, skipping undefined values', () => {
    const implementation = generateImplementation(
      verbOptionsWithHeaders(),
      makeOptions(makeContext()),
    );

    // A record whose values include `undefined` — Hono's header record, for
    // one — is not assignable to the declared return type, so the result is
    // built rather than passed through (#4029). Names are copied verbatim, so
    // the override semantics of `{ ...literal, ...getHeaders(...) }` still
    // hold, and an `undefined` value is skipped instead of reaching the wire
    // as the literal text "undefined".
    expect(implementation).toContain(
      'const headers: Record<string, string | readonly string[]> = {};',
    );
    expect(implementation).toContain('if (value !== undefined)');
    expect(implementation).toContain('return headers;');
    expect(implementation).not.toContain('    return h;\n');
  });

  it('does not emit the helper when no headers are added', () => {
    const implementation = generateImplementation(
      makeVerbOptions(),
      makeOptions(makeContext()),
    );

    expect(implementation).not.toContain('const getHeaders');
  });
});

describe('includeHttpErrorResponse', () => {
  function operation(enabled = true) {
    const operation = makeVerbOptions({
      typeName: 'ListPets',
      mutator: {
        name: 'customFetch',
        path: './mutator.ts',
        default: false,
        hasErrorType: true,
        errorTypeName: 'ErrorType',
        hasSecondArg: true,
        hasThirdArg: true,
        isHook: false,
      },
    });
    Object.assign(operation.override.fetch, {
      includeHttpResponseReturnType: true,
      forceSuccessResponse: true,
      includeHttpErrorResponse: enabled,
    });
    operation.response.originalSchema = {
      200: { description: 'Success', content: { 'application/json': {} } },
      404: {
        description: 'Not found',
        content: { 'application/json': {} },
      },
      422: {
        description: 'Invalid',
        content: { 'application/json': {}, 'text/plain': {} },
      },
    };
    operation.response.types = {
      success: [successType({ key: '200', value: 'Pet[]', type: 'array' })],
      errors: [
        successType({ key: '404', value: 'NotFound' }),
        successType({ key: '422', value: 'Invalid' }),
        successType({
          key: '422',
          value: 'string',
          contentType: 'text/plain',
          type: 'string',
        }),
      ],
    };
    return operation;
  }

  it('passes declared statuses and media types separately from request options', () => {
    const result = generateImplementation(
      operation(),
      makeOptions(makeContext()),
    );
    expect(result).toContain(
      JSON.stringify({
        errorResponses: [
          { status: 404, contentType: 'application/json' },
          { status: 422, contentType: 'application/json' },
          { status: 422, contentType: 'text/plain' },
        ],
      }),
    );
    expect(result).toContain('customFetch<ListPetsResponseSuccess>');
  });

  it('respects the configured media type filter', () => {
    const options = operation();
    options.override.contentType = { include: ['application/json'] };
    options.response.types.errors = options.response.types.errors.filter(
      (entry) => entry.contentType === 'application/json',
    );
    const result = generateImplementation(options, makeOptions(makeContext()));
    expect(result).not.toContain('text/plain');
    expect(result).toContain(
      JSON.stringify({
        errorResponses: [
          { status: 404, contentType: 'application/json' },
          { status: 422, contentType: 'application/json' },
        ],
      }),
    );
  });

  it('keeps the existing call when disabled', () => {
    expect(
      generateImplementation(operation(false), makeOptions(makeContext())),
    ).not.toContain('errorResponses');
  });

  it('passes an empty list when no errors are declared', () => {
    const options = operation();
    options.response.types.errors = [];
    expect(
      generateImplementation(options, makeOptions(makeContext())),
    ).toContain(JSON.stringify({ errorResponses: [] }));
  });

  it.each(['default', '4XX'])('rejects unsupported error status %s', (key) => {
    const options = operation();
    // oxlint-disable-next-line typescript/no-non-null-assertion
    options.response.types.errors[0]!.key = key;
    // oxlint-disable-next-line typescript/no-non-null-assertion
    options.response.originalSchema![key] =
      // oxlint-disable-next-line typescript/no-non-null-assertion
      options.response.originalSchema!['404']!;
    expect(() =>
      generateImplementation(options, makeOptions(makeContext())),
    ).toThrow(/includeHttpErrorResponse.*explicit/i);
  });

  it.each(['includeHttpResponseReturnType', 'forceSuccessResponse'] as const)(
    'requires %s',
    (key) => {
      const options = operation();
      options.override.fetch[key] = false;
      expect(() =>
        generateImplementation(options, makeOptions(makeContext())),
      ).toThrow(/includeHttpErrorResponse/);
    },
  );

  it('requires a three-argument non-hook mutator', () => {
    for (const mutator of [
      undefined,
      // oxlint-disable-next-line typescript/no-non-null-assertion
      { ...operation().mutator!, hasThirdArg: false },
      // oxlint-disable-next-line typescript/no-non-null-assertion
      { ...operation().mutator!, isHook: true },
    ]) {
      const options = operation();
      options.mutator = mutator;
      expect(() =>
        generateImplementation(options, makeOptions(makeContext())),
      ).toThrow(/includeHttpErrorResponse/);
    }
  });
});

describe('generateRequestFunction — useDatesTransform', () => {
  const DATED = {
    type: 'object',
    required: ['day'],
    properties: { day: { type: 'string', format: 'date' } },
  } satisfies OpenApiSchemaObject;

  const entry = (
    key: string,
    value: string,
    originalSchema: OpenApiSchemaObject,
  ) =>
    successType({
      key,
      value,
      originalSchema,
      isRef: true,
    });

  function datedVerbOptions({
    successKey = '200',
    errorKeys = [] as string[],
    contentTypes = ['application/json'],
    fetch = {},
    useDatesTransform = true,
  } = {}): GeneratorVerbOptions {
    return makeVerbOptions({
      verb: Verbs.PUT,
      operationName: 'updateAppointment',
      typeName: 'updateAppointment',
      response: {
        definition: {
          success: 'Appointment',
          errors: errorKeys.length ? 'Error' : '',
        },
        types: {
          success: [entry(successKey, 'Appointment', DATED)],
          errors: errorKeys.map((key) =>
            entry(key, 'Error', { type: 'object' }),
          ),
        },
        contentTypes,
      },
      body: {
        definition: 'Appointment',
        implementation: 'appointment',
        contentType: 'application/json',
        isOptional: false,
        originalSchema: { content: { 'application/json': { schema: DATED } } },
      },
      props: [
        {
          name: 'appointment',
          definition: 'appointment: Appointment',
          implementation: 'appointment: Appointment',
          default: undefined,
          required: true,
          type: GetterPropType.BODY,
        },
      ],
      override: {
        useDatesTransform,
        fetch: {
          includeHttpResponseReturnType: true,
          forceSuccessResponse: false,
          runtimeValidation: { enabled: false, strategy: 'throw' },
          ...fetch,
        },
      },
    });
  }

  const generate = (
    verbOptions: GeneratorVerbOptions,
    context = makeContext(),
  ) => generateRequestFunction(verbOptions, makeOptions(context));

  it('serializes the JSON request body', () => {
    expect(generate(datedVerbOptions())).toContain(
      'body: JSON.stringify(serializeUpdateAppointmentRequest(appointment))',
    );
  });

  it('converts the parsed body only for the declared success status', () => {
    const implementation = generate(datedVerbOptions({ errorKeys: ['400'] }));
    expect(implementation).toContain(
      'if (body && (res.status === 200)) {\n    data = deserializeUpdateAppointmentResponse(data as Appointment);\n  }',
    );
  });

  it('assigns the conversion back through a mutable binding', () => {
    // The deserializer both mutates in place and returns the value, and only
    // the return value carries a root-scalar date (`data = new Date(data)`
    // inside the deserializer never escapes it). Discarding the result left
    // such a response a raw string typed `Date`, which still compiled.
    const implementation = generate(datedVerbOptions());
    expect(implementation).toContain(
      "let data: updateAppointmentResponse['data'] = body ? JSON.parse(body) : {}",
    );
    expect(implementation).toContain(
      'data = deserializeUpdateAppointmentResponse(data as Appointment);',
    );
  });

  it('leaves the parsed body a const with the flag off', () => {
    // The mutable binding is emitted only alongside a deserializer, so
    // `useDatesTransform`-off output stays byte-identical.
    const implementation = generate(
      datedVerbOptions({ useDatesTransform: false }),
    );
    expect(implementation).toContain(
      "const data: updateAppointmentResponse['data'] = body ? JSON.parse(body) : {}",
    );
    expect(implementation).not.toContain('let data');
  });

  it('builds the guard from a wildcard success key', () => {
    expect(generate(datedVerbOptions({ successKey: '2XX' }))).toContain(
      'if (body && (res.status >= 200 && res.status < 300)) {',
    );
  });

  it('converts before runtime validation parses the body', () => {
    const context = makeContext([], false, {
      path: './model',
      type: 'zod',
      splitByTags: false,
    });
    const verbOptions = datedVerbOptions({
      fetch: { runtimeValidation: { enabled: true, strategy: 'throw' } },
    });
    verbOptions.response.imports = [
      { name: 'Appointment', schemaName: 'Appointment', values: true },
    ];

    const implementation = generate(verbOptions, context);
    const conversion = implementation.indexOf(
      'parsedBody = deserializeUpdateAppointmentResponse(parsedBody as Appointment)',
    );
    const parse = implementation.indexOf('Appointment.parse(parsedBody)');
    expect(conversion).toBeGreaterThan(-1);
    expect(parse).toBeGreaterThan(conversion);
  });

  it('emits the helpers after the operation', () => {
    const implementation = generate(datedVerbOptions());
    const operation = implementation.indexOf('export const updateAppointment');
    expect(operation).toBeGreaterThan(-1);
    expect(
      implementation.indexOf('const deserializeUpdateAppointmentResponse'),
    ).toBeGreaterThan(operation);
    expect(
      implementation.indexOf('const serializeUpdateAppointmentRequest'),
    ).toBeGreaterThan(operation);
  });

  it('emits nothing for the mcp client', () => {
    const context = makeContext();
    context.output.client = OutputClient.MCP;
    const implementation = generate(datedVerbOptions(), context);
    expect(implementation).not.toContain('serializeUpdateAppointmentRequest');
    expect(implementation).not.toContain(
      'deserializeUpdateAppointmentResponse',
    );
  });

  it('emits no response conversion for an ndjson response', () => {
    const verbOptions = datedVerbOptions({
      contentTypes: ['application/x-ndjson'],
    });
    verbOptions.response.types.success[0].contentType = 'application/x-ndjson';
    expect(generate(verbOptions)).not.toContain(
      'deserializeUpdateAppointmentResponse',
    );
  });

  it('emits no transform and leaves the body untouched with the flag off', () => {
    const implementation = generate(
      datedVerbOptions({ useDatesTransform: false }),
    );
    expect(implementation).not.toContain('serializeUpdateAppointmentRequest');
    expect(implementation).not.toContain(
      'deserializeUpdateAppointmentResponse',
    );
    expect(implementation).toContain('body: JSON.stringify(appointment)');
  });

  const MUTATOR = {
    name: 'customFetch',
    path: './mutator.ts',
    default: false,
    hasErrorType: false,
    errorTypeName: '',
    hasSecondArg: true,
    hasThirdArg: false,
    isHook: false,
  } satisfies NonNullable<GeneratorVerbOptions['mutator']>;

  it('guards a normal mutator response on its status', () => {
    // The conversion is assigned back onto the wrapper for the same
    // root-scalar reason as the built-in path, in the same shape the axios
    // client already emits (`res.data = deserialize…(res.data)`).
    const verbOptions = datedVerbOptions();
    verbOptions.mutator = MUTATOR;
    expect(generate(verbOptions)).toContain(
      '.then((res) => {\n    if (res.status === 200) {\n      res.data = deserializeUpdateAppointmentResponse(res.data as Appointment);\n    }\n    return res;\n  })',
    );
  });

  it('converts a normal mutator response directly without the response wrapper', () => {
    const verbOptions = datedVerbOptions({
      fetch: { includeHttpResponseReturnType: false },
    });
    verbOptions.mutator = MUTATOR;
    expect(generate(verbOptions)).toContain(
      '.then(deserializeUpdateAppointmentResponse)',
    );
  });

  it('casts a hook mutator result once and returns the cast value', () => {
    const verbOptions = datedVerbOptions();
    verbOptions.mutator = { ...MUTATOR, name: 'useCustomFetch', isHook: true };
    expect(generate(verbOptions)).toContain(
      '.then((value) => {\n    const res = value as updateAppointmentResponse;\n    if (res.status === 200) {\n      res.data = deserializeUpdateAppointmentResponse(res.data as Appointment);\n    }\n    return res;\n  })',
    );
  });

  it('casts a hook mutator result once without the response wrapper', () => {
    const verbOptions = datedVerbOptions({
      fetch: { includeHttpResponseReturnType: false },
    });
    verbOptions.mutator = { ...MUTATOR, name: 'useCustomFetch', isHook: true };
    expect(generate(verbOptions)).toContain(
      '.then((value) => deserializeUpdateAppointmentResponse(value as Appointment))',
    );
  });

  it('gives an inferred mutator no response transform but still serializes the body', () => {
    const verbOptions = datedVerbOptions();
    verbOptions.mutator = { ...MUTATOR, inferred: true };
    const implementation = generate(verbOptions);
    expect(implementation).not.toContain('.then(');
    expect(implementation).not.toContain(
      'deserializeUpdateAppointmentResponse',
    );
    expect(implementation).toContain(
      'serializeUpdateAppointmentRequest(appointment)',
    );
  });
});

describe('httpClientInjection: factory', () => {
  const factoryContext = (client: OutputClient = OutputClient.FETCH) =>
    createTestContextSpec({
      output: {
        client,
        override: { fetch: { httpClientInjection: 'factory' } },
      },
    });

  const headerParams = (
    output: ContextSpec['output'],
    clientImplementation = '',
  ) => ({
    title: 'getPetstore',
    isRequestOptions: true,
    isMutator: false,
    isGlobalMutator: false,
    provideIn: false as const,
    hasAwaitedType: true,
    output,
    verbOptions: {},
    clientImplementation,
  });

  it('opens the closure even when no status-code types are needed', () => {
    const output = factoryContext().output;
    output.override.fetch.includeHttpResponseReturnType = false;

    expect(generateFetchHeader(headerParams(output))).toBe(
      'export const getPetstore = (fetchFn: typeof globalThis.fetch = fetch) => {\n',
    );
  });

  it('emits status-code types with the closure for response return types', () => {
    const output = factoryContext().output;
    output.override.fetch.includeHttpResponseReturnType = true;

    const header = generateFetchHeader(headerParams(output));

    expect(typeof header === 'string' ? undefined : header).toEqual({
      implementation:
        'export const getPetstore = (fetchFn: typeof globalThis.fetch = fetch) => {\n',
      sharedTypes: HTTP_STATUS_CODE_SHARED_TYPES,
    });
  });

  it('ignores the factory option for clients that reuse the fetch generators', () => {
    const context = factoryContext(OutputClient.REACT_QUERY);

    expect(generateFetchHeader(headerParams(context.output))).toBe('');
    expect(
      generateFetchFooter({
        operationNames: ['listPets'],
        hasAwaitedType: true,
        hasMutator: false,
        output: context.output,
      }),
    ).toBe('');
    expect(
      generateRequestFunction(makeVerbOptions(), makeOptions(context)),
    ).toContain('export const listPets = async');
  });

  it('declares operations locally and hands response types to the footer', () => {
    const response: GeneratorVerbOptions['response'] = {
      definition: { success: 'Pet', errors: '' },
      imports: [],
      types: {
        success: [successType({ key: '200', value: 'Pet' })],
        errors: [],
      },
      contentTypes: ['application/json'],
      schemas: [],
      isBlob: false,
    };
    const verbOptions = makeVerbOptions({
      response,
      override: { fetch: { includeHttpResponseReturnType: true } },
    });

    const client = generateClient(
      verbOptions,
      makeOptions(factoryContext()),
      OutputClient.FETCH,
    ) as Awaited<ReturnType<typeof generateClient>>;

    expect(client.implementation).toContain('const getListPetsUrl = (');
    expect(client.implementation).toContain('const listPets = async');
    expect(client.implementation).not.toContain('export ');
    expect(client.returnType?.()).toContain('export type listPetsResponse =');
  });

  it('returns hook names and URL helpers, then emits the response types', () => {
    const footer = generateFetchFooter({
      operationNames: ['listPets', 'createPets'],
      operations: [
        {
          operationName: 'listPets',
          types: { result: () => 'export type listPetsResponse = unknown;' },
        },
        {
          operationName: 'createPets',
          mutator: { isHook: true },
        },
      ] as GeneratorOperation[],
      hasAwaitedType: true,
      hasMutator: true,
      output: factoryContext().output,
    });

    expect(footer).toBe(
      'return { listPets, getListPetsUrl, useCreatePetsHook, getCreatePetsUrl };\n};\n' +
        '\nexport type listPetsResponse = unknown;\n',
    );
  });
});

describe('shared runtime behaviour', () => {
  type QueryMeta = Record<string, string[]>;
  type ExecuteArgs = {
    url: string;
    method: string;
    body?: unknown;
    contentType?: string;
    headers?: NonNullable<RequestInit['headers']>;
    responseType?: 'void' | 'text' | 'auto' | 'blob' | 'stream';
    encodeBody?: (body: never) => NonNullable<RequestInit['body']>;
    options?: RequestInit & { fetch?: typeof fetch };
  };
  type Runtime = {
    execute: <R>(
      args: ExecuteArgs,
      config?: { mutator?: (url: string, init: RequestInit) => Promise<R> },
    ) => Promise<R>;
    serializeQuery: (
      params: Record<string, unknown> | undefined,
      meta?: QueryMeta,
    ) => string;
  };
  type Envelope = { data: unknown; status: number; headers: Headers };

  let dir: string;
  let runtime: Runtime;

  const importModule = async <T>(name: string, source: string) => {
    const file = path.join(dir, `${name}.ts`);
    await writeFile(file, source);
    return (await import(pathToFileURL(file).href)) as T;
  };

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'orval-fetch-runtime-'));
    runtime = await importModule<Runtime>('runtime', RUNTIME_TEMPLATE);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const respond = (
    body: NonNullable<RequestInit['body']> | null,
    init: ResponseInit = {},
  ): typeof fetch & { mock: ReturnType<typeof vi.fn>['mock'] } =>
    vi.fn(async () => new Response(body, init)) as never;

  const call = (
    fetchFn: typeof fetch,
    args: Partial<ExecuteArgs> = {},
  ): Promise<Envelope> =>
    runtime.execute<Envelope>({
      url: '/pets',
      method: 'GET',
      ...args,
      options: { ...args.options, fetch: fetchFn },
    });

  const sentInit = (fetchFn: { mock: { calls: unknown[][] } }) =>
    fetchFn.mock.calls[0][1] as RequestInit & {
      headers: Record<string, string>;
    };

  it('returns { data, status, headers } with the parsed JSON body', async () => {
    const fetchFn = respond('{"id":1}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const res = await call(fetchFn);

    expect(res.data).toEqual({ id: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(fetchFn).toHaveBeenCalledWith('/pets', {
      method: 'GET',
      headers: {},
    });
  });

  it.each([
    ['json', undefined, {}],
    ['void', 'void', undefined],
    ['text', 'text', ''],
    ['blob', 'blob', null],
  ] as const)(
    'yields the inline fallback for an empty %s response',
    async (_, responseType, expected) => {
      for (const status of [204, 205, 304]) {
        const res = await call(respond(null, { status }), { responseType });
        expect(res.data).toStrictEqual(expected);
        expect(res.status).toBe(status);
      }
    },
  );

  it('decodes text, auto and blob responses', async () => {
    const text = await call(respond('hello', { status: 200 }), {
      responseType: 'text',
    });
    expect(text.data).toBe('hello');

    const autoJson = await call(
      respond('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
      { responseType: 'auto' },
    );
    expect(autoJson.data).toEqual({ ok: true });

    const autoText = await call(
      respond('plain', {
        status: 429,
        headers: { 'content-type': 'text/plain' },
      }),
      { responseType: 'auto' },
    );
    expect(autoText.data).toBe('plain');

    const blob = await call(respond('bytes', { status: 200 }), {
      responseType: 'blob',
    });
    expect(blob.data).toBeInstanceOf(Blob);
  });

  it('parses a void response body by content type', async () => {
    const res = await call(
      respond('{"message":"nope"}', {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
      { responseType: 'void' },
    );

    expect(res.data).toEqual({ message: 'nope' });
  });

  it('hands back the undecoded Response for a stream', async () => {
    const res = await runtime.execute<{
      status: number;
      stream: Response;
      headers: Headers;
    }>({
      url: '/events',
      method: 'GET',
      responseType: 'stream',
      options: { fetch: respond('{"a":1}\n', { status: 200 }) },
    });

    expect(res.status).toBe(200);
    expect(res.stream).toBeInstanceOf(Response);
    expect(await res.stream.text()).toBe('{"a":1}\n');
  });

  it('encodes the body from its media type', async () => {
    const json = respond(null, { status: 201 });
    await call(json, { method: 'POST', body: { name: 'x' } });
    expect(sentInit(json)).toEqual({
      method: 'POST',
      headers: {},
      body: '{"name":"x"}',
    });

    const vendor = respond(null, { status: 201 });
    await call(vendor, {
      method: 'POST',
      body: { name: 'x' },
      contentType: 'application/vnd.api+json',
    });
    expect(sentInit(vendor).headers).toEqual({
      'Content-Type': 'application/vnd.api+json',
    });
    expect(sentInit(vendor).body).toBe('{"name":"x"}');

    const text = respond(null, { status: 201 });
    await call(text, {
      method: 'POST',
      body: 'raw',
      contentType: 'text/plain',
    });
    expect(sentInit(text).headers).toEqual({ 'Content-Type': 'text/plain' });
    expect(sentInit(text).body).toBe('raw');

    const form = respond(null, { status: 201 });
    const encodeBody = vi.fn((body: { file: string }) => {
      const formData = new FormData();
      formData.append('file', body.file);
      return formData;
    });
    await call(form, {
      method: 'POST',
      body: { file: 'f' },
      contentType: 'multipart/form-data',
      encodeBody: encodeBody as never,
    });
    expect(encodeBody).toHaveBeenCalledWith({ file: 'f' });
    expect(sentInit(form).headers).toEqual({});
    expect(sentInit(form).body).toBeInstanceOf(FormData);

    const urlEncoded = respond(null, { status: 201 });
    await call(urlEncoded, {
      method: 'POST',
      body: { a: '1' },
      contentType: 'application/x-www-form-urlencoded',
      encodeBody: ((body: { a: string }) => new URLSearchParams(body)) as never,
    });
    expect(sentInit(urlEncoded).headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(sentInit(urlEncoded).body).toBeInstanceOf(URLSearchParams);
  });

  it('merges Content-Type, spec headers and per-call headers in that order', async () => {
    const fetchFn = respond(null, { status: 200 });

    await call(fetchFn, {
      method: 'POST',
      body: {},
      contentType: 'application/json',
      headers: {
        'X-Spec': 'spec',
        'X-Dropped': undefined,
        'X-Both': 'spec',
      } as never,
      options: {
        credentials: 'include',
        headers: new Headers({ 'X-Both': 'call', 'X-Call': 'call' }),
      },
    });

    expect(sentInit(fetchFn)).toEqual({
      credentials: 'include',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Spec': 'spec',
        'x-both': 'call',
        'X-Both': 'spec',
        'x-call': 'call',
      },
      body: '{}',
    });

    const iterable = respond(null, { status: 200 });
    await call(iterable, {
      options: { headers: new Set([new Set(['X-Trace', '1'])]) as never },
    });
    expect(sentInit(iterable).headers).toEqual({ 'X-Trace': '1' });
  });

  it('delegates the whole pipeline to a mutator', async () => {
    const fetchFn = respond('{"id":1}', { status: 200 });
    const mutator = vi.fn(async () => 'from-mutator');

    const res = await runtime.execute<string>(
      {
        url: '/pets/1',
        method: 'PUT',
        body: { id: 1 },
        contentType: 'application/json',
        options: { fetch: fetchFn, credentials: 'include' },
      },
      { mutator },
    );

    expect(res).toBe('from-mutator');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(mutator).toHaveBeenCalledWith('/pets/1', {
      credentials: 'include',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"id":1}',
    });
  });

  it('resolves globalThis.fetch at call time', async () => {
    const original = globalThis.fetch;
    const patched = respond('[]', { status: 200 });
    globalThis.fetch = patched;
    try {
      const res = await runtime.execute<Envelope>({
        url: '/pets',
        method: 'GET',
      });
      expect(res.data).toEqual([]);
      expect(patched).toHaveBeenCalledWith('/pets', {
        method: 'GET',
        headers: {},
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  describe('serializeQuery parity with the inline URL builder', () => {
    const arrayParam = (name: string, explode?: boolean) => ({
      name,
      in: 'query',
      ...(explode === undefined ? {} : { explode }),
      schema: { type: 'array', items: { type: 'string' } },
    });
    const fixtures: {
      title: string;
      parameters: TestParameter[];
      arrayFormat?: 'repeat' | 'brackets' | 'comma';
      useDates?: boolean;
      meta: QueryMeta;
      params: Record<string, unknown>;
    }[] = [
      {
        title: 'exploded array with scalars',
        parameters: [
          arrayParam('tags'),
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        meta: { explode: ['tags'] },
        params: { tags: ['a', null, 'b c'], limit: 5, skip: undefined },
      },
      {
        title: 'explode: false array',
        parameters: [arrayParam('tags', false)],
        meta: {},
        params: { tags: ['a', 'b'], other: null },
      },
      {
        title: 'arrayFormat repeat',
        parameters: [arrayParam('ids'), arrayParam('tags', true)],
        arrayFormat: 'repeat',
        meta: { explode: ['tags'], repeat: ['ids'] },
        params: { ids: ['1', '2'], tags: ['x'] },
      },
      {
        title: 'arrayFormat brackets',
        parameters: [arrayParam('ids')],
        arrayFormat: 'brackets',
        meta: { brackets: ['ids'] },
        params: { ids: ['1', null] },
      },
      {
        title: 'arrayFormat comma',
        parameters: [arrayParam('ids')],
        arrayFormat: 'comma',
        meta: { comma: ['ids'] },
        params: { ids: ['1', '2'] },
      },
      {
        title: 'deepObject with dates',
        parameters: [
          {
            name: 'scope',
            in: 'query',
            style: 'deepObject',
            explode: true,
            schema: {
              type: 'object',
              properties: {
                since: { type: 'string', format: 'date-time' },
                id: { type: 'string' },
              },
            },
          },
          { name: 'q', in: 'query', schema: { type: 'string' } },
        ],
        useDates: true,
        meta: { deepObject: ['scope'] },
        params: {
          scope: {
            since: new Date('2024-01-02T03:04:05.000Z'),
            id: 'a b',
            n: null,
            u: undefined,
          },
          q: 'x&y',
        },
      },
      {
        title: 'exploded date array',
        parameters: [
          {
            name: 'at',
            in: 'query',
            // The inline emitter reads `format` off the array schema itself.
            schema: {
              type: 'array',
              format: 'date-time',
              items: { type: 'string', format: 'date-time' },
            },
          },
        ],
        useDates: true,
        meta: { explode: ['at'] },
        params: { at: [new Date('2024-01-02T03:04:05.000Z')] },
      },
      {
        title: 'no params',
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
        meta: {},
        params: {},
      },
    ];

    it.each(fixtures)(
      '$title',
      async ({ title, parameters, arrayFormat, useDates, meta, params }) => {
        const verbOptions = makeVerbOptions({
          queryParams: STUB_QUERY_PARAMS,
          props: [
            {
              name: 'params',
              definition: 'params: ListPetsParams',
              implementation: 'params: ListPetsParams',
              default: undefined,
              required: true,
              type: GetterPropType.QUERY_PARAM,
            },
          ],
          override: {
            requestOptions: false,
            formUrlEncoded: false,
            fetch: {
              includeHttpResponseReturnType: false,
              forceSuccessResponse: false,
              runtimeValidation: { enabled: false, strategy: 'throw' },
              ...(arrayFormat ? { arrayFormat } : {}),
            },
          },
        });
        const implementation = generateImplementation(
          verbOptions,
          makeOptions(makeContext(parameters, useDates)),
        );
        const builder = implementation.slice(
          implementation.indexOf('export const getListPetsUrl'),
          implementation.indexOf('export const listPets'),
        );
        const inline = await importModule<{
          getListPetsUrl: (params: Record<string, unknown>) => string;
        }>(
          `inline-${title.replaceAll(/\W+/g, '-')}`,
          `type ListPetsParams = Record<string, unknown>;\n${builder}`,
        );

        const query = runtime.serializeQuery(params, meta);
        const shared = query.length > 0 ? `/pets?${query}` : '/pets';

        expect(shared).toBe(inline.getListPetsUrl(params));
      },
    );
  });
});
