import { runInNewContext } from 'node:vm';

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
  generateMutatorImports,
  GetterPropType,
  OutputClient,
  PropertySortOrder,
  Verbs,
} from '@orval/core';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestContextSpec,
  createTestGeneratorOptions,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
import {
  generateFetchFooter,
  generateFetchHeader,
  generateRequestFunction,
} from './index';
import { clientConfigTemplate, RUNTIME_TEMPLATE } from './runtime';
import {
  generateFetchExtraFiles,
  generateSharedClient,
  generateSharedRequestFunction,
  normalizeSharedRuntimeVerbOptions,
} from './shared-runtime-style';
import { typeCheckFiles } from './test-utils';

type SerializeQuery = (
  params: Record<string, unknown>,
  meta: Record<string, string[]>,
) => string;

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
        includeHttpResponseReturnType: true,
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
    model: 'type ListPetsParams = { limit?: string }',
    imports: [],
  },
  deps: [],
  isOptional: true,
} satisfies NonNullable<GeneratorVerbOptions['queryParams']>;

function makeSharedOptions(
  parameters: TestParameter[] = [],
  {
    client = OutputClient.FETCH,
    useDates = false,
    mutator,
    zodSchemaInArguments = false,
  }: {
    client?: OutputClient;
    useDates?: boolean;
    mutator?: boolean;
    zodSchemaInArguments?: boolean;
  } = {},
): GeneratorOptions {
  const options = makeOptions(
    makeContext(
      parameters,
      useDates,
      zodSchemaInArguments
        ? { path: './model', type: 'zod', splitByTags: false }
        : undefined,
    ),
  );
  options.context.output.override.includeZodSchemaInArguments =
    zodSchemaInArguments;
  options.context.output.target = '/proj/src/api/endpoints.ts';
  options.context.output.client = client;
  Object.assign(options.context.output.override.fetch, {
    runtimeImplementationStyle: 'shared',
    runtimeOutputPath: '/proj/src/runtime.ts',
    clientConfigOutputPath: '/proj/src/api/client-config.ts',
  });
  if (mutator) {
    options.context.output.override.mutator = {
      path: '/proj/src/custom-fetch.ts',
      name: 'customFetch',
      default: false,
    };
  }
  return options;
}

describe('generateFetchExtraFiles', () => {
  const extraFiles = ({
    style = 'shared',
    mutator,
    hook = false,
    operationInferred,
  }: {
    style?: 'inline' | 'shared';
    mutator?: { name: string; default: boolean };
    hook?: boolean;
    operationInferred?: boolean[];
  } = {}) => {
    const context = makeContext();
    context.output.target = '/proj/src/api/endpoints.ts';
    Object.assign(context.output.override.fetch, {
      runtimeImplementationStyle: style,
      runtimeOutputPath: '/proj/src/runtime.ts',
      clientConfigOutputPath: '/proj/src/api/config/client.ts',
    });
    if (mutator) {
      context.output.override.mutator = {
        path: '/proj/src/custom-fetch.ts',
        ...mutator,
      };
    }
    const verbMutator = mutator && {
      name: hook ? `use${mutator.name}` : mutator.name,
      path: '../custom-fetch',
      default: mutator.default,
      hasErrorType: false,
      errorTypeName: 'ErrorType',
      hasSecondArg: true,
      hasThirdArg: false,
      isHook: hook,
    };
    return generateFetchExtraFiles(
      operationInferred
        ? Object.fromEntries(
            operationInferred.map((inferred, index) => [
              `operation${index}`,
              makeVerbOptions({
                mutator: verbMutator && { ...verbMutator, inferred },
              }),
            ]),
          )
        : { listPets: makeVerbOptions({ mutator: verbMutator }) },
      context.output,
      context,
    );
  };

  it('emits nothing for the inline style', async () => {
    expect(await extraFiles({ style: 'inline' })).toEqual([]);
  });

  it('emits the versioned runtime at runtimeOutputPath', async () => {
    const files = await extraFiles();

    expect(files.map((file) => file.path)).toEqual(['/proj/src/runtime.ts']);
    expect(files[0].content.split('\n')[0]).toMatch(
      /^\/\/ Generated by orval v\d+\.\d+\.\d+/,
    );
    expect(files[0].content).toContain(RUNTIME_TEMPLATE);
  });

  it('wires a global mutator through the client config', async () => {
    const files = await extraFiles({
      mutator: { name: 'customFetch', default: false },
    });

    expect(files.map((file) => file.path)).toEqual([
      '/proj/src/runtime.ts',
      '/proj/src/api/config/client.ts',
    ]);
    expect(files[1].content).toBe(`import * as runtime from '../../runtime';
import type { ExecuteArgs } from '../../runtime';
import { customFetch } from '../../custom-fetch';

const config = { mutator: customFetch };

export const execute = <R>(args: ExecuteArgs) =>
  runtime.execute<R>(args, config);
`);
  });

  it('imports a default-export mutator as such', async () => {
    const files = await extraFiles({
      mutator: { name: 'customFetch', default: true },
    });

    expect(files[1].content).toContain(
      "import customFetch from '../../custom-fetch';",
    );
  });

  it('skips the client config for a hook mutator', async () => {
    const files = await extraFiles({
      mutator: { name: 'CustomFetch', default: false },
      hook: true,
    });

    expect(files.map((file) => file.path)).toEqual(['/proj/src/runtime.ts']);
  });

  it.each([
    [false, true],
    [true, false],
  ])(
    'rejects mixed inferred mutators in either operation order: %s, %s',
    async (first, second) => {
      await expect(async () =>
        extraFiles({
          mutator: { name: 'customFetch', default: false },
          operationInferred: [first, second],
        }),
      ).rejects.toThrow(/shared.*inferred|inferred.*shared/i);
    },
  );
});

describe('generateSharedRequestFunction', () => {
  const params = [
    {
      name: 'params',
      definition: 'params: ListPetsParams',
      implementation: 'params: ListPetsParams',
      default: undefined,
      required: true,
      type: GetterPropType.QUERY_PARAM,
    },
  ];
  const mutator = (isHook = false) => ({
    name: isHook ? 'useCustomFetch' : 'customFetch',
    path: '../custom-fetch',
    default: false,
    hasErrorType: false,
    errorTypeName: 'ErrorType',
    hasSecondArg: true,
    hasThirdArg: false,
    isHook,
  });

  it('delegates query serialization to the runtime with the resolved meta', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        queryParams: STUB_QUERY_PARAMS,
        props: params,
        override: {
          requestOptions: false,
          formUrlEncoded: false,
          fetch: {
            includeHttpResponseReturnType: true,
            forceSuccessResponse: false,
            runtimeValidation: { enabled: false, strategy: 'throw' },
            arrayFormat: 'brackets',
          },
        },
      }),
      makeSharedOptions([
        {
          name: 'tags',
          in: 'query',
          schema: { type: 'array', items: { type: 'string' } },
        },
        {
          name: 'ids',
          in: 'query',
          schema: { type: 'array', items: { type: 'string' } },
        },
        {
          name: 'scope',
          in: 'query',
          style: 'deepObject',
          explode: true,
          schema: { type: 'object', properties: { id: { type: 'string' } } },
        },
      ]),
    );

    expect(implementation).toContain(
      'const stringifiedParams = serializeQuery(params, { brackets: ["tags","ids"], deepObject: ["scope"] });',
    );
    expect(implementation).toContain(
      'return stringifiedParams.length > 0 ? `/pets?${stringifiedParams}` : `/pets`',
    );
    expect(implementation).not.toContain('URLSearchParams');
  });

  it('passes delimited params to the runtime instead of arrayFormat', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        queryParams: STUB_QUERY_PARAMS,
        props: params,
        override: {
          requestOptions: false,
          formUrlEncoded: false,
          fetch: {
            includeHttpResponseReturnType: true,
            forceSuccessResponse: false,
            runtimeValidation: { enabled: false, strategy: 'throw' },
            arrayFormat: 'repeat',
          },
        },
      }),
      makeSharedOptions([
        {
          name: 'tags',
          in: 'query',
          style: 'pipeDelimited',
          schema: { type: 'array', items: { type: 'string' } },
        },
        {
          name: 'names',
          in: 'query',
          style: 'spaceDelimited',
          explode: false,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ]),
    );

    expect(implementation).toContain(
      'const stringifiedParams = serializeQuery(params, { pipeDelimited: ["tags"], spaceDelimited: ["names"] });',
    );
  });

  it('joins delimited arrays with percent-encoded separators at runtime', () => {
    const { outputText } = ts.transpileModule(RUNTIME_TEMPLATE, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    });
    const exports: { serializeQuery?: SerializeQuery } = {};
    runInNewContext(outputText, { exports, URLSearchParams, Date });

    expect(
      exports.serializeQuery?.(
        { tags: ['a', 'b'], names: ['x y', 'z'], limit: 1 },
        { pipeDelimited: ['tags'], spaceDelimited: ['names'] },
      ),
    ).toBe('limit=1&tags=a%7Cb&names=x%20y%20z');
  });

  it('passes form-style object params to the runtime', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        queryParams: {
          ...STUB_QUERY_PARAMS,
          objectQueryParams: [
            { key: 'page', strategy: 'flatten' },
            { key: 'range', strategy: 'comma' },
          ],
        },
        props: params,
      }),
      makeSharedOptions([
        { name: 'page', in: 'query', schema: { type: 'object' } },
        {
          name: 'range',
          in: 'query',
          explode: false,
          schema: { type: 'object' },
        },
      ]),
    );

    expect(implementation).toContain(
      'const stringifiedParams = serializeQuery(params, { flattenObject: ["page"], commaObject: ["range"] });',
    );
  });

  it('serializes form-style object params like the inline builder at runtime', () => {
    const { outputText } = ts.transpileModule(RUNTIME_TEMPLATE, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    });
    const exports: { serializeQuery?: SerializeQuery } = {};
    runInNewContext(outputText, { exports, URLSearchParams, Date });
    const meta = { flattenObject: ['page'], commaObject: ['range', 'empty'] };

    expect(
      exports.serializeQuery?.(
        {
          page: { number: 2, tags: ['a', 'b'], cursor: undefined },
          range: { since: new Date(Date.UTC(2026, 0, 2)), limit: null },
          empty: { cursor: undefined },
        },
        meta,
      ),
    ).toBe(
      `number=2&tags=a&tags=b&range=${encodeURIComponent('since,2026-01-02T00:00:00.000Z,limit,null')}`,
    );
  });

  it('serializes an encoded copy of formatType query values', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        queryParams: {
          ...STUB_QUERY_PARAMS,
          formatTypeEncoding: {
            statements: ['encodedParams.after = toIso(encodedParams.after);'],
          },
        },
        props: params,
      }),
      makeSharedOptions([
        { name: 'after', in: 'query', schema: { type: 'string' } },
      ]),
    );

    expect(implementation).toContain(
      [
        'const encodedParams = { ...params };',
        'encodedParams.after = toIso(encodedParams.after);',
        'const stringifiedParams = serializeQuery(encodedParams);',
      ].join('\n'),
    );
  });

  it('omits the meta when no query param needs special serialization', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({ queryParams: STUB_QUERY_PARAMS, props: params }),
      makeSharedOptions([
        { name: 'limit', in: 'query', schema: { type: 'string' } },
      ]),
    );

    expect(implementation).toContain(
      'const stringifiedParams = serializeQuery(params);',
    );
  });

  it('keeps a path-only URL builder identical to the inline one', () => {
    const verbOptions = makeVerbOptions();
    const builder = (implementation: string) => {
      const start = implementation.indexOf('export const getListPetsUrl');
      return implementation.slice(
        start,
        implementation.indexOf('\n}\n', start) + 3,
      );
    };

    const inline = builder(
      generateRequestFunction(verbOptions, makeOptions(makeContext())),
    );
    const shared = builder(
      generateSharedRequestFunction(verbOptions, makeSharedOptions()),
    );

    expect(shared).toBe(inline);
    expect(shared).toContain('return `/pets`');
  });

  it('derives the response union from the status map', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        response: {
          definition: { success: 'Pet', errors: 'Error' },
          contentTypes: ['application/json', 'text/plain'],
          types: {
            success: [
              successType({ key: '200', value: 'Pet' }),
              successType({
                key: '200',
                value: 'string',
                contentType: 'text/plain',
              }),
              successType({ key: '2XX', value: 'Pet' }),
            ],
            errors: [
              successType({ key: '404', value: 'NotFound' }),
              successType({ key: 'default', value: 'Error' }),
            ],
          },
        },
      }),
      makeSharedOptions(),
    );

    expect(implementation).toContain(
      "export type listPetsResponse = ResponseOf<{ 200: Pet | string; '2XX': Pet; 404: NotFound; default: Error }>;",
    );
    expect(implementation).not.toContain('listPetsResponse200');
    expect(implementation).toContain("responseType: 'auto'");
  });

  it('marks a streamed response and sends its Accept header', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        response: {
          definition: { success: 'StreamEntry', errors: '' },
          contentTypes: ['application/x-ndjson'],
          types: {
            success: [
              successType({
                key: '200',
                value: 'StreamEntry',
                contentType: 'application/x-ndjson',
              }),
            ],
          },
        },
      }),
      makeSharedOptions(),
    );

    expect(implementation).toContain(
      'export type listPetsResponse = ResponseOf<{ 200: Stream<StreamEntry> }>;',
    );
    expect(implementation).toContain("accept: 'application/x-ndjson'");
    expect(implementation).toContain("responseType: 'stream'");
  });

  it.each([
    [
      'void',
      { success: 'void', contentTypes: [] as string[] },
      "responseType: 'void'",
    ],
    [
      'text',
      { success: 'string', contentTypes: ['text/plain'] },
      "responseType: 'text'",
    ],
    ['json', { success: 'Pet', contentTypes: ['application/json'] }, undefined],
  ])('picks the %s decoding', (_, { success, contentTypes }, expected) => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        response: {
          definition: { success, errors: '' },
          contentTypes,
          types: {
            success: [
              successType({
                key: '200',
                value: success,
                contentType: contentTypes[0] ?? '',
              }),
            ],
          },
        },
      }),
      makeSharedOptions(),
    );

    if (expected) {
      expect(implementation).toContain(expected);
    } else {
      expect(implementation).not.toContain('responseType');
    }
  });

  it('passes the typed body with its media type', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        verb: Verbs.POST,
        body: {
          definition: 'CreatePetsBody',
          implementation: 'createPetsBody',
          contentType: 'application/vnd.api+json',
        },
        props: [
          {
            name: 'createPetsBody',
            definition: 'createPetsBody: CreatePetsBody',
            implementation: 'createPetsBody: CreatePetsBody',
            default: undefined,
            required: true,
            type: GetterPropType.BODY,
          },
        ],
      }),
      makeSharedOptions(),
    );

    expect(implementation).toContain(
      'export const listPets = (createPetsBody: CreatePetsBody, options?: CallOptions) =>',
    );
    expect(implementation).toContain("method: 'POST'");
    expect(implementation).toContain('body: createPetsBody');
    expect(implementation).toContain("contentType: 'application/vnd.api+json'");
    expect(implementation).not.toContain('JSON.stringify');
  });

  it('escapes single quotes in the request body media type key', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        verb: Verbs.POST,
        body: {
          definition: 'Pet',
          implementation: 'pet',
          contentType: "application/json', 'X-Evil': 'injected",
        },
      }),
      makeSharedOptions(),
    );

    expect(implementation).toContain(
      String.raw`contentType: 'application/json\', \'X-Evil\': \'injected'`,
    );
    expect(implementation).not.toContain("'X-Evil': 'injected'");
  });

  it('wraps the generated FormData builder as the body encoder', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        verb: Verbs.POST,
        body: {
          definition: 'Pet',
          implementation: 'pet',
          contentType: 'multipart/form-data',
          formData:
            "const formData = new FormData();\nformData.append('name', pet.name);",
        },
        override: { formData: { disabled: false, arrayHandling: 'serialize' } },
      }),
      makeSharedOptions(),
    );

    expect(implementation).toContain(
      'const listPetsEncodeBody = (pet: Pet) => {',
    );
    expect(implementation).toContain("formData.append('name', pet.name);");
    expect(implementation).toContain('return formData;');
    expect(implementation).toContain("contentType: 'multipart/form-data'");
    expect(implementation).toContain('encodeBody: listPetsEncodeBody');
  });

  // The shared runtime skips the Content-Type header only for the exact
  // `multipart/form-data` string, and only the browser knows the boundary.
  // A mixed-case declaration has to reach it in that spelling (#4369).
  it('passes a mixed-case multipart media type in the spelling the runtime skips', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        verb: Verbs.POST,
        body: {
          definition: 'Pet',
          implementation: 'pet',
          contentType: 'Multipart/Form-Data',
          formData:
            "const formData = new FormData();\nformData.append('name', pet.name);",
        },
        override: { formData: { disabled: false, arrayHandling: 'serialize' } },
      }),
      makeSharedOptions(),
    );

    expect(implementation).toContain("contentType: 'multipart/form-data'");
    expect(implementation).toContain('encodeBody: listPetsEncodeBody');
  });

  it('streams an uppercase ndjson response', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        response: {
          definition: { success: 'StreamEntry', errors: '' },
          contentTypes: ['Application/X-NDJSON'],
          types: {
            success: [
              successType({
                key: '200',
                value: 'StreamEntry',
                contentType: 'Application/X-NDJSON',
              }),
            ],
          },
        },
      }),
      makeSharedOptions(),
    );

    expect(implementation).toContain("accept: 'Application/X-NDJSON'");
    expect(implementation).toContain("responseType: 'stream'");
  });

  it('forwards spec header parameters', () => {
    const implementation = generateSharedRequestFunction(
      makeVerbOptions({
        headers: {
          schema: { name: 'ListPetsHeaders', model: '', imports: [] },
          deps: [],
          isOptional: false,
        },
      }),
      makeSharedOptions(),
    );

    expect(implementation).toContain('    headers,\n');
  });

  it('imports the runtime relative to the target file, split by value and type', () => {
    const { imports, implementation } = generateSharedClient(
      makeVerbOptions({ queryParams: STUB_QUERY_PARAMS, props: params }),
      makeSharedOptions(),
    );

    expect(imports).toEqual(
      expect.arrayContaining([
        { name: 'execute', values: true, importPath: '../runtime' },
        { name: 'serializeQuery', values: true, importPath: '../runtime' },
        { name: 'CallOptions', importPath: '../runtime' },
        { name: 'ResponseOf', importPath: '../runtime' },
      ]),
    );
    expect(implementation).not.toContain('HTTPStatusCodes');
  });

  it('routes execute through the client config when a global mutator is set', () => {
    const { imports, implementation } = generateSharedClient(
      makeVerbOptions({ mutator: mutator() }),
      makeSharedOptions([], { mutator: true }),
    );

    expect(imports).toEqual(
      expect.arrayContaining([
        { name: 'execute', values: true, importPath: './client-config' },
        { name: 'CallOptions', importPath: '../runtime' },
      ]),
    );
    expect(implementation).not.toContain('customFetch');
  });

  it('ignores a hook mutator', () => {
    const { imports } = generateSharedClient(
      makeVerbOptions({ mutator: mutator(true) }),
      makeSharedOptions([], { mutator: true }),
    );

    expect(imports).toEqual(
      expect.arrayContaining([
        { name: 'execute', values: true, importPath: '../runtime' },
      ]),
    );
  });

  describe('hands the zod schema to the client-config mutator (#4344)', () => {
    const validatedResponse = (
      success: string,
      imports: GeneratorVerbOptions['response']['imports'],
    ): GeneratorVerbOptions['response'] => ({
      definition: { success, errors: '' },
      imports,
      types: {
        success: [successType({ key: '200', value: success, isRef: true })],
        errors: [],
      },
      contentTypes: ['application/json'],
      schemas: [],
      isBlob: false,
    });
    const validatedVerbOptions = (
      response = validatedResponse('Pet', [{ name: 'Pet' }]),
      withMutator = true,
    ) =>
      makeVerbOptions({
        response,
        ...(withMutator ? { mutator: mutator() } : {}),
        override: {
          fetch: {
            includeHttpResponseReturnType: true,
            forceSuccessResponse: false,
            runtimeValidation: { enabled: true, strategy: 'throw' },
          },
        },
      });

    it('passes a named schema as a value import', () => {
      const { imports, implementation } = generateSharedClient(
        validatedVerbOptions(),
        makeSharedOptions([], { mutator: true, zodSchemaInArguments: true }),
      );

      expect(implementation).toContain('schema: Pet,');
      expect(imports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Pet', values: true }),
        ]),
      );
      expect(imports).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'PetOutput' }),
        ]),
      );
    });

    it('composes an inline array schema with the zod namespace', () => {
      const { imports, implementation } = generateSharedClient(
        validatedVerbOptions(validatedResponse('Pet[]', [{ name: 'Pet' }])),
        makeSharedOptions([], { mutator: true, zodSchemaInArguments: true }),
      );

      expect(implementation).toContain('schema: zod.array(Pet),');
      expect(imports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Pet', values: true }),
          expect.objectContaining({ name: 'zod', namespaceImport: true }),
        ]),
      );
    });

    it('passes no schema without includeZodSchemaInArguments', () => {
      const { imports, implementation } = generateSharedClient(
        validatedVerbOptions(),
        makeSharedOptions([], { mutator: true }),
      );

      expect(implementation).not.toContain('schema:');
      expect(implementation).not.toContain('validateResponse:');
      expect(imports).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Pet', values: true }),
        ]),
      );
    });
  });
});

describe('shared runtime options', () => {
  const response: GeneratorVerbOptions['response'] = {
    definition: { success: 'Pet', errors: 'Problem' },
    imports: [{ name: 'Pet' }, { name: 'Problem' }],
    types: {
      success: [successType({ key: '200', value: 'Pet', isRef: true })],
      errors: [successType({ key: '404', value: 'Problem', isRef: true })],
    },
    contentTypes: ['application/json'],
    schemas: [],
    isBlob: false,
  };
  const verbOptions = (
    fetch: Partial<GeneratorVerbOptions['override']['fetch']> = {},
    overrides: Parameters<typeof makeVerbOptions>[0] = {},
  ) =>
    makeVerbOptions({
      response,
      ...overrides,
      override: {
        fetch: {
          includeHttpResponseReturnType: true,
          forceSuccessResponse: false,
          serializeResponseHeaders: false,
          runtimeValidation: { enabled: false, strategy: 'throw' },
          ...fetch,
        },
      },
    });

  it('narrows to the success responses and throws on the rest', () => {
    const { imports, implementation } = generateSharedClient(
      verbOptions({ forceSuccessResponse: true }),
      makeSharedOptions(),
    );

    expect(implementation).toContain(
      'export type listPetsResponseSuccess = ResponseOf<{ 200: Pet; 404: Problem }, Headers, 200>;',
    );
    expect(implementation).toContain('execute<listPetsResponseSuccess>');
    expect(implementation).toContain('throwOnError: true');
    expect(imports).toEqual(
      expect.arrayContaining([
        { name: 'ResponseOf', importPath: '../runtime' },
      ]),
    );
  });

  it('returns the bare data without the response envelope', () => {
    const { imports, implementation } = generateSharedClient(
      verbOptions({ includeHttpResponseReturnType: false }),
      makeSharedOptions(),
    );

    expect(implementation).not.toContain('export type');
    expect(implementation).toContain('execute<Pet>');
    expect(implementation).toContain('returnData: true');
    expect(imports).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'ResponseOf' })]),
    );
  });

  it('types and serializes the headers as a plain record', () => {
    const implementation = generateSharedRequestFunction(
      verbOptions({ serializeResponseHeaders: true }),
      makeSharedOptions(),
    );

    expect(implementation).toContain(
      'ResponseOf<{ 200: Pet; 404: Problem }, Record<string, string>>',
    );
    expect(implementation).toContain('serializeResponseHeaders: true');
  });

  it('decodes a download error by its declared media types', () => {
    const implementation = generateSharedRequestFunction(
      verbOptions(
        { forceSuccessResponse: true },
        {
          response: {
            ...response,
            isBlob: true,
            contentTypes: ['application/octet-stream', 'text/plain'],
            types: {
              success: [
                successType({
                  key: '200',
                  value: 'Blob',
                  contentType: 'application/octet-stream',
                }),
              ],
              errors: [
                successType({
                  key: '404',
                  value: 'string',
                  contentType: 'text/plain',
                }),
              ],
            },
          },
        },
      ),
      makeSharedOptions(),
    );

    expect(implementation).toContain("responseType: 'blob'");
    expect(implementation).toContain("errorResponseType: 'text'");
  });

  it('passes the json reviver', () => {
    const implementation = generateSharedRequestFunction(
      verbOptions(
        {},
        {
          fetchReviver: {
            name: 'reviver',
            path: './reviver',
            default: true,
            hasErrorType: false,
            errorTypeName: '',
            hasSecondArg: true,
            hasThirdArg: false,
            isHook: false,
          },
        },
      ),
      makeSharedOptions(),
    );

    expect(implementation).toContain('reviver: reviver');
  });

  it.each([
    ['throw', 'validateResponse: (data) => Pet.parse(data)'],
    ['both', 'const result = Pet.safeParse(data);'],
  ] as const)(
    'validates the response with the %s strategy as the zod output type',
    (strategy, expected) => {
      const { imports, implementation } = generateSharedClient(
        verbOptions({ runtimeValidation: { enabled: true, strategy } }),
        makeSharedOptions([], { zodSchemaInArguments: true }),
      );

      expect(implementation).toContain(expected);
      expect(implementation).toContain('200: PetOutput; 404: Problem');
      expect(imports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Pet', values: true }),
          expect.objectContaining({ name: 'PetOutput' }),
        ]),
      );
    },
  );

  it('validates through Standard Schema when standardSchema is set', () => {
    const { implementation } = generateSharedClient(
      verbOptions({
        runtimeValidation: {
          enabled: true,
          strategy: 'throw',
          standardSchema: true,
        },
      }),
      makeSharedOptions([], { zodSchemaInArguments: true }),
    );

    expect(implementation).toContain(
      'validateResponse: (data) => orvalParseStandardSchema(Pet, data)',
    );
    expect(implementation).not.toContain('Pet.parse(');
  });

  it('hands the error responses to a three-argument mutator', () => {
    const implementation = generateSharedRequestFunction(
      verbOptions(
        { forceSuccessResponse: true, includeHttpErrorResponse: true },
        {
          mutator: {
            name: 'customFetch',
            path: '../custom-fetch',
            default: false,
            hasErrorType: false,
            errorTypeName: 'ErrorType',
            hasSecondArg: true,
            hasThirdArg: true,
            isHook: false,
          },
        },
      ),
      makeSharedOptions([], { mutator: true }),
    );

    expect(implementation).toContain('errorResponses: [');
    // The mutator issues the request itself, so the runtime-only options stay out.
    expect(implementation).not.toContain('throwOnError');
  });

  it('declares the error responses for the query clients error type', () => {
    const implementation = generateSharedRequestFunction(
      verbOptions(
        { forceSuccessResponse: true, includeHttpErrorResponse: true },
        {
          mutator: {
            name: 'customFetch',
            path: '../custom-fetch',
            default: false,
            hasErrorType: true,
            errorTypeName: 'ErrorType',
            hasSecondArg: true,
            hasThirdArg: true,
            isHook: false,
          },
        },
      ),
      makeSharedOptions([], { mutator: true }),
    );

    expect(implementation).toContain(
      'export type listPetsResponseError = ResponseOf<{ 200: Pet; 404: Problem }, Headers, 404>;',
    );
  });

  describe('execute', () => {
    type Execute = (
      args: Record<string, unknown>,
      config?: { mutator: (...args: unknown[]) => Promise<unknown> },
    ) => Promise<unknown>;
    const execute: Execute = (args, config) => {
      const { outputText } = ts.transpileModule(RUNTIME_TEMPLATE, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
        },
      });
      const exports: { execute: Execute } = {
        execute: () => Promise.reject(new Error('runtime not loaded')),
      };
      runInNewContext(outputText, {
        exports,
        URLSearchParams,
        Date,
        Headers,
        Response,
        JSON,
        Object,
        Symbol,
        Array,
        globalThis: { Error },
      });
      return exports.execute(args, config);
    };
    const respond =
      (body: string, status = 200, contentType = 'application/json') =>
      () =>
        Promise.resolve(
          new Response(body, {
            status,
            headers: { 'content-type': contentType, 'set-cookie': 'a=b' },
          }),
        );
    const call = (
      args: Record<string, unknown>,
      body: string,
      status?: number,
      contentType?: string,
    ) =>
      execute({
        url: '/pets',
        method: 'GET',
        ...args,
        options: { fetch: respond(body, status, contentType) },
      });

    it('merges automatic, operation and call headers without case-sensitive duplicates', async () => {
      const fetch = vi.fn((_url: string, _init: RequestInit) =>
        Promise.resolve(new Response(null, { status: 204 })),
      );
      await execute({
        url: '/pets',
        method: 'POST',
        body: { name: 'Pet' },
        contentType: 'application/json',
        accept: 'application/x-ndjson',
        headers: { accept: 'application/json', 'X-Trace': 'operation' },
        options: {
          fetch,
          headers: new Headers({
            'content-type': 'text/plain',
            'x-trace': 'call',
          }),
        },
      });
      const sent = new Request(
        'https://example.test/pets',
        fetch.mock.calls[0]?.[1],
      );
      expect(sent.headers.get('content-type')).toBe('text/plain');
      expect(sent.headers.get('accept')).toBe('application/json');
      expect(sent.headers.get('x-trace')).toBe('call');
    });

    it('revives a JSON body and deserializes its dates', async () => {
      const result = await call(
        {
          reviver: (key: string, value: unknown) =>
            key === 'n' ? Number(value) : value,
          deserializeResponseDates: (data: { n: number }, status: number) => ({
            ...data,
            status,
          }),
          returnData: true,
        },
        '{"n":"1"}',
      );

      expect(result).toEqual({ n: 1, status: 200 });
    });

    it('leaves the dates of a text body alone', async () => {
      const result = await call(
        {
          responseType: 'text',
          deserializeResponseDates: () => 'x',
          returnData: true,
        },
        'plain',
        200,
        'text/plain',
      );

      expect(result).toBe('plain');
    });

    it('validates only a response declared as JSON, as inline does', async () => {
      const validateResponse = (data: unknown) => ({ validated: data });
      const deserializeResponseDates = () => 'deserialized';

      // No Content-Type: inline neither parses nor validates the body.
      expect(
        await call({ validateResponse, returnData: true }, '{"n":1}', 200, ''),
      ).toBe('{"n":1}');
      // An empty JSON body is validated as `{}`, but not converted.
      expect(
        await call(
          { validateResponse, deserializeResponseDates, returnData: true },
          '',
        ),
      ).toEqual({ validated: {} });
      expect(
        await call(
          { validateResponse, deserializeResponseDates, returnData: true },
          '{"n":1}',
        ),
      ).toEqual({ validated: 'deserialized' });
    });

    it.each([
      [undefined, 'application/problem+json', { title: 'nope' }],
      ['auto', 'application/problem+json', { title: 'nope' }],
      ['auto', 'text/plain', '{"title":"nope"}'],
      ['text', 'application/problem+json', '{"title":"nope"}'],
    ])(
      'decodes a download error (errorResponseType %s, %s) apart from the blob',
      async (errorResponseType, contentType, info) => {
        const failure = await call(
          {
            responseType: 'blob',
            throwOnError: true,
            errorResponseType,
            deserializeResponseDates: () => 'deserialized',
            validateResponse: () => 'validated',
          },
          '{"title":"nope"}',
          404,
          contentType,
        ).catch((error: unknown) => error);

        expect(failure).toMatchObject({ info, status: 404 });
      },
    );

    it('throws the decoded error body without deserializing or validating it', async () => {
      const failure = await call(
        {
          throwOnError: true,
          deserializeResponseDates: () => 'x',
          validateResponse: () => 'x',
        },
        '{"title":"nope"}',
        404,
      ).catch((error: unknown) => error);

      expect(failure).toMatchObject({ info: { title: 'nope' }, status: 404 });
    });

    it('serializes the headers without set-cookie', async () => {
      const result = await call({ serializeResponseHeaders: true }, '{}');

      expect(result).toMatchObject({
        headers: { 'content-type': 'application/json' },
      });
      expect((result as { headers: object }).headers).not.toHaveProperty(
        'set-cookie',
      );
    });

    it('always hands the mutator the error responses', async () => {
      const calls: unknown[][] = [];
      const mutator = (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(undefined);
      };
      const errorResponses = [{ status: 404, contentType: '' }];

      await execute({ url: '/a', method: 'GET' }, { mutator });
      await execute({ url: '/b', method: 'GET', errorResponses }, { mutator });

      expect(calls.map((args) => args[2])).toEqual([
        { errorResponses: [] },
        { errorResponses },
      ]);
    });
  });
});

describe('shared inferred mutators (#4453)', () => {
  const assertNotAny = `
type IsAny<T> = 0 extends 1 & T ? true : false;
const requestIsAny: IsAny<typeof request> = false;
const resultIsAny: IsAny<Awaited<typeof request>> = false;
void requestIsAny;
void resultIsAny;
`;
  const generateClient = async (
    defaultExport = false,
    {
      includeHttpResponseReturnType = false,
      hasSecondArg = true,
      hasThirdArg = false,
      includeHttpErrorResponse = false,
      mutatorName = 'customFetch',
      omitMutatorName = false,
      asyncInferredMutator = false,
    } = {},
  ) => {
    const options = makeSharedOptions([], { mutator: true });
    const mutator = {
      name: mutatorName,
      path: '../custom-fetch',
      default: defaultExport,
      inferred: true,
      hasErrorType: false,
      errorTypeName: 'ErrorType',
      hasSecondArg,
      hasThirdArg,
      isHook: false,
    };
    options.context.output.override.mutator = {
      path: '/proj/src/custom-fetch.ts',
      ...(omitMutatorName ? {} : { name: mutator.name }),
      default: defaultExport,
      inferred: true,
    };
    const verbOptions = makeVerbOptions({
      mutator,
      verb: Verbs.POST,
      override: {
        fetch: includeHttpErrorResponse
          ? {
              includeHttpResponseReturnType: true,
              forceSuccessResponse: true,
              includeHttpErrorResponse,
            }
          : { includeHttpResponseReturnType, asyncInferredMutator },
      },
      body: {
        definition: 'Pet',
        implementation: 'pet',
        contentType: 'application/json',
      },
      props: [
        {
          name: 'pet',
          definition: 'pet: Pet',
          implementation: 'pet: Pet',
          required: true,
          type: GetterPropType.BODY,
          default: undefined,
        },
      ],
      response: {
        definition: { success: 'Pet[]', errors: '' },
        contentTypes: ['application/json'],
        types: {
          success: [successType({ key: '200', value: 'Pet[]' })],
          errors: includeHttpErrorResponse
            ? [successType({ key: '404', value: 'unknown' })]
            : [],
        },
        ...(includeHttpErrorResponse
          ? {
              originalSchema: {
                404: {
                  description: 'Not found',
                  content: { 'application/json': { schema: {} } },
                },
              },
            }
          : {}),
      },
    });
    const client = generateSharedClient(verbOptions, options);
    const imports = client.imports
      .map(
        ({ name, values, importPath }) =>
          `import ${values ? '' : 'type '}{ ${name} } from '${importPath}';`,
      )
      .join('\n');
    const extraFiles = await generateFetchExtraFiles(
      { listPets: verbOptions },
      options.context.output,
      options.context,
    );
    const files = Object.fromEntries(
      extraFiles.map(({ path, content }) => [path, content]),
    );
    const mutatorImports = generateMutatorImports({
      mutators: [mutator],
      implementation: client.implementation,
    });
    files['/proj/src/api/endpoints.ts'] = `${imports}
${mutatorImports}
type Pet = { id: number; name: string };
${client.implementation}`;
    return { client, files, verbOptions, options, mutator };
  };

  it('makes only opted-in inferred operations async and preserves their result type', async () => {
    const { client, files, verbOptions, options } = await generateClient(
      false,
      { asyncInferredMutator: true },
    );
    expect(client.implementation).toContain('listPets = async (');
    files['/proj/src/custom-fetch.ts'] =
      `export const customFetch = <T>(url: string, options: RequestInit): Promise<{ value: T }> => Promise.resolve({ value: {} as T });`;
    files['/proj/src/check.ts'] =
      `import { listPets } from './api/endpoints'; type Pet = { id: number; name: string }; const result: Promise<{ value: Pet[] }> = listPets({ id: 1, name: 'a' }); void result;`;
    expect(
      typeCheckFiles(files, [
        'lib.es2022.d.ts',
        'lib.dom.d.ts',
        'lib.dom.iterable.d.ts',
      ]),
    ).toEqual([]);
    verbOptions.override.fetch.asyncInferredMutator = false;
    expect(generateSharedClient(verbOptions, options).implementation).toContain(
      'listPets = (',
    );
  });

  it('shares an unnamed default mutator across operations with different local names', async () => {
    const { files, verbOptions, options, mutator } = await generateClient(
      true,
      {
        mutatorName: 'listPetsMutator',
        omitMutatorName: true,
      },
    );
    const secondMutator = { ...mutator, name: 'getPetMutator' };
    options.context.output.target = '/proj/src/api/other.ts';
    const secondClient = generateSharedClient(
      {
        ...verbOptions,
        operationName: 'getPet',
        operationId: 'getPet',
        typeName: 'getPet',
        mutator: secondMutator,
      },
      options,
    );
    const imports = secondClient.imports
      .map(
        ({ name, values, importPath }) =>
          `import ${values ? '' : 'type '}{ ${name} } from '${importPath}';`,
      )
      .join('\n');
    const mutatorImports = generateMutatorImports({
      mutators: [secondMutator],
      implementation: secondClient.implementation,
    });
    files['/proj/src/api/other.ts'] = `${imports}
${mutatorImports}
type Pet = { id: number; name: string };
${secondClient.implementation}`;
    files['/proj/src/custom-fetch.ts'] = `
export default async function customFetch<T>(url: string, options: RequestInit & { baseUrl?: string }): Promise<{ data: T }> {
  return { data: await (await fetch((options.baseUrl ?? '') + url, options)).json() as T };
}
`;
    files['/proj/src/consumer.ts'] = `
import { listPets } from './api/endpoints';
import { getPet } from './api/other';
const request = listPets({ id: 1, name: 'Pet' }, { baseUrl: 'https://api.test' });
const otherRequest = getPet({ id: 2, name: 'Other' }, { baseUrl: 'https://api.test' });
const expected: Promise<{ data: { id: number; name: string }[] }> = request;
const otherExpected: typeof request = otherRequest;
void expected;
void otherExpected;
${assertNotAny}
const otherIsAny: IsAny<Awaited<typeof otherRequest>> = false;
void otherIsAny;
`;

    expect(
      typeCheckFiles(files, [
        'lib.es2022.d.ts',
        'lib.dom.d.ts',
        'lib.dom.iterable.d.ts',
      ]),
    ).toEqual([]);
  });

  it('avoids duplicate writer imports when the custom function is named mutator', async () => {
    const { files } = await generateClient(false, { mutatorName: 'mutator' });
    files['/proj/src/custom-fetch.ts'] = `
export const mutator = async <T>(url: string, options: RequestInit): Promise<{ data: T }> => ({ data: await (await fetch(url, options)).json() as T });
`;
    files['/proj/src/consumer.ts'] = `
import { listPets } from './api/endpoints';
const request = listPets({ id: 1, name: 'Pet' });
const explicitUndefined = listPets({ id: 1, name: 'Pet' }, undefined);
void explicitUndefined;
const expected: Promise<{ data: { id: number; name: string }[] }> = request;
void expected;
`;

    expect(
      typeCheckFiles(files, [
        'lib.es2022.d.ts',
        'lib.dom.d.ts',
        'lib.dom.iterable.d.ts',
      ]),
    ).toEqual([]);
  });

  it.each([false, true])(
    'preserves custom options and a transport result with default export %s',
    async (defaultExport) => {
      const { client, files } = await generateClient(defaultExport);
      files['/proj/src/custom-fetch.ts'] = `
export type TransportResult = { response: Response; data: unknown };
const customFetch = <T>(url: string, options: RequestInit & { baseUrl?: string }): Promise<TransportResult> =>
  fetch(url, options).then(response => ({ response, data: undefined }));
${defaultExport ? 'export default customFetch;' : 'export { customFetch };'}
`;
      files['/proj/src/consumer.ts'] = `
import { listPets } from './api/endpoints';
import type { TransportResult } from './custom-fetch';
const request = listPets({ id: 1, name: 'Pet' }, { baseUrl: 'https://api.test' });
const expected: Promise<TransportResult> = request;
const sameType: typeof request = expected;
// @ts-expect-error the mutator owns the return type, rather than the payload
const payload: Promise<{ id: number; name: string }[]> = request;
void sameType;
void payload;
${assertNotAny}
`;

      expect(client.imports).toContainEqual({
        name: 'CallOptions',
        importPath: './client-config',
      });
      expect(
        typeCheckFiles(files, [
          'lib.es2022.d.ts',
          'lib.dom.d.ts',
          'lib.dom.iterable.d.ts',
        ]),
      ).toEqual([]);
    },
  );

  it.each([false, true])(
    'instantiates a generic envelope with includeHttpResponseReturnType=%s',
    async (includeHttpResponseReturnType) => {
      const { files } = await generateClient(false, {
        includeHttpResponseReturnType,
      });
      files['/proj/src/custom-fetch.ts'] = `
export type Envelope<T> = { data: T; response: Response };
export const customFetch = async <T>(url: string, options: RequestInit & { baseUrl?: string }): Promise<Envelope<T>> => {
  const response = await fetch(url, options);
  return { data: await response.json() as T, response };
};
`;
      files['/proj/src/consumer.ts'] = `
import { listPets${includeHttpResponseReturnType ? ', type listPetsResponse' : ''} } from './api/endpoints';
import type { Envelope } from './custom-fetch';
type Pet = { id: number; name: string };
const request = listPets({ id: 1, name: 'Pet' }, { baseUrl: 'https://api.test' });
const expected: Promise<Envelope<${includeHttpResponseReturnType ? 'listPetsResponse' : 'Pet[]'}>> = request;
const sameType: typeof request = expected;
// @ts-expect-error the envelope's body follows includeHttpResponseReturnType
const otherMode: Promise<Envelope<${includeHttpResponseReturnType ? 'Pet[]' : '{ data: Pet[]; status: number }'}>> = request;
void sameType;
void otherMode;
${assertNotAny}
const dataIsAny: IsAny<Awaited<typeof request>['data']> = false;
void dataIsAny;
`;

      expect(
        typeCheckFiles(files, [
          'lib.es2022.d.ts',
          'lib.dom.d.ts',
          'lib.dom.iterable.d.ts',
        ]),
      ).toEqual([]);
    },
  );

  it('accepts a one-argument inferred mutator and uses RequestInit for options', async () => {
    const { files } = await generateClient(false, { hasSecondArg: false });
    files['/proj/src/custom-fetch.ts'] = `
export const customFetch = async <T>(url: string): Promise<{ data: T }> => ({ data: await (await fetch(url)).json() as T });
`;
    files['/proj/src/consumer.ts'] = `
import { listPets } from './api/endpoints';
import type { CallOptions } from './api/client-config';
const options: CallOptions = { credentials: 'include' };
const request = listPets({ id: 1, name: 'Pet' }, options);
const expected: Promise<{ data: { id: number; name: string }[] }> = request;
const sameType: typeof request = expected;
const init: RequestInit = options;
// @ts-expect-error a one-argument mutator contributes no custom options
const customOptions: CallOptions = { baseUrl: 'https://api.test' };
void request;
void sameType;
void init;
void customOptions;
${assertNotAny}
const dataIsAny: IsAny<Awaited<typeof request>['data']> = false;
void dataIsAny;
`;

    expect(
      typeCheckFiles(files, [
        'lib.es2022.d.ts',
        'lib.dom.d.ts',
        'lib.dom.iterable.d.ts',
      ]),
    ).toEqual([]);
  });

  it.each([
    [
      'a constrained generic',
      'T extends object',
      'RequestInit & { baseUrl?: string }',
      false,
    ],
    ['custom-only options', 'T', '{ baseUrl?: string }', false],
    [
      'optional request options',
      'T',
      'RequestInit & { baseUrl?: string }',
      true,
    ],
  ])(
    'preserves an inferred envelope for %s',
    async (_, generic, optionsType, optional) => {
      const { files } = await generateClient();
      files['/proj/src/custom-fetch.ts'] = `
export type Envelope<T> = { data: T; response: Response };
export const customFetch = async <${generic}>(url: string, options${optional ? '?' : ''}: ${optionsType}): Promise<Envelope<T>> => {
  const response = await fetch((options?.baseUrl ?? '') + url);
  return { data: await response.json() as T, response };
};
`;
      files['/proj/src/consumer.ts'] = `
import { listPets } from './api/endpoints';
import type { Envelope } from './custom-fetch';
type Pet = { id: number; name: string };
const request = listPets({ id: 1, name: 'Pet' }, { baseUrl: 'https://api.test' });
const expected: Promise<Envelope<Pet[]>> = request;
const sameType: typeof request = expected;
// @ts-expect-error the envelope contains an array of pets
const wrongPayload: Promise<Envelope<string>> = request;
void sameType;
void wrongPayload;
${assertNotAny}
const dataIsAny: IsAny<Awaited<typeof request>['data']> = false;
void dataIsAny;
`;

      expect(
        typeCheckFiles(files, [
          'lib.es2022.d.ts',
          'lib.dom.d.ts',
          'lib.dom.iterable.d.ts',
        ]),
      ).toEqual([]);
    },
  );

  it.each([
    ['a readonly', 'readonly '],
    ['a mutable', ''],
  ])(
    'hands the error responses to a three-argument inferred mutator taking %s array',
    async (_, modifier) => {
      const { client, files } = await generateClient(false, {
        hasThirdArg: true,
        includeHttpErrorResponse: true,
      });
      files['/proj/src/custom-fetch.ts'] = `
export const customFetch = async <T>(
  url: string,
  options: RequestInit,
  meta: { errorResponses: ${modifier}{ status: number; contentType: string }[] },
): Promise<T> => {
  void meta;
  return (await fetch(url, options)).json() as Promise<T>;
};
`;

      expect(client.implementation).toContain(
        'errorResponses: [{"status":404,"contentType":"application/json"}]',
      );
      expect(files['/proj/src/api/client-config.ts']).toContain(
        'fetcher(args.url, mutatorOptions, { errorResponses: args.errorResponses ?? [] })',
      );
      expect(
        typeCheckFiles(files, [
          'lib.es2022.d.ts',
          'lib.dom.d.ts',
          'lib.dom.iterable.d.ts',
        ]),
      ).toEqual([]);
    },
  );

  it.each([
    [false, false],
    [true, false],
    [true, true],
  ])(
    'passes request options through with asynchronous=%s and opt-in=%s',
    async (asynchronous, optIn) => {
      const { files } = await generateClient(false, {
        asyncInferredMutator: optIn,
      });
      const evaluate = (
        source: string,
        dependencies: Partial<Record<string, Record<string, unknown>>> = {},
      ) => {
        const { outputText } = ts.transpileModule(source, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
          },
        });
        const exports: Record<string, unknown> = {};
        runInNewContext(outputText, {
          exports,
          require: (name: string) => {
            const dependency = dependencies[name];
            if (!dependency) throw new Error(`Unexpected import: ${name}`);
            return dependency;
          },
          Headers,
          URLSearchParams,
          Date,
        });
        return exports;
      };
      const envelope = { response: new Response('[]'), data: [{ id: 1 }] };
      const result = asynchronous ? Promise.resolve(envelope) : envelope;
      const fetchOverride: typeof fetch = async () => new Response('[]');
      let receivedUrl: string | undefined;
      let receivedOptions:
        | (RequestInit & { baseUrl?: string; fetch?: typeof fetch })
        | undefined;
      const customFetch = (
        url: string,
        options: RequestInit & { baseUrl?: string; fetch?: typeof fetch },
      ) => {
        receivedUrl = url;
        receivedOptions = options;
        return result;
      };
      const runtime = evaluate(files['/proj/src/runtime.ts']);
      const config = evaluate(files['/proj/src/api/client-config.ts'], {
        '../runtime': runtime,
        '../custom-fetch': { customFetch },
      });
      const endpoints = evaluate(files['/proj/src/api/endpoints.ts'], {
        '../runtime': runtime,
        './client-config': config,
      });
      const listPets = endpoints.listPets as (
        body: { id: number; name: string },
        options: RequestInit & { baseUrl?: string; fetch?: typeof fetch },
      ) => typeof result;
      const actual = listPets(
        { id: 1, name: 'Pet' },
        {
          baseUrl: 'https://api.test',
          fetch: fetchOverride,
          body: 'overridden',
          headers: new Headers({ 'X-Trace': 'trace' }),
        },
      );

      if (!optIn) expect(actual).toBe(result);
      expect(receivedUrl).toBe('/pets');
      expect(await actual).toBe(envelope);
      expect(receivedOptions?.fetch).toBe(fetchOverride);
      expect(receivedOptions).toMatchObject({
        baseUrl: 'https://api.test',
        method: 'POST',
        body: JSON.stringify({ id: 1, name: 'Pet' }),
        headers: { 'Content-Type': 'application/json', 'x-trace': 'trace' },
      });
      if (optIn) {
        const error = new Error('serialization');
        receivedUrl = undefined;
        const rejected = listPets(
          {
            id: 1,
            name: 'Pet',
            toJSON() {
              throw error;
            },
          } as { id: number; name: string },
          {},
        );
        await expect(rejected).rejects.toBe(error);
        expect(receivedUrl).toBeUndefined();
      }

      const execute = config.execute as (
        args: {
          url: string;
          method: string;
          body?: unknown;
          contentType?: string;
          options: RequestInit;
        },
        fetcher: typeof customFetch,
      ) => typeof result;
      await execute(
        { url: '/pets', method: 'GET', options: { body: 'ignored' } },
        customFetch,
      );
      expect(receivedOptions?.body).toBeUndefined();
      expect(receivedOptions).not.toHaveProperty('body');
      await execute(
        {
          url: '/pets',
          method: 'POST',
          body: undefined,
          options: { body: 'ignored' },
        },
        customFetch,
      );
      expect(receivedOptions?.body).toBeUndefined();
      expect(receivedOptions).not.toHaveProperty('body');
      for (const body of [null, '']) {
        await execute(
          {
            url: '/pets',
            method: 'POST',
            body,
            contentType: 'text/plain',
            options: { body: 'ignored' },
          },
          customFetch,
        );
        expect(receivedOptions?.body).toBe(body);
      }
    },
  );
});

describe('shared runtime type-check (#4344)', () => {
  // A runtime without the DOM lib, such as Bun, declares `RequestInit` and
  // friends but not the `BodyInit`/`HeadersInit` globals.
  const FETCH_GLOBALS = `
declare class Headers implements Iterable<[string, string]> {
  constructor(init?: Record<string, string>);
  get(name: string): string | null;
  entries(): IterableIterator<[string, string]>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}
declare class Blob {}
declare class Response {
  readonly ok: boolean;
  readonly status: number;
  readonly headers: Headers;
  text(): Promise<string>;
  blob(): Promise<Blob>;
  json(): Promise<unknown>;
}
interface RequestInit {
  method?: string;
  headers?: Headers | [string, string][] | Record<string, string>;
  body?: string | Blob | null;
}
declare function fetch(url: string, init?: RequestInit): Promise<Response>;
declare class URLSearchParams {
  append(name: string, value: string): void;
  toString(): string;
}
`;

  const typeCheck = (
    mutatorOptionsType: string,
    inferred = false,
    extraParameters = '',
  ) => {
    const files: Record<string, string> = {
      '/proj/globals.d.ts': FETCH_GLOBALS,
      '/proj/runtime.ts': RUNTIME_TEMPLATE,
      '/proj/custom-fetch.ts': `export const customFetch = async <T>(
  url: string,
  options: ${mutatorOptionsType},${extraParameters}
): Promise<T> => {
  return (await fetch(url, options)).json() as Promise<T>;
};
`,
      '/proj/client-config.ts': clientConfigTemplate({
        runtimeImportPath: './runtime',
        mutatorImport: "import { customFetch } from './custom-fetch';\n",
        mutatorName: 'customFetch',
        inferred,
      }),
    };
    if (inferred) {
      files['/proj/consumer.ts'] = `
import { execute, customFetchFetcher } from './client-config';
execute({ url: '/pets', method: 'GET' }, customFetchFetcher<object>);
`;
    }
    return typeCheckFiles(files);
  };

  it('compiles a generated plain operation with omitted or undefined options', async () => {
    const options = makeSharedOptions();
    const verbOptions = makeVerbOptions();
    const client = generateSharedClient(verbOptions, options);
    const imports = client.imports
      .map(
        ({ name, values, importPath }) =>
          `import ${values ? '' : 'type '}{ ${name} } from '${importPath}';`,
      )
      .join('\n');
    const extraFiles = await generateFetchExtraFiles(
      { listPets: verbOptions },
      options.context.output,
      options.context,
    );
    const files = Object.fromEntries(
      extraFiles.map(({ path, content }) => [path, content]),
    );
    files['/proj/src/api/endpoints.ts'] = `${imports}
type Pet = { id: number; name: string };
${client.implementation}`;
    files['/proj/src/consumer.ts'] = `
import { listPets } from './api/endpoints';
void listPets();
void listPets(undefined);
`;

    expect(
      typeCheckFiles(files, [
        'lib.es2022.d.ts',
        'lib.dom.d.ts',
        'lib.dom.iterable.d.ts',
      ]),
    ).toEqual([]);
  });

  it.each([
    'RequestInit',
    'RequestInit & { schema?: unknown }',
    'RequestInit & { schema?: { parse(data: unknown): unknown } }',
  ])('compiles without the DOM lib for a mutator taking %s', (optionsType) => {
    expect(typeCheck(optionsType)).toEqual([]);
  });

  it.each([
    ['a readonly', 'readonly '],
    ['a mutable', ''],
  ])(
    'compiles for a mutator taking the error responses as %s array',
    (_, modifier) => {
      expect(
        typeCheck(
          'RequestInit',
          false,
          `\n  meta: { errorResponses: ${modifier}{ status: number; contentType: string }[] },`,
        ),
      ).toEqual([]);
    },
  );

  // Operations without a validated response pass no schema, so a mutator
  // requiring one would receive `undefined` at runtime.
  it.each([
    'RequestInit & { schema: unknown }',
    'RequestInit & { schema: { parse(data: unknown): unknown } }',
  ])('rejects a mutator requiring the schema: %s', (optionsType) => {
    expect(typeCheck(optionsType)).toEqual([
      expect.stringContaining(
        "is not assignable to parameter of type 'ClientConfig'",
      ),
    ]);
  });

  it.each([
    'RequestInit',
    'RequestInit & { schema?: unknown }',
    'RequestInit & { schema?: { parse(data: unknown): unknown } }',
  ])(
    'compiles an inferred mutator without the DOM lib taking %s',
    (optionsType) => {
      expect(typeCheck(optionsType, true)).toEqual([]);
    },
  );

  it.each([
    'RequestInit & { schema: unknown }',
    'RequestInit & { schema: { parse(data: unknown): unknown } }',
    'RequestInit & { baseUrl: string }',
  ])(
    'rejects an inferred mutator requiring an unavailable option: %s',
    (optionsType) => {
      expect(typeCheck(optionsType, true)).toEqual([
        expect.stringContaining('is not assignable to parameter of type'),
      ]);
    },
  );
});

describe('normalizeSharedRuntimeVerbOptions', () => {
  const mutator = (isHook = false) => ({
    name: 'customFetch',
    path: '../custom-fetch',
    default: false,
    hasErrorType: false,
    errorTypeName: 'ErrorType',
    hasSecondArg: true,
    hasThirdArg: false,
    isHook,
  });
  const output = ({
    globalMutator = true,
    style = 'shared',
  }: { globalMutator?: boolean; style?: 'shared' | 'inline' } = {}) => {
    const { context } = makeSharedOptions([], {
      client: OutputClient.REACT_QUERY,
      mutator: globalMutator,
    });
    context.output.override.fetch.runtimeImplementationStyle = style;
    return context.output;
  };

  it.each([
    ['a hook mutator', mutator(true), output()],
    [
      'a mutator set only per operation',
      mutator(),
      output({ globalMutator: false }),
    ],
  ])(
    'drops %s, which the shared runtime cannot route',
    (_, operationMutator, out) => {
      expect(
        normalizeSharedRuntimeVerbOptions(
          makeVerbOptions({ mutator: operationMutator }),
          out,
        ).mutator,
      ).toBeUndefined();
    },
  );

  it.each([
    ['a global mutator', output()],
    ['the inline style', output({ style: 'inline', globalMutator: false })],
  ])('keeps the mutator for %s', (_, out) => {
    expect(
      normalizeSharedRuntimeVerbOptions(
        makeVerbOptions({ mutator: mutator() }),
        out,
      ).mutator,
    ).toEqual(mutator());
  });
});

describe('shared runtime with httpClientInjection: factory (#4520)', () => {
  const factoryOptions = (mutator?: boolean) => {
    const options = makeSharedOptions([], { mutator });
    options.context.output.override.fetch.httpClientInjection = 'factory';
    return options;
  };
  const verbOptions = (
    overrides: Parameters<typeof createTestGeneratorVerbOptions>[0] = {},
  ) =>
    makeVerbOptions({
      response: {
        definition: { success: 'Pet[]', errors: '' },
        contentTypes: ['application/json'],
        types: {
          success: [successType({ key: '200', value: 'Pet[]' })],
          errors: [],
        },
      },
      ...overrides,
    });

  const assemble = (options: GeneratorOptions, implementation: string) => {
    const header = generateFetchHeader({
      title: 'getPetstore',
      isRequestOptions: true,
      isMutator: false,
      isGlobalMutator: false,
      provideIn: false,
      hasAwaitedType: true,
      output: options.context.output,
      verbOptions: {},
      clientImplementation: implementation,
    });
    if (typeof header === 'string') throw new Error('expected a transform');
    const footer = generateFetchFooter({
      operationNames: ['listPets'],
      operations: [{ operationName: 'listPets' }] as GeneratorOperation[],
      output: options.context.output,
      hasMutator: false,
      hasAwaitedType: true,
      title: 'getPetstore',
    });
    return `${header.implementation}${header.transformClientImplementation?.(implementation) ?? implementation}${footer}`;
  };

  it('declares the operation locally and passes the factory fetch as options.fetch', () => {
    const implementation = generateSharedRequestFunction(
      verbOptions(),
      factoryOptions(),
    );

    expect(implementation).toContain('export type listPetsResponse =');
    expect(implementation).toContain('export const getListPetsUrl = (');
    expect(implementation).toContain(
      '/* orval:factory-operation-start */\nconst listPets = (',
    );
    expect(implementation).toContain('options: { fetch: fetchFn, ...options }');
    expect(implementation).not.toContain('...(options !== undefined');
  });

  it('passes no fetch to a client-config mutator', () => {
    const implementation = generateSharedRequestFunction(
      verbOptions({
        mutator: {
          name: 'customFetch',
          path: '../custom-fetch',
          default: false,
          hasErrorType: false,
          errorTypeName: 'ErrorType',
          hasSecondArg: true,
          hasThirdArg: false,
          isHook: false,
        },
      }),
      factoryOptions(true),
    );

    expect(implementation).toContain('const listPets = (');
    expect(implementation).not.toContain('fetchFn');
    expect(implementation).toContain('...(options !== undefined');
  });

  it('type-checks the assembled factory against the runtime', () => {
    const options = factoryOptions();
    const client = generateSharedClient(verbOptions(), options);
    const imports = client.imports
      .map(
        ({ name, values, importPath }) =>
          `import ${values ? '' : 'type '}{ ${name} } from '${importPath}';`,
      )
      .join('\n');
    const source = assemble(options, client.implementation);

    expect(source).toMatch(
      /export const getListPetsUrl[\s\S]*export const getPetstore = \(fetchFn: typeof globalThis\.fetch = fetch\) => \{\n[\s\S]*const listPets = \([\s\S]*return \{ listPets, getListPetsUrl \};\n\};\n$/,
    );

    const files: Record<string, string> = {
      '/proj/src/runtime.ts': RUNTIME_TEMPLATE,
      '/proj/src/api/endpoints.ts': `${imports}
type Pet = { id: number; name: string };
${source}`,
      '/proj/src/consumer.ts': `
import { getPetstore, getListPetsUrl, type listPetsResponse } from './api/endpoints';
const customFetch: typeof globalThis.fetch = (input, init) => fetch(input, init);
const client = getPetstore(customFetch);
const response: Promise<listPetsResponse> = client.listPets();
const overridden: Promise<listPetsResponse> = client.listPets({ fetch: customFetch, signal: null });
const fallback = getPetstore();
const url: string = client.getListPetsUrl();
const sameUrl: typeof getListPetsUrl = fallback.getListPetsUrl;
void response; void overridden; void url; void sameUrl;
`,
    };

    expect(
      typeCheckFiles(files, [
        'lib.es2022.d.ts',
        'lib.dom.d.ts',
        'lib.dom.iterable.d.ts',
      ]),
    ).toEqual([]);
  });

  it('sends requests through the factory fetch unless the call overrides it', async () => {
    const options = factoryOptions();
    const client = generateSharedClient(verbOptions(), options);
    const source = assemble(options, client.implementation);
    const program = ts.transpileModule(
      `${RUNTIME_TEMPLATE}\n${source}\nexport { getPetstore };`,
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText;
    const exports: Record<string, unknown> = {};
    runInNewContext(program, {
      exports,
      Headers,
      Response,
      URLSearchParams,
      fetch: () => {
        throw new Error('global fetch must not be used');
      },
    });
    const getPetstore = exports.getPetstore as (fetchFn: typeof fetch) => {
      listPets: (options?: { fetch?: typeof fetch }) => Promise<{
        data: unknown;
      }>;
    };
    const factoryFetch = vi.fn(
      async () => new Response('[{"id":1}]', { status: 200 }),
    );
    const callFetch = vi.fn(
      async () => new Response('[{"id":2}]', { status: 200 }),
    );
    const petstore = getPetstore(factoryFetch);

    await expect(petstore.listPets()).resolves.toMatchObject({
      data: [{ id: 1 }],
    });
    await expect(
      petstore.listPets({ fetch: callFetch }),
    ).resolves.toMatchObject({ data: [{ id: 2 }] });
    expect(factoryFetch).toHaveBeenCalledTimes(1);
    expect(callFetch).toHaveBeenCalledTimes(1);
  });
});
