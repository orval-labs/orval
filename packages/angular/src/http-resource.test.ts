import type {
  ContextSpec,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
  NormalizedOutputOptions,
  ResReqTypesValue,
} from '@orval/core';
import { GetterPropType } from '@orval/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetHttpClientReturnTypes } from './http-client';
import {
  generateHttpResourceClient,
  generateHttpResourceExtraFiles,
  generateHttpResourceFooter,
  generateHttpResourceHeader,
  getAngularHttpResourceDependencies,
  getAngularHttpResourceOnlyDependencies,
  routeRegistry,
} from './http-resource';

type AngularOverride = {
  provideIn: 'root' | 'any' | boolean;
  client: 'httpClient' | 'httpResource' | 'both';
};

const angularOverride = (
  client: AngularOverride['client'],
): AngularOverride => ({
  provideIn: 'root',
  client,
});

const createOutput = (
  overrides: Partial<NormalizedOutputOptions> = {},
): NormalizedOutputOptions => {
  const output = {
    target: '/tmp/pet.ts',
    schemas: '/tmp/schemas',
    operationSchemas: undefined,
    namingConvention: 'camelCase',
    fileExtension: '.ts',
    mode: 'single',
    mock: undefined,
    override: {
      operations: {},
      tags: {},
      query: {},
      jsDoc: {},
      header: false,
      hono: {
        compositeRoute: '',
        validator: true,
        validatorOutputPath: '',
      },
      formData: { disabled: true, arrayHandling: 'serialize' },
      formUrlEncoded: true,
      paramsSerializerOptions: undefined,
      requestOptions: true,
      namingConvention: {},
      components: {
        schemas: { suffix: 'Schema', itemSuffix: 'Item' },
        responses: { suffix: 'Response' },
        parameters: { suffix: 'Parameters' },
        requestBodies: { suffix: 'Body' },
      },
      angular: {
        ...angularOverride('httpResource'),
      },
      swr: {},
      zod: {
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
        coerce: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        generateEachHttpStatus: false,
        dateTimeOptions: {},
        timeOptions: {},
      },
      fetch: {
        includeHttpResponseReturnType: true,
        forceSuccessResponse: false,
        runtimeValidation: false,
      },
      enumGenerationType: 'const',
      aliasCombinedTypes: false,
      suppressReadonlyModifier: false,
    },
    client: 'angular',
    httpClient: 'angular',
    clean: false,
    docs: false,
    prettier: false,
    biome: false,
    tsconfig: {},
    packageJson: {},
    headers: false,
    indexFiles: true,
    baseUrl: undefined,
    allParamsOptional: false,
    urlEncodeParameters: false,
    optionsParamRequired: false,
    unionAddMissingProperties: false,
    propertySortOrder: 'Specification',
    ...overrides,
  } satisfies NormalizedOutputOptions;

  return output;
};

const createContextSpec = (
  output: NormalizedOutputOptions,
  overrides: Partial<ContextSpec> = {},
): ContextSpec => {
  const spec = {
    openapi: '3.1.0',
    info: { title: 'Pets', version: '1.0.0' },
    paths: {},
  } satisfies ContextSpec['spec'];

  return {
    output,
    projectName: 'pets',
    target: output.target,
    workspace: output.workspace ?? '/tmp',
    spec,
    ...overrides,
  } satisfies ContextSpec;
};

const createGeneratorOptions = (
  overrides: Partial<GeneratorOptions> = {},
): GeneratorOptions => {
  const output = createOutput();
  const options = {
    route: '/api/pets/${petId}',
    pathRoute: '/pets/{petId}',
    override: output.override,
    context: createContextSpec(output),
    output: output.target,
    ...overrides,
  } satisfies GeneratorOptions;

  return options;
};

const createSuccessType = (
  value: string,
  contentType: string,
): ResReqTypesValue => ({
  value,
  contentType,
  key: '200',
  type: value === 'string' ? 'string' : 'object',
  isEnum: false,
  hasReadonlyProps: false,
  imports: [],
  schemas: [],
  isRef: false,
  dependencies: [],
});

const baseResponse = (
  overrides: Partial<GeneratorVerbOptions['response']> = {},
): GeneratorVerbOptions['response'] =>
  ({
    imports: [],
    definition: { success: 'Pet', errors: 'Error' },
    types: {
      success: [createSuccessType('Pet', 'application/json')],
      errors: [],
    },
    contentTypes: ['application/json'],
    isBlob: false,
    schemas: [],
    ...overrides,
  }) as GeneratorVerbOptions['response'];

const createVerbOption = (
  overrides: Partial<GeneratorVerbOptions> = {},
): GeneratorVerbOptions => {
  return {
    operationId: 'getPetById',
    operationName: 'getPetById',
    verb: 'get',
    route: '/pets/${petId}',
    pathRoute: '/pets/{petId}',
    tags: [],
    summary: '',
    doc: '',
    response: baseResponse(),
    body: {
      implementation: '',
      definition: '',
      imports: [],
      schemas: [],
      originalSchema: {} as never,
      contentType: '',
      formData: '',
      formUrlEncoded: '',
      isOptional: true,
    },
    headers: undefined,
    queryParams: undefined,
    params: [
      {
        name: 'petId',
        definition: 'petId: string',
        implementation: 'petId: string',
        default: false,
        required: true,
        imports: [],
      },
    ],
    props: [
      {
        name: 'petId',
        definition: 'petId: string',
        implementation: 'petId: string',
        default: false,
        required: true,
        type: GetterPropType.PARAM,
      },
    ],
    mutator: undefined,
    formData: undefined,
    formUrlEncoded: undefined,
    paramsSerializer: undefined,
    fetchReviver: undefined,
    override: {
      requestOptions: true,
      formData: { disabled: true, arrayHandling: 'serialize' },
      formUrlEncoded: true,
      paramsSerializerOptions: undefined,
      operations: {},
    } as GeneratorVerbOptions['override'],
    deprecated: false,
    originalOperation: {} as GeneratorVerbOptions['originalOperation'],
    ...overrides,
  } as GeneratorVerbOptions;
};

describe('angular httpResource generator', () => {
  beforeEach(() => {
    routeRegistry.reset();
    resetHttpClientReturnTypes();
  });

  // ─── Dependency builders ──────────────────────────────────────────

  describe('dependencies', () => {
    it('getAngularHttpResourceDependencies merges HttpClient + httpResource deps', () => {
      const deps = getAngularHttpResourceDependencies(false, false);
      const exportNames = deps.flatMap((d) => d.exports.map((e) => e.name));

      // From HttpClient deps
      expect(exportNames).toContain('HttpClient');
      expect(exportNames).toContain('Injectable');
      expect(exportNames).toContain('Observable');
      // From httpResource deps
      expect(exportNames).toContain('httpResource');
      expect(exportNames).toContain('HttpResourceRef');
      expect(exportNames).toContain('Signal');
      expect(exportNames).toContain('ResourceStatus');
    });

    it('getAngularHttpResourceDependencies deduplicates shared exports', () => {
      const deps = getAngularHttpResourceDependencies(false, false);
      const httpPkg = deps.filter(
        (d) => d.dependency === '@angular/common/http',
      );
      // Should be merged into a single entry
      expect(httpPkg.length).toBe(1);
      // HttpHeaders appears in both ANGULAR_HTTP_CLIENT_DEPENDENCIES and ANGULAR_HTTP_RESOURCE_DEPENDENCIES
      const httpHeaders = httpPkg[0].exports.filter(
        (e) => e.name === 'HttpHeaders',
      );
      expect(httpHeaders.length).toBe(1);
    });

    it('getAngularHttpResourceOnlyDependencies returns only resource deps', () => {
      const deps = getAngularHttpResourceOnlyDependencies(false, false);
      const exportNames = deps.flatMap((d) => d.exports.map((e) => e.name));

      expect(exportNames).toContain('httpResource');
      expect(exportNames).toContain('HttpResourceRef');
      expect(exportNames).not.toContain('HttpClient');
      expect(exportNames).not.toContain('Injectable');
      expect(exportNames).not.toContain('Observable');
    });
  });

  // ─── Client builder (route registration) ──────────────────────────

  describe('generateHttpResourceClient', () => {
    it('registers routes in the route registry', async () => {
      const verbOption = createVerbOption();
      await generateHttpResourceClient(
        verbOption,
        createGeneratorOptions({ route: '/api/v1/pets/${petId}' }),
        'angular',
        createOutput(),
      );

      expect(routeRegistry.get('getPetById', '/fallback')).toBe(
        '/api/v1/pets/${petId}',
      );
    });

    it('returns verb imports', async () => {
      const verbOption = createVerbOption();
      const result = await generateHttpResourceClient(
        verbOption,
        createGeneratorOptions({ route: '/api/pets/${petId}' }),
        'angular',
        createOutput(),
      );

      expect(result.imports).toBeDefined();
    });

    it('returns empty implementation (body is built in header)', async () => {
      const verbOption = createVerbOption();
      const result = await generateHttpResourceClient(
        verbOption,
        createGeneratorOptions({ route: '/api/pets/${petId}' }),
        'angular',
        createOutput(),
      );

      expect(result.implementation.trim()).toBe('');
    });
  });

  // ─── Route registry fallback ──────────────────────────────────────

  describe('route fallback', () => {
    it('uses verbOption.route when registry has no entry', () => {
      const verbOption = createVerbOption({
        route: '/pets/${petId}',
      });
      // Do NOT set routeRegistry

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      // Should fall back to the verbOption.route
      expect(header).toContain('url: `/pets/${petId()}`');
    });
  });

  // ─── Header: resource generation ──────────────────────────────────

  describe('header generation', () => {
    it('generates httpResource function for GET endpoints', () => {
      const verbOption = createVerbOption();
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('export function getPetByIdResource');
      expect(header).toContain('petId: Signal<string>');
      expect(header).toContain('HttpResourceRef<Pet | undefined>');
      expect(header).toContain('url: `/api/pets/${petId()}`');
    });

    it('includes @experimental JSDoc annotation', () => {
      const verbOption = createVerbOption();
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('@experimental');
      expect(header).toContain('httpResource is experimental');
    });

    it('treats retrieval POST operations as httpResource functions', () => {
      const verbOption = createVerbOption({
        operationId: 'searchPets',
        operationName: 'searchPets',
        verb: 'post',
        route: '/pets/search',
        pathRoute: '/pets/search',
        body: {
          implementation: 'searchPetsBody',
          definition: 'SearchPetsBody',
          imports: [],
          schemas: [],
          originalSchema: {} as never,
          contentType: 'application/json',
          formData: '',
          formUrlEncoded: '',
          isOptional: false,
        },
        props: [
          {
            name: 'searchPetsBody',
            definition: 'searchPetsBody: SearchPetsBody',
            implementation: 'searchPetsBody: SearchPetsBody',
            default: false,
            required: true,
            type: GetterPropType.BODY,
          },
        ],
        params: [],
      });
      routeRegistry.set('searchPets', '/api/pets/search');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { searchPets: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('export function searchPetsResource');
      expect(header).toContain('httpResource<Pet>');
      expect(header).toContain("method: 'POST'");
      expect(header).toContain('body: searchPetsBody()');
    });

    it('keeps mutations in HttpClient service methods', () => {
      const verbOption = createVerbOption({
        operationId: 'createPet',
        operationName: 'createPet',
        verb: 'post',
        route: '/pets',
        pathRoute: '/pets',
        body: {
          implementation: 'createPetBody',
          definition: 'CreatePetBody',
          imports: [],
          schemas: [],
          originalSchema: {} as never,
          contentType: 'application/json',
          formData: '',
          formUrlEncoded: '',
          isOptional: false,
        },
        props: [
          {
            name: 'createPetBody',
            definition: 'createPetBody: CreatePetBody',
            implementation: 'createPetBody: CreatePetBody',
            default: false,
            required: true,
            type: GetterPropType.BODY,
          },
        ],
        params: [],
      });
      routeRegistry.set('createPet', '/api/pets');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { createPet: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('export class PetService');
      expect(header).toContain('createPet');
      expect(header).toContain('this.http.post');
    });

    it('generates both resources and service class for mixed GET + mutation', () => {
      const getVerb = createVerbOption();
      const postVerb = createVerbOption({
        operationId: 'createPet',
        operationName: 'createPet',
        verb: 'post',
        route: '/pets',
        pathRoute: '/pets',
        body: {
          implementation: 'createPetBody',
          definition: 'CreatePetBody',
          imports: [],
          schemas: [],
          originalSchema: {} as never,
          contentType: 'application/json',
          formData: '',
          formUrlEncoded: '',
          isOptional: false,
        },
        props: [
          {
            name: 'createPetBody',
            definition: 'createPetBody: CreatePetBody',
            implementation: 'createPetBody: CreatePetBody',
            default: false,
            required: true,
            type: GetterPropType.BODY,
          },
        ],
        params: [],
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');
      routeRegistry.set('createPet', '/api/pets');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: getVerb, createPet: postVerb },
        clientImplementation: '',
      } as never);

      // Resource function for GET
      expect(header).toContain('export function getPetByIdResource');
      // Service class for mutation
      expect(header).toContain('export class PetService');
      expect(header).toContain('this.http.post');
    });
  });

  // ─── Response type factories ──────────────────────────────────────

  describe('response type factories', () => {
    it('uses httpResource.text for text responses', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          definition: { success: 'string', errors: 'Error' },
          types: {
            success: [createSuccessType('string', 'text/plain')],
            errors: [],
          },
          contentTypes: ['text/plain'],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('httpResource.text<string>');
    });

    it('uses httpResource.blob for image content types', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          definition: { success: 'Blob', errors: 'Error' },
          types: {
            success: [createSuccessType('Blob', 'image/png')],
            errors: [],
          },
          contentTypes: ['image/png'],
          isBlob: true,
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('httpResource.blob<Blob>');
    });

    it('uses httpResource.arrayBuffer for octet-stream content', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          definition: { success: 'ArrayBuffer', errors: 'Error' },
          types: {
            success: [
              createSuccessType('ArrayBuffer', 'application/octet-stream'),
            ],
            errors: [],
          },
          contentTypes: ['application/octet-stream'],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('httpResource.arrayBuffer<ArrayBuffer>');
    });

    it('uses httpResource.arrayBuffer for PDF content', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          definition: { success: 'ArrayBuffer', errors: 'Error' },
          types: {
            success: [createSuccessType('ArrayBuffer', 'application/pdf')],
            errors: [],
          },
          contentTypes: ['application/pdf'],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('httpResource.arrayBuffer<ArrayBuffer>');
    });

    it('uses plain httpResource for JSON content', () => {
      const verbOption = createVerbOption();
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('httpResource<Pet>');
      expect(header).not.toContain('httpResource.text');
      expect(header).not.toContain('httpResource.blob');
      expect(header).not.toContain('httpResource.arrayBuffer');
    });

    it('prefers httpResource when JSON is available alongside text', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          definition: { success: 'string | Pet', errors: 'Error' },
          types: {
            success: [
              createSuccessType('string', 'text/plain'),
              createSuccessType('Pet', 'application/json'),
            ],
            errors: [],
          },
          contentTypes: ['text/plain', 'application/json'],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('httpResource<string | Pet>');
      expect(header).not.toContain('httpResource.text');
    });
  });

  // ─── Signal wrapping ──────────────────────────────────────────────

  describe('signal wrapping', () => {
    it('wraps query params as Signals', () => {
      const verbOption = createVerbOption({
        queryParams: {
          schema: { name: 'GetPetByIdParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          name: 'params',
          definition: 'params: GetPetByIdParams',
          implementation: 'params: GetPetByIdParams',
          default: false,
          required: false,
          type: GetterPropType.QUERY_PARAM,
        } as never,
        props: [
          {
            name: 'petId',
            definition: 'petId: string',
            implementation: 'petId: string',
            default: false,
            required: true,
            type: GetterPropType.PARAM,
          },
          {
            name: 'params',
            definition: 'params: GetPetByIdParams',
            implementation: 'params: GetPetByIdParams',
            default: false,
            required: false,
            type: GetterPropType.QUERY_PARAM,
          },
        ],
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('params?: Signal<GetPetByIdParams>');
      expect(header).toContain('params: params?.()');
    });

    it('wraps named path params with pathParams: Signal<...>', () => {
      const verbOption = createVerbOption({
        props: [
          {
            name: 'pathParams',
            definition: 'pathParams: GetPetByIdPathParams',
            implementation: 'pathParams: GetPetByIdPathParams',
            default: false,
            required: true,
            type: GetterPropType.NAMED_PATH_PARAMS,
            schema: { name: 'GetPetByIdPathParams' },
          } as never,
        ],
        params: [
          {
            name: 'petId',
            definition: 'petId: string',
            implementation: 'petId: string',
            default: false,
            required: true,
            imports: [],
          },
        ],
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('pathParams: Signal<GetPetByIdPathParams>');
      expect(header).toContain('pathParams().petId');
    });
  });

  // ─── Mutator support ──────────────────────────────────────────────

  describe('mutator support', () => {
    it('passes request through mutator function', () => {
      const verbOption = createVerbOption({
        mutator: {
          name: 'customHttpRequest',
          path: './custom-http.ts',
          default: false,
          hasSecondArg: false,
          hasThirdArg: false,
        } as GeneratorMutator,
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('return customHttpRequest(request)');
    });
  });

  // ─── Zod parse option ─────────────────────────────────────────────

  describe('zod parse option', () => {
    it('includes parse option when Zod schema import exists', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'PetSchema', isZodSchema: true } as never],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('{ parse: PetSchema.parse }');
    });
  });

  // ─── Footer ───────────────────────────────────────────────────────

  describe('footer generation', () => {
    it('emits resource utilities in footer', () => {
      const footer = generateHttpResourceFooter({
        operationNames: ['getPetById'],
        title: 'PetService',
        hasMutator: false,
        hasAwaitedType: false,
        output: createOutput(),
        outputClient: 'angular',
        titles: { implementation: 'PetService', implementationMock: '' },
      } as never);

      expect(footer).toContain('ResourceState');
      expect(footer).toContain('toResourceState');
    });

    it('emits ResourceResult type aliases after header generation', () => {
      const verbOption = createVerbOption();
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      // Header populates the resource return types registry
      generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      const footer = generateHttpResourceFooter({
        operationNames: ['getPetById'],
        title: 'PetService',
        hasMutator: false,
        hasAwaitedType: false,
        output: createOutput(),
        outputClient: 'angular',
        titles: { implementation: 'PetService', implementationMock: '' },
      } as never);

      expect(footer).toContain('GetPetByIdResourceResult');
      expect(footer).toContain('NonNullable<Pet>');
    });
  });

  // ─── Extra files (both mode) ──────────────────────────────────────

  describe('extra files', () => {
    it('generates a .resource.ts file in both mode', async () => {
      const getVerb = createVerbOption();
      const postVerb = createVerbOption({
        operationId: 'createPet',
        operationName: 'createPet',
        verb: 'post',
        route: '/pets',
        pathRoute: '/pets',
        body: {
          implementation: 'createPetBody',
          definition: 'CreatePetBody',
          imports: [],
          schemas: [],
          originalSchema: {} as never,
          contentType: 'application/json',
          formData: '',
          formUrlEncoded: '',
          isOptional: false,
        },
        props: [
          {
            name: 'createPetBody',
            definition: 'createPetBody: CreatePetBody',
            implementation: 'createPetBody: CreatePetBody',
            default: false,
            required: true,
            type: GetterPropType.BODY,
          },
        ],
        params: [],
      });

      const output = createOutput({
        target: '/tmp/pets.ts',
        override: {
          ...createOutput().override,
          angular: {
            ...angularOverride('both'),
          },
        },
      });

      const context = createContextSpec(output, {
        workspace: '/tmp',
        target: '/tmp/pets.ts',
        projectName: 'pets',
      });

      const extraFiles = await generateHttpResourceExtraFiles(
        { getPetById: getVerb, createPet: postVerb },
        output,
        context,
      );

      expect(extraFiles[0].path.endsWith('.resource.ts')).toBe(true);
      expect(extraFiles[0].content).toContain('getPetByIdResource');
      expect(extraFiles[0].content).not.toContain('createPet');
      expect(extraFiles[0].content).toContain('ResourceState');
    });
  });
});
