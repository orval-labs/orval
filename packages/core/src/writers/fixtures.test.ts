import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import {
  type GeneratorOperation,
  type GeneratorVerbOptions,
  type OpenApiDocument,
  OutputMockType,
} from '../types';
import { buildFixtures, getFixtureRoutes } from './fixtures';

const spec = {
  openapi: '3.1.0',
  info: { title: 'test', version: '1.0.0' },
  servers: [{ url: 'https://petstore.test/v1' }],
  paths: {
    '/pets/{pet_id}': {
      get: {
        parameters: [{ name: 'pet_id', in: 'path', required: true }],
        responses: {},
      },
      delete: {
        parameters: [{ name: 'pet_id', in: 'path', required: true }],
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
    pathRoute: '/pets/{pet_id}',
    tags: [],
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
      types: { success: [{ key: '200' }], errors: [] },
      contentTypes: [],
      schemas: [],
    },
    deprecated: false,
    ...overrides,
  }) as unknown as GeneratorVerbOptions;

const operation = (name: string, mock: string | null) =>
  ({
    operationName: name,
    tags: [],
    imports: [],
    implementation: 'x',
    mockOutputs: [
      {
        type: OutputMockType.FAKER,
        implementation: {
          function: mock ? `export const ${mock} = (): Pet => ({});\n` : '',
          handler: '',
          handlerName: '',
        },
        imports: [],
      },
    ],
  }) as unknown as GeneratorOperation;

const removePet = verbOptions({
  verb: 'delete',
  operationId: 'removePet',
  operationName: 'removePet',
  response: {
    definition: { success: 'void', errors: 'Error' },
    imports: [{ name: 'Error' }],
    isBlob: false,
    types: { success: [{ key: '204' }], errors: [] },
    contentTypes: [],
    schemas: [],
  } as unknown as GeneratorVerbOptions['response'],
});

const builder = {
  operations: {
    showPet: operation('showPet', 'getShowPetResponseMock'),
    removePet: operation('removePet', null),
  },
  verbOptions: {},
  operationVerbOptions: [verbOptions(), removePet],
  spec,
  target: 'spec.yaml',
};

describe('getFixtureRoutes', () => {
  it('keys routes by method and path, with the generated param keys', () => {
    const { output } = createTestContextSpec({
      spec,
      output: { baseUrl: { getBaseUrlFromSpecification: true } },
    });

    expect(
      getFixtureRoutes(builder, output).map(
        ({ route, mock, status, params }) => ({ route, mock, status, params }),
      ),
    ).toEqual([
      // The absolute base URL keeps only its path.
      {
        route: 'DELETE /v1/pets/:petId',
        mock: null,
        status: 204,
        params: ['petId'],
      },
      {
        route: 'GET /v1/pets/:petId',
        mock: 'getShowPetResponseMock',
        status: 200,
        params: ['petId'],
      },
    ]);
  });

  it('gives every route a fixed seed', () => {
    const { output } = createTestContextSpec({ spec });
    const seeds = getFixtureRoutes(builder, output).map(({ seed }) => seed);

    expect(getFixtureRoutes(builder, output).map(({ seed }) => seed)).toEqual(
      seeds,
    );
    expect(new Set(seeds).size).toBe(seeds.length);
  });
});

describe('buildFixtures', () => {
  it('imports the mock factories and schema types it references', () => {
    const { output } = createTestContextSpec({ spec });
    const content = buildFixtures(builder, output, {
      header: '',
      filePath: '/out/index.fixtures.ts',
      fakerImportPath: './index.faker',
      relativeSchemasPath: './model',
    });

    expect(content).toContain(`import { faker } from '@faker-js/faker';`);
    expect(content).toContain(
      `import { getShowPetResponseMock } from './index.faker';`,
    );
    expect(content).toMatch(/import type \{\s*Pet\s*\} from '\.\/model';/);
    expect(content).toContain(
      '"GET /pets/:petId": { mock: getShowPetResponseMock, status: 200, seed:',
    );
    expect(content).toContain(
      '"DELETE /pets/:petId": { mock: null, status: 204',
    );
    expect(content).toContain('export const defineFixtures');
    expect(content).toContain('export const resolveFixture');
  });
});
