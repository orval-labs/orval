import type {
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiParameterObject,
  OpenApiRequestBodyObject,
  OpenApiResponseObject,
  OpenApiSchemaObject,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { generateValibot, getValibotDependencies } from '.';
import { createTestContextSpec } from '../../core/src/test-utils';

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
});
