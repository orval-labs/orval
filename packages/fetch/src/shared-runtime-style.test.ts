import { runInNewContext } from 'node:vm';

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
import ts from 'typescript';
import { describe, expect, it } from 'vite-plus/test';

import {
  createTestContextSpec,
  createTestGeneratorOptions,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
import { generateRequestFunction } from './index';
import { clientConfigTemplate, RUNTIME_TEMPLATE } from './runtime';
import {
  generateFetchExtraFiles,
  generateSharedClient,
  generateSharedRequestFunction,
} from './shared-runtime-style';

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
  }: {
    style?: 'inline' | 'shared';
    mutator?: { name: string; default: boolean };
    hook?: boolean;
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
      { listPets: makeVerbOptions({ mutator: verbMutator }) },
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
            includeHttpResponseReturnType: false,
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
            includeHttpResponseReturnType: false,
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
    const builder = (implementation: string) =>
      implementation.slice(
        implementation.indexOf('export const getListPetsUrl'),
        implementation.indexOf('\n}\n') + 3,
      );

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
    expect(implementation).toContain(
      "headers: { Accept: 'application/x-ndjson' }",
    );
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

    expect(implementation).toContain(
      "headers: { Accept: 'Application/X-NDJSON' }",
    );
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
            includeHttpResponseReturnType: false,
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

    it.each([
      ['without includeZodSchemaInArguments', true, false],
      ['without a mutator', false, true],
    ])('passes no schema %s', (_, withMutator, zodSchemaInArguments) => {
      const { imports, implementation } = generateSharedClient(
        validatedVerbOptions(undefined, withMutator),
        makeSharedOptions([], { mutator: withMutator, zodSchemaInArguments }),
      );

      expect(implementation).not.toContain('schema:');
      expect(imports).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Pet', values: true }),
        ]),
      );
    });
  });
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

  const typeCheck = (mutatorOptionsType: string) => {
    const files: Record<string, string> = {
      '/proj/globals.d.ts': FETCH_GLOBALS,
      '/proj/runtime.ts': RUNTIME_TEMPLATE,
      '/proj/custom-fetch.ts': `export const customFetch = async <T>(
  url: string,
  options: ${mutatorOptionsType},
): Promise<T> => {
  return (await fetch(url, options)).json() as Promise<T>;
};
`,
      '/proj/client-config.ts': clientConfigTemplate({
        runtimeImportPath: './runtime',
        mutatorImport: "import { customFetch } from './custom-fetch';\n",
        mutatorName: 'customFetch',
      }),
    };
    const compilerOptions: ts.CompilerOptions = {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['lib.es2022.d.ts'],
      types: [],
    };
    const base = ts.createCompilerHost(compilerOptions);
    const host: ts.CompilerHost = {
      ...base,
      getSourceFile: (fileName, languageVersion, ...rest) =>
        fileName in files
          ? ts.createSourceFile(fileName, files[fileName], languageVersion)
          : base.getSourceFile(fileName, languageVersion, ...rest),
      fileExists: (fileName) => fileName in files || base.fileExists(fileName),
      readFile: (fileName) => files[fileName] ?? base.readFile(fileName),
      directoryExists: (name) =>
        name === '/proj' || (base.directoryExists?.(name) ?? true),
    };
    const program = ts.createProgram(Object.keys(files), compilerOptions, host);
    return ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  };

  it.each([
    'RequestInit',
    'RequestInit & { schema: unknown }',
    'RequestInit & { schema?: { parse(data: unknown): unknown } }',
  ])('compiles without the DOM lib for a mutator taking %s', (optionsType) => {
    expect(typeCheck(optionsType)).toEqual([]);
  });
});
