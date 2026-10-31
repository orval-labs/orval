import { runInNewContext } from 'node:vm';

import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type OpenApiParameterObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  type OpenApiSchemaObject,
} from '@orval/core';
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { generateValibot, getValibotDependencies } from '.';
import { createTestContextSpec } from '../../core/src/test-utils';
import { logger, resetWarnings } from './logger';

describe('operations', () => {
  const run = async (
    schema: OpenApiSchemaObject,
    {
      code = '200',
      contentType = 'application/json',
      parameters = [],
      components = {},
      requestBody,
      content,
    }: {
      code?: string;
      contentType?: string;
      parameters?: OpenApiParameterObject[];
      components?: Record<string, OpenApiSchemaObject>;
      requestBody?: OpenApiRequestBodyObject;
      content?: OpenApiResponseObject['content'];
    } = {},
  ) => {
    const context = createTestContextSpec({
      spec: {
        components: { schemas: components },
        paths: {
          '/pets': {
            get: {
              parameters,
              requestBody,
              responses: {
                [code]: {
                  description: 'ok',
                  content: content ?? { [contentType]: { schema } },
                },
              },
            },
          },
        },
      },
    });
    const { implementation } = await generateValibot(
      {
        typeName: 'listPets',
        verb: 'get',
        override: {
          ...context.output.override,
          valibot: {
            strict: {
              param: false,
              query: false,
              header: false,
              body: false,
              response: false,
            },
            generate: {
              param: true,
              query: true,
              header: true,
              body: true,
              response: true,
            },
            exactOptional: false,
          },
        },
      } as GeneratorVerbOptions,
      { pathRoute: '/pets', context } as GeneratorOptions,
      'valibot',
    );
    return implementation;
  };

  it('imports valibot as a namespace', () => {
    expect(getValibotDependencies()[0]).toMatchObject({
      dependency: 'valibot',
      exports: [{ name: 'v', namespaceImport: true }],
    });
  });

  it('emits a response const per operation', async () => {
    expect(await run({ type: 'string' })).toContain(
      'export const ListPetsResponse = v.string()',
    );
  });

  it('validates a +json vendor type and a 201 response', async () => {
    const implementation = await run(
      { type: 'string' },
      { code: '201', contentType: 'application/hal+json; charset=utf-8' },
    );
    expect(implementation).toContain('ListPetsResponse = v.string()');
  });

  it('emits an array response with its size limits', async () => {
    const implementation = await run({
      type: 'array',
      maxItems: 0,
      items: { type: 'string' },
    });
    expect(implementation).toContain(
      'v.pipe(v.array(v.string()), v.maxLength(0))',
    );
  });

  it('inlines a $ref and validates a circular one as unknown', async () => {
    const implementation = await run(
      { $ref: '#/components/schemas/Node' },
      {
        components: {
          Node: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' },
              next: { $ref: '#/components/schemas/Node' },
            },
          },
        },
      },
    );
    expect(implementation).toContain('id: v.string()');
    expect(implementation).toContain('next: v.optional(v.unknown())');
  });

  it('keeps parameters named like Object.prototype members', async () => {
    const implementation = await run(
      { type: 'string' },
      {
        parameters: [
          {
            name: 'constructor',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
          { name: '__proto__', in: 'query', schema: { type: 'string' } },
        ],
      },
    );
    expect(implementation).toContain('constructor: v.string()');
    expect(implementation).toContain("['__proto__']: v.optional(v.string())");
  });

  describe('request body', () => {
    const body = (required?: boolean): OpenApiRequestBodyObject => ({
      ...(required === undefined ? {} : { required }),
      content: {
        'application/json': {
          schema: { type: 'string' },
        },
      },
    });

    // The body schema is the value of the body, so it is never optional,
    // whether or not the operation marks the body as required.
    it.each([true, false, undefined])(
      'validates the body as present when required is %s',
      async (required) => {
        const implementation = await run(
          { type: 'string' },
          { requestBody: body(required) },
        );
        expect(implementation).toContain('ListPetsBody = v.string()');
      },
    );
  });

  describe('media types', () => {
    const string: OpenApiSchemaObject = { type: 'string' };

    it('skips a null media object', async () => {
      const implementation = await run(string, {
        content: {
          'application/json': null,
          'application/hal+json': { schema: string },
        } as unknown as OpenApiResponseObject['content'],
      });
      expect(implementation).toContain('ListPetsResponse = v.string()');
    });

    it('does not let a media type without a schema hide a later one', async () => {
      const implementation = await run(string, {
        content: {
          'application/json': {},
          'application/hal+json': { schema: string },
        },
      });
      expect(implementation).toContain('ListPetsResponse = v.string()');
    });

    it('skips a null schema', async () => {
      const implementation = await run(string, {
        content: {
          'application/json': { schema: null },
          'application/hal+json': { schema: string },
        } as unknown as OpenApiResponseObject['content'],
      });
      expect(implementation).toContain('ListPetsResponse = v.string()');
    });

    it('skips a false schema', async () => {
      const implementation = await run(string, {
        content: {
          'application/json': { schema: false },
          'application/hal+json': { schema: string },
        } as unknown as OpenApiResponseObject['content'],
      });
      expect(implementation).toContain('ListPetsResponse = v.string()');
    });

    it('emits nothing when no media type has a schema', async () => {
      expect(await run(string, { content: { 'application/json': {} } })).toBe(
        '',
      );
    });
  });

  describe('media type priority', () => {
    const object = (field: OpenApiSchemaObject): OpenApiSchemaObject => ({
      type: 'object',
      required: ['f'],
      properties: { f: field },
    });

    it('prefers JSON, then multipart, then url-encoded', async () => {
      const content = {
        'application/x-www-form-urlencoded': {
          schema: object({ type: 'number' }),
        },
        'multipart/form-data': { schema: object({ type: 'boolean' }) },
      };
      const both = await run({}, { content });
      expect(both).toContain('f: v.boolean()');
      const json = await run(
        {},
        {
          content: {
            ...content,
            'application/json': { schema: object({ type: 'string' }) },
          },
        },
      );
      expect(json).toContain('f: v.string()');
    });

    const binary: OpenApiSchemaObject = { type: 'string', format: 'binary' };

    it('keeps a binary field of a url-encoded body a string', async () => {
      const implementation = await run(
        {},
        {
          content: {
            'application/x-www-form-urlencoded': { schema: object(binary) },
          },
        },
      );
      expect(implementation).toContain('f: v.string()');
    });

    it('validates a binary field of a multipart body as a file', async () => {
      const implementation = await run(
        {},
        {
          content: { 'multipart/form-data': { schema: object(binary) } },
        },
      );
      expect(implementation).toContain('f: v.file()');
    });
  });

  describe('multipart parts', () => {
    const multipart = (
      properties: Record<string, OpenApiSchemaObject>,
      encoding?: Record<string, { contentType?: unknown }>,
      required: string[] = Object.keys(properties),
    ) =>
      run(
        {},
        {
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: { type: 'object', required, properties },
                encoding,
              },
            },
          } as OpenApiRequestBodyObject,
        },
      );

    it('validates a part with a binary contentMediaType as a file', async () => {
      const implementation = await multipart({
        image: { type: 'string', contentMediaType: 'image/png' },
      });
      expect(implementation).toContain('image: v.file()');
    });

    it('validates a part with a text contentMediaType as a file or a string', async () => {
      const implementation = await multipart({
        notes: { type: 'string', contentMediaType: 'text/plain' },
      });
      expect(implementation).toContain(
        'notes: v.union([v.file(), v.string()])',
      );
    });

    it('lets encoding.contentType decide the part', async () => {
      const implementation = await multipart(
        {
          avatar: { type: 'string' },
          notes: { type: 'string', contentMediaType: 'image/png' },
          plain: { type: 'string' },
        },
        {
          avatar: { contentType: 'image/png' },
          notes: { contentType: 'text/csv' },
        },
      );
      expect(implementation).toContain('avatar: v.file()');
      expect(implementation).toContain(
        'notes: v.union([v.file(), v.string()])',
      );
      expect(implementation).toContain('plain: v.string()');
    });

    it('keeps the optional and nullable wrappers of a file part', async () => {
      const implementation = await multipart(
        {
          notes: { type: ['string', 'null'] },
          image: { type: 'string', description: 'The image.' },
          scan: { type: ['string', 'null'] },
        },
        {
          notes: { contentType: 'text/csv' },
          image: { contentType: 'image/png' },
          scan: { contentType: 'image/png' },
        },
        ['scan'],
      );
      expect(implementation).toContain(
        'notes: v.optional(v.nullable(v.union([v.file(), v.string()])))',
      );
      expect(implementation).toContain(
        "image: v.optional(v.pipe(v.file(), v.description('The image.')))",
      );
      expect(implementation).toContain('scan: v.nullable(v.file())');
    });

    it('keeps the checks of the string a text part may be', async () => {
      const implementation = await multipart(
        {
          kind: { type: 'string', enum: ['a', 'b'] },
          code: { type: 'string', format: 'email', description: 'The code.' },
        },
        {
          kind: { contentType: 'text/csv' },
          code: { contentType: 'text/csv' },
        },
      );
      expect(implementation).toContain(
        "kind: v.union([v.file(), v.picklist(['a', 'b'])])",
      );
      expect(implementation).toContain(
        "code: v.union([v.file(), v.pipe(v.string(), v.email(), v.description('The code.'))])",
      );
    });

    it('drops the string checks of a binary part', async () => {
      const implementation = await multipart(
        { image: { type: 'string', maxLength: 5, pattern: '^a' } },
        { image: { contentType: 'image/png' } },
      );
      expect(implementation).toContain('image: v.file()');
    });

    it('leaves other parts alone', async () => {
      const implementation = await multipart(
        {
          name: { type: 'string', maxLength: 5 },
          encoded: { type: 'string', contentEncoding: 'base64' },
          tags: { type: 'array', items: { type: 'string' } },
          meta: { type: 'object', properties: { a: { type: 'string' } } },
        },
        {
          encoded: { contentType: 'image/png' },
          meta: { contentType: 'application/json' },
        },
      );
      expect(implementation).toContain('name: v.pipe(v.string()');
      expect(implementation).toContain(
        'encoded: v.pipe(v.string(), v.base64())',
      );
      expect(implementation).toContain('tags: v.array(v.string())');
      expect(implementation).toContain('meta: v.object({');
    });

    it('turns the items of an array part into files', async () => {
      const implementation = await multipart(
        {
          images: { type: 'array', items: { type: 'string' } },
          scans: {
            type: 'array',
            items: { type: 'string', contentMediaType: 'image/png' },
          },
          notes: { type: 'array', items: { type: 'string' } },
        },
        {
          images: { contentType: 'image/png' },
          notes: { contentType: 'text/csv' },
        },
      );
      expect(implementation).toContain('images: v.array(v.file())');
      expect(implementation).toContain('scans: v.array(v.file())');
      expect(implementation).toContain(
        'notes: v.array(v.union([v.file(), v.string()]))',
      );
    });

    it('keeps a binary string a file whatever the encoding says', async () => {
      const implementation = await multipart(
        { f: { type: 'string', format: 'binary' } },
        { f: { contentType: 'text/csv' } },
      );
      expect(implementation).toContain('f: v.file()');
    });

    it('leaves a read-only part out of a request', async () => {
      const implementation = await multipart({
        id: { type: 'string', contentMediaType: 'image/png', readOnly: true },
        image: { type: 'string', contentMediaType: 'image/png' },
      });
      expect(implementation).not.toContain('id:');
      expect(implementation).toContain('image: v.file()');
    });

    it('does not reach the parts of a body made with allOf', async () => {
      const implementation = await run(
        {},
        {
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  allOf: [
                    {
                      type: 'object',
                      properties: {
                        image: {
                          type: 'string',
                          contentMediaType: 'image/png',
                        },
                      },
                    },
                  ],
                },
              },
            },
          } as OpenApiRequestBodyObject,
        },
      );
      expect(implementation).toContain('image: v.optional(v.string())');
    });

    it('ignores a content type that is not a string or is inherited', async () => {
      const implementation = await multipart(
        Object.fromEntries([
          ['a', { type: 'string' }],
          ['constructor', { type: 'string' }],
        ] as const),
        { a: { contentType: 5 } },
      );
      expect(implementation).toContain('a: v.string()');
      expect(implementation).toContain('constructor: v.string()');
    });

    it('accepts a file and rejects a string for a binary part', async () => {
      const implementation = await multipart(
        {
          image: { type: 'string' },
          notes: { type: ['string', 'null'], maxLength: 3 },
        },
        {
          image: { contentType: 'image/png' },
          notes: { contentType: 'text/csv' },
        },
        ['image'],
      );
      const body = implementation
        .split('\n\n')
        .find((part) => part.startsWith('export const ListPetsBody = '));
      const schema = runInNewContext(
        (body ?? '').replace('export const ListPetsBody = ', ''),
        { v, File },
      ) as v.GenericSchema;
      const ok = (input: unknown) => v.safeParse(schema, input).success;
      const file = new File(['x'], 'a.png');
      expect(ok({ image: file })).toBe(true);
      expect(ok({ image: file, notes: 'a,b' })).toBe(true);
      expect(ok({ image: file, notes: new File(['a,b'], 'a.csv') })).toBe(true);
      expect(ok({ image: file, notes: null })).toBe(true);
      expect(ok({ image: file, notes: 'a,b,c' })).toBe(false);
      expect(ok({ image: 'a.png' })).toBe(false);
      expect(ok({ image: file, notes: 5 })).toBe(false);
    });

    it('does not apply the encoding to a url-encoded body', async () => {
      const implementation = await run(
        {},
        {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                required: ['a'],
                properties: { a: { type: 'string' } },
              },
              encoding: { a: { contentType: 'image/png' } },
            },
          } as OpenApiResponseObject['content'],
        },
      );
      expect(implementation).toContain('a: v.string()');
    });
  });

  describe('readOnly', () => {
    const pet: OpenApiSchemaObject = {
      type: 'object',
      required: ['id', 'name'],
      properties: {
        id: { type: 'integer', readOnly: true },
        name: { type: 'string' },
      },
    };

    it('leaves a read-only property out of a request body', async () => {
      const implementation = await run(pet, {
        requestBody: { content: { 'application/json': { schema: pet } } },
      });
      expect(implementation).toContain(
        'ListPetsBody = v.object({\n  name: v.string()\n})',
      );
    });

    it('keeps it in a response', async () => {
      expect(await run(pet)).toContain('id: v.pipe(v.number(), v.integer())');
    });

    it('leaves it out of a referenced body, with its required entry', async () => {
      const implementation = await run(pet, {
        components: { Pet: pet },
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Pet' },
              },
            },
          },
        },
      });
      expect(implementation).toContain(
        'ListPetsBody = v.array(v.object({\n  name: v.string()\n}))',
      );
    });
  });

  describe('references', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('validates a $ref to false as never', async () => {
      const implementation = await run(
        {
          type: 'object',
          properties: { a: { $ref: '#/components/schemas/Nothing' } },
        },
        { components: { Nothing: false } },
      );
      expect(implementation).toContain('a: v.optional(v.never())');
    });

    it('does not warn about a $ref in a vendor extension', async () => {
      resetWarnings();
      const warn = vi.spyOn(logger, 'warn');
      await run({
        type: 'string',
        'x-link': { $ref: '#/components/schemas/Missing' },
      } as OpenApiSchemaObject);
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns about a $ref that cannot be resolved', async () => {
      resetWarnings();
      const warn = vi.spyOn(logger, 'warn');
      const implementation = await run({
        type: 'object',
        properties: { a: { $ref: '#/components/schemas/Missing' } },
      });
      expect(implementation).toContain('a: v.optional(v.unknown())');
      expect(warn).toHaveBeenCalledWith(
        'Unresolvable $ref "#/components/schemas/Missing" is validated as unknown.',
      );
    });
  });
});
