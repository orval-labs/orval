import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiParameterObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResReqTypesValue,
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
import { generateRequestFunction } from './index';

type OpenApiParameterLike = OpenApiParameterObject | OpenApiReferenceObject;

type TestParameter = {
  name: string;
  in: string;
  style?: string;
  explode?: boolean;
  schema?: Record<string, unknown>;
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
    options.response.types.errors[0]!.key = key;
    options.response.originalSchema![key] =
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
      { ...operation().mutator!, hasThirdArg: false },
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
