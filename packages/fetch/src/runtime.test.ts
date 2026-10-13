import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiParameterObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '@orval/core';
import { GetterPropType, PropertySortOrder, Verbs } from '@orval/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestContextSpec,
  createTestGeneratorOptions,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
import { generateRequestFunction } from './index';
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
        const implementation = generateRequestFunction(
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
