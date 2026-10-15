import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import {
  type GeneratorOperation,
  type GeneratorVerbOptions,
  type OpenApiDocument,
  OutputMockType,
} from '../types';
import {
  buildOperationManifest,
  getOperationManifestEntry,
  getOperationManifestTypes,
} from './operation-manifest';

const spec = {
  openapi: '3.1.0',
  info: { title: 'test', version: '1.0.0' },
  servers: [{ url: 'https://petstore.test/v1' }],
  paths: {
    '/pets/{pet-id}': {
      get: {
        parameters: [
          { name: 'pet-id', in: 'path', required: true },
          {
            name: 'ids',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
          },
        ],
        responses: {},
      },
    },
  },
} as unknown as OpenApiDocument;

const verbOptions = (
  overrides: Partial<GeneratorVerbOptions> = {},
): GeneratorVerbOptions =>
  ({
    verb: 'get',
    route: '/pets/${petId}',
    pathRoute: '/pets/{pet-id}',
    tags: ['Pet Store'],
    operationId: 'showPet',
    operationName: 'showPet',
    params: [
      {
        name: 'petId',
        definition: 'petId: string',
        implementation: 'petId: string',
        default: undefined,
        required: true,
        imports: [],
      },
    ],
    queryParams: {
      schema: { name: 'ShowPetParams', model: '', imports: [] },
      deps: [],
      isOptional: true,
    },
    body: {
      definition: '',
      implementation: '',
      imports: [],
      schemas: [],
      contentType: '',
      isOptional: true,
      isBlob: false,
      originalSchema: {},
    },
    response: {
      definition: { success: 'Pet', errors: 'Error' },
      imports: [{ name: 'Pet' }, { name: 'Error' }],
      isBlob: false,
      types: { success: [], errors: [] },
      contentTypes: [],
      schemas: [],
    },
    deprecated: false,
    ...overrides,
  }) as unknown as GeneratorVerbOptions;

const operation = (
  mockFunction = 'export const getShowPetResponseMock = (): Pet => ({});\n',
): Pick<GeneratorOperation, 'operationName' | 'mockOutputs'> => ({
  operationName: 'showPet',
  mockOutputs: [
    {
      type: OutputMockType.FAKER,
      implementation: { function: mockFunction, handler: '', handlerName: '' },
      imports: [],
    },
  ],
});

describe('getOperationManifestEntry', () => {
  it('describes the operation from its verb options', () => {
    const entry = getOperationManifestEntry(
      verbOptions(),
      operation(),
      createTestContextSpec({ spec, output: { baseUrl: '/api/' } }),
    );

    expect(entry).toEqual({
      operationId: 'showPet',
      operationName: 'showPet',
      method: 'GET',
      path: '/pets/{pet-id}',
      url: '/api/pets/{pet-id}',
      // Keyed by the generated param name, so it matches the fixtures' routes.
      route: 'GET /api/pets/:petId',
      tag: 'pet-store',
      tags: ['Pet Store'],
      pathParams: [{ name: 'pet-id', key: 'petId' }],
      queryParams: ['ids'],
      serialization: {
        explode: ['ids'],
        arrayFormat: [],
        deepObject: [],
        explodeOnly: true,
      },
      body: null,
      mock: 'getShowPetResponseMock',
      deprecated: false,
    });
  });

  it('resolves the base URL from the spec servers', () => {
    const entry = getOperationManifestEntry(
      verbOptions(),
      operation(),
      createTestContextSpec({
        spec,
        output: { baseUrl: { getBaseUrlFromSpecification: true } },
      }),
    );

    expect(entry.url).toBe('https://petstore.test/v1/pets/{pet-id}');
  });

  it('leaves the url out when the base URL is only known at runtime', () => {
    const entry = getOperationManifestEntry(
      verbOptions(),
      operation(),
      createTestContextSpec({
        spec,
        output: { baseUrl: { runtime: 'process.env.API_URL' } },
      }),
    );

    expect(entry).not.toHaveProperty('url');
  });

  it.each([
    ['fetch', 'fetch', ['ids']],
    ['react-query', 'fetch', ['ids']],
    ['react-query', 'axios', []],
    // httpClient defaults to fetch, but these clients ignore fetch.arrayFormat.
    ['axios', 'fetch', []],
    ['axios-functions', 'fetch', []],
    ['angular', 'fetch', []],
  ] as const)(
    'applies override.fetch.arrayFormat only to the fetch URL builder (%s over %s)',
    (client, httpClient, arrayFormat) => {
      const context = createTestContextSpec({
        spec,
        output: {
          client,
          httpClient,
          override: { fetch: { arrayFormat: 'comma' } },
        },
      });

      const entry = getOperationManifestEntry(
        verbOptions(),
        operation(),
        context,
      );

      expect(entry.serialization.arrayFormat).toEqual(arrayFormat);
      expect(entry.serialization.explode).toEqual(
        arrayFormat.length > 0 ? [] : ['ids'],
      );
    },
  );

  it('has no mock when no generator declares the response factory', () => {
    const entry = getOperationManifestEntry(
      verbOptions(),
      // Only a sub-factory, e.g. for a void response's unused helper.
      operation('export const getShowPetResponseDogMock = () => ({});\n'),
      createTestContextSpec({ spec }),
    );

    expect(entry.mock).toBeNull();
  });

  it('describes the request body', () => {
    const entry = getOperationManifestEntry(
      verbOptions({
        verb: 'post',
        body: {
          ...verbOptions().body,
          definition: 'NewPet',
          contentType: 'application/json',
          isOptional: false,
        },
      }),
      operation(),
      createTestContextSpec({ spec }),
    );

    expect(entry.body).toEqual({
      contentType: 'application/json',
      required: true,
    });
  });
});

describe('getOperationManifestTypes', () => {
  it('references the generated types', () => {
    const { imports, ...types } = getOperationManifestTypes(verbOptions());

    expect(types).toEqual({
      pathParams: '{ petId: string }',
      query: 'ShowPetParams',
      body: 'never',
      headers: 'never',
      response: 'Pet',
      error: 'Error',
    });
    expect(imports.map((imp) => [imp.name, imp.values])).toEqual([
      ['ShowPetParams', false],
      ['Pet', false],
      ['Error', false],
    ]);
  });
});

describe('buildOperationManifest', () => {
  const context = createTestContextSpec({ spec });
  const build = (output = context.output) =>
    buildOperationManifest(
      {
        operations: {
          showPet: {
            ...operation(),
            tags: [],
            imports: [],
            implementation: 'x',
          },
        } as unknown as Record<string, GeneratorOperation>,
        verbOptions: {},
        operationVerbOptions: [verbOptions()],
        spec,
        target: 'spec.yaml',
      },
      output,
      {
        header: '',
        filePath: '/out/api.operations.ts',
        relativeSchemasPath: './model',
      },
    );

  it('writes the data and the types', () => {
    const content = build();

    expect(content).toMatch(
      /import type \{\s*Error,\s*Pet,\s*ShowPetParams,?\s*\} from '\.\/model';/,
    );
    expect(content).toContain('export const operations = {');
    expect(content).toContain('} as const;');
    expect(content).toContain(
      'export type OperationName = keyof typeof operations;',
    );
    expect(content).toContain('export type OperationTypes = {');
    expect(content).toContain('    response: Pet;');
  });

  it('writes the data only when types are off', () => {
    const content = build({
      ...context.output,
      operationManifest: { types: false },
    });

    expect(content).not.toContain('import type');
    expect(content).not.toContain('OperationTypes');
    expect(content).toContain('export const operations = {');
  });

  it('skips operations the client generated nothing for', () => {
    const content = buildOperationManifest(
      {
        operations: {},
        verbOptions: {},
        operationVerbOptions: [verbOptions()],
        spec,
        target: 'spec.yaml',
      },
      context.output,
      {
        header: '',
        filePath: '/out/api.operations.ts',
        relativeSchemasPath: '.',
      },
    );

    expect(content).toContain('export const operations = {} as const;');
  });
});
