import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiResponsesObject,
  OpenApiSchemaObject,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils/context';
import { generateZod, isPlainObjectResponseSchema } from '.';

const baseZod = createTestContextSpec().output.override.zod;

interface CaseOptions {
  responses: OpenApiResponsesObject;
  schemas?: Record<string, OpenApiSchemaObject>;
  zod?: Partial<ContextSpec['output']['override']['zod']>;
}

const makeCase = ({ responses, schemas = {}, zod = {} }: CaseOptions) => {
  const context = createTestContextSpec({
    spec: {
      paths: {
        '/x': { get: { operationId: 'getX', responses } },
      },
      components: { schemas },
    },
    override: {
      zod: {
        ...baseZod,
        ...zod,
        generate: { ...baseZod.generate, response: true, ...zod.generate },
      },
    },
  });

  const verbOptions = {
    operationId: 'getX',
    operationName: 'getX',
    typeName: 'getX',
    verb: 'get',
    pathRoute: '/x',
    override: context.output.override,
  } as unknown as GeneratorVerbOptions;

  return { verbOptions, context };
};

const jsonResponse = (
  schema: OpenApiSchemaObject | { $ref: string },
  mediaType = 'application/json',
): OpenApiResponsesObject => ({
  '200': {
    description: 'ok',
    content: { [mediaType]: { schema } },
  },
});

const simpleObject: OpenApiSchemaObject = {
  type: 'object',
  properties: { a: { type: 'string' } },
};

describe('isPlainObjectResponseSchema', () => {
  describe('returns true when the response renders as a bare zod.object', () => {
    it.each<[string, CaseOptions]>([
      [
        'inline object with properties',
        { responses: jsonResponse(simpleObject) },
      ],
      [
        '$ref to an object component',
        {
          responses: jsonResponse({ $ref: '#/components/schemas/Thing' }),
          schemas: { Thing: simpleObject },
        },
      ],
      [
        'vendor +json media type',
        { responses: jsonResponse(simpleObject, 'application/hal+json') },
      ],
      [
        '2XX status',
        {
          responses: {
            '2XX': {
              description: 'ok',
              content: { 'application/json': { schema: simpleObject } },
            },
          },
        },
      ],
      [
        '201 when there is no 200',
        {
          responses: {
            '201': {
              description: 'created',
              content: { 'application/json': { schema: simpleObject } },
            },
          },
        },
      ],
      [
        'type: object without properties (loose object)',
        { responses: jsonResponse({ type: 'object' }) },
      ],
      [
        'type: object with additionalProperties: false',
        {
          responses: jsonResponse({
            type: 'object',
            additionalProperties: false,
          }),
        },
      ],
      [
        'properties without an explicit type',
        { responses: jsonResponse({ properties: { a: { type: 'string' } } }) },
      ],
      [
        'properties alongside additionalProperties',
        {
          responses: jsonResponse({
            type: 'object',
            properties: { a: { type: 'string' } },
            additionalProperties: { type: 'string' },
          }),
        },
      ],
      [
        'self-referential object',
        {
          responses: jsonResponse({ $ref: '#/components/schemas/Node' }),
          schemas: {
            Node: {
              type: 'object',
              properties: {
                child: { $ref: '#/components/schemas/Node' },
              },
            },
          },
        },
      ],
      [
        'description on the response schema',
        {
          responses: jsonResponse({ ...simpleObject, description: 'a thing' }),
        },
      ],
      [
        'strict response schemas',
        {
          responses: jsonResponse(simpleObject),
          zod: { strict: { ...baseZod.strict, response: true } },
        },
      ],
    ])('%s', (_, options) => {
      const { verbOptions, context } = makeCase(options);
      expect(isPlainObjectResponseSchema(verbOptions, context)).toBe(true);
    });
  });

  describe('returns false when the response renders as anything else', () => {
    it.each<[string, CaseOptions]>([
      [
        'array',
        {
          responses: jsonResponse({ type: 'array', items: simpleObject }),
        },
      ],
      [
        '$ref to an array component',
        {
          responses: jsonResponse({ $ref: '#/components/schemas/Things' }),
          schemas: {
            Things: { type: 'array', items: simpleObject },
          },
        },
      ],
      [
        'oneOf with sibling properties (petstore Pet)',
        {
          responses: jsonResponse({ $ref: '#/components/schemas/Pet' }),
          schemas: {
            Pet: {
              type: 'object',
              oneOf: [
                { $ref: '#/components/schemas/Dog' },
                { $ref: '#/components/schemas/Cat' },
              ],
              properties: { id: { type: 'integer' } },
            },
            Dog: { type: 'object', properties: { bark: { type: 'boolean' } } },
            Cat: { type: 'object', properties: { meow: { type: 'boolean' } } },
          },
        },
      ],
      [
        'anyOf',
        {
          responses: jsonResponse({
            anyOf: [simpleObject, { type: 'object' }],
          }),
        },
      ],
      [
        'allOf',
        {
          responses: jsonResponse({
            allOf: [
              { $ref: '#/components/schemas/A' },
              { $ref: '#/components/schemas/B' },
            ],
          }),
          schemas: {
            A: simpleObject,
            B: { type: 'object', properties: { b: { type: 'string' } } },
          },
        },
      ],
      [
        'nullable object (OpenAPI 3.0)',
        { responses: jsonResponse({ ...simpleObject, nullable: true }) },
      ],
      [
        'nullable object (OpenAPI 3.1 type array)',
        {
          responses: jsonResponse({
            type: ['object', 'null'],
            properties: { a: { type: 'string' } },
          }),
        },
      ],
      [
        'nullable declared next to a $ref',
        {
          responses: jsonResponse({
            $ref: '#/components/schemas/Thing',
            nullable: true,
          } as OpenApiSchemaObject),
          schemas: { Thing: simpleObject },
        },
      ],
      [
        'several non-null types',
        {
          responses: jsonResponse({
            type: ['object', 'string'],
            properties: { a: { type: 'string' } },
          }),
        },
      ],
      [
        'additionalProperties schema without properties (record)',
        {
          responses: jsonResponse({
            type: 'object',
            additionalProperties: { type: 'integer' },
          }),
        },
      ],
      [
        'additionalProperties: true without properties (record)',
        {
          responses: jsonResponse({
            type: 'object',
            additionalProperties: true,
          }),
        },
      ],
      [
        'enum',
        { responses: jsonResponse({ type: 'string', enum: ['a', 'b'] }) },
      ],
      [
        'default value',
        { responses: jsonResponse({ ...simpleObject, default: {} }) },
      ],
      ['string', { responses: jsonResponse({ type: 'string' }) }],
      ['integer', { responses: jsonResponse({ type: 'integer' }) }],
      [
        'text/plain',
        { responses: jsonResponse({ type: 'string' }, 'text/plain') },
      ],
      [
        'xml only',
        { responses: jsonResponse(simpleObject, 'application/xml') },
      ],
      ['204 only', { responses: { '204': { description: 'no content' } } }],
      [
        'default only',
        {
          responses: {
            default: {
              description: 'error',
              content: { 'application/json': { schema: simpleObject } },
            },
          },
        },
      ],
      ['no responses', { responses: {} }],
      [
        '200 array wins over 201 object',
        {
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': {
                  schema: { type: 'array', items: simpleObject },
                },
              },
            },
            '201': {
              description: 'created',
              content: { 'application/json': { schema: simpleObject } },
            },
          },
        },
      ],
      [
        'generate.response disabled',
        {
          responses: jsonResponse(simpleObject),
          zod: { generate: { ...baseZod.generate, response: false } },
        },
      ],
      [
        'generateEachHttpStatus enabled',
        {
          responses: jsonResponse(simpleObject),
          zod: { generateEachHttpStatus: true },
        },
      ],
      [
        'preprocess.response set',
        {
          responses: jsonResponse(simpleObject),
          zod: {
            preprocess: {
              response: {
                path: './preprocess.ts',
                name: 'preprocess',
                default: false,
              },
            },
          },
        },
      ],
    ])('%s', (_, options) => {
      const { verbOptions, context } = makeCase(options);
      expect(isPlainObjectResponseSchema(verbOptions, context)).toBe(false);
    });
  });

  describe('agrees with what generateZod emits', () => {
    const generateResponse = async (options: CaseOptions) => {
      const { verbOptions, context } = makeCase(options);
      const generatorOptions = {
        route: '/x',
        pathRoute: '/x',
        override: context.output.override,
        context,
        output: '',
      } as GeneratorOptions;
      const { implementation } = await generateZod(
        verbOptions,
        generatorOptions,
        {} as unknown as Parameters<typeof generateZod>[2],
      );
      return {
        implementation,
        isPlainObject: isPlainObjectResponseSchema(verbOptions, context),
      };
    };

    it('emits zod.object for a plain object response', async () => {
      const { implementation, isPlainObject } = await generateResponse({
        responses: jsonResponse(simpleObject),
      });

      expect(isPlainObject).toBe(true);
      expect(implementation).toContain(
        'export const GetXResponse = zod.object(',
      );
    });

    it('emits a loose object for type: object without properties', async () => {
      const { implementation, isPlainObject } = await generateResponse({
        responses: jsonResponse({ type: 'object' }),
      });

      expect(isPlainObject).toBe(true);
      expect(implementation).toMatch(
        /export const GetXResponse = zod\.(looseObject|object)\(/,
      );
    });

    it('emits zod.record for a dictionary response', async () => {
      const { implementation, isPlainObject } = await generateResponse({
        responses: jsonResponse({
          type: 'object',
          additionalProperties: { type: 'integer' },
        }),
      });

      expect(isPlainObject).toBe(false);
      expect(implementation).toContain(
        'export const GetXResponse = zod.record(',
      );
    });

    it('emits zod.array for an array response', async () => {
      const { implementation, isPlainObject } = await generateResponse({
        responses: jsonResponse({ type: 'array', items: simpleObject }),
      });

      expect(isPlainObject).toBe(false);
      expect(implementation).toContain(
        'export const GetXResponse = zod.array(',
      );
    });

    it('emits an intersection for oneOf with sibling properties', async () => {
      const { implementation, isPlainObject } = await generateResponse({
        responses: jsonResponse({
          type: 'object',
          oneOf: [simpleObject, { type: 'object' }],
          properties: { id: { type: 'integer' } },
        }),
      });

      expect(isPlainObject).toBe(false);
      expect(implementation).toContain('export const GetXResponse = zod');
      expect(implementation).not.toContain(
        'export const GetXResponse = zod.object(',
      );
    });
  });
});
