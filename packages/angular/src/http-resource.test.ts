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

interface AngularOverride {
  provideIn: 'root' | 'any' | boolean;
  client: 'httpClient' | 'httpResource' | 'both';
  runtimeValidation: boolean;
  httpResource?: {
    defaultValue?: unknown;
    debugName?: string;
    injector?: string;
    equal?: string;
  };
}

const angularOverride = (
  client: AngularOverride['client'],
  runtimeValidation = true,
  httpResource?: AngularOverride['httpResource'],
): AngularOverride => ({
  provideIn: 'root',
  client,
  runtimeValidation,
  ...(httpResource ? { httpResource } : {}),
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
        useBrandedTypes: false,
        dateTimeOptions: {},
        timeOptions: {},
      },
      fetch: {
        includeHttpResponseReturnType: true,
        forceSuccessResponse: false,
        runtimeValidation: false,
        useRuntimeFetcher: false,
      },
      enumGenerationType: 'const',
      splitByContentType: false,
      aliasCombinedTypes: false,
      suppressReadonlyModifier: false,
      mcp: {},
    },
    client: 'angular',
    httpClient: 'angular',
    clean: false,
    docs: false,
    formatter: undefined,
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
      angular: angularOverride('httpResource'),
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
      expect(exportNames).toContain('HttpResourceOptions');
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
      expect(httpHeaders[0]?.values).toBe(true);
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

    it('filters response imports to success types only', async () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'Pet' }, { name: 'Error' }],
          definition: { success: 'Pet', errors: 'Error' },
        }),
      });

      const result = await generateHttpResourceClient(
        verbOption,
        createGeneratorOptions({ route: '/api/pets/${petId}' }),
        'angular',
        createOutput(),
      );

      const importNames = result.imports.map((imp) => imp.name);
      expect(importNames).toContain('Pet');
      expect(importNames).not.toContain('Error');
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

      // Should fall back to the verbOption.route (URL-only form for simple GET)
      expect(header).toContain('`/pets/${petId()}`');
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
      expect(header).toContain(
        'options?: OrvalHttpResourceOptions<Pet, unknown>',
      );
      expect(header).toContain('HttpResourceRef<Pet | undefined>');
      // Simple GET with only path params uses the URL-only form
      expect(header).toContain('`/api/pets/${petId()}`');
      expect(header).not.toContain('url:');
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

    it('scopes generated resources by tag when tag is provided', () => {
      const petsVerb = createVerbOption({
        tags: ['Pets'],
      });
      const healthVerb = createVerbOption({
        operationId: 'getHealth',
        operationName: 'getHealth',
        route: '/health',
        pathRoute: '/health',
        tags: ['Health'],
        params: [],
        props: [],
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');
      routeRegistry.set('getHealth', '/api/health');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: {
          getPetById: petsVerb,
          getHealth: healthVerb,
        },
        tag: 'health',
        clientImplementation: '',
      } as never);

      expect(header).toContain('export function getHealthResource');
      expect(header).not.toContain('export function getPetByIdResource');
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

    it('uses optional chaining for optional retrieval POST bodies', () => {
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
          isOptional: true,
        },
        props: [
          {
            name: 'searchPetsBody',
            definition: 'searchPetsBody?: SearchPetsBody',
            implementation: 'searchPetsBody?: SearchPetsBody',
            default: false,
            required: false,
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

      expect(header).toContain('searchPetsBody?: Signal<SearchPetsBody>');
      expect(header).toContain('body: searchPetsBody?.()');
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

    it('emits Accept helpers for multi-content mutations', () => {
      const verbOption = createVerbOption({
        operationId: 'updatePetById',
        operationName: 'updatePetById',
        verb: 'put',
        route: '/pets/${petId}',
        pathRoute: '/pets/{petId}',
        body: {
          implementation: 'updatePetByIdBody',
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
            name: 'petId',
            definition: 'petId: string',
            implementation: 'petId: string',
            default: false,
            required: true,
            type: GetterPropType.PARAM,
          },
          {
            name: 'updatePetByIdBody',
            definition: 'updatePetByIdBody: CreatePetBody',
            implementation: 'updatePetByIdBody: CreatePetBody',
            default: false,
            required: true,
            type: GetterPropType.BODY,
          },
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
        response: baseResponse({
          definition: { success: 'Pet | string', errors: 'Error' },
          types: {
            success: [
              createSuccessType('Pet', 'application/json'),
              createSuccessType('string', 'text/plain'),
            ],
            errors: [],
          },
          contentTypes: ['application/json', 'text/plain'],
        }),
      });
      routeRegistry.set('updatePetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { updatePetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('export type UpdatePetByIdAccept');
      expect(header).toContain("accept: 'application/json'");
      expect(header).toContain("accept: 'text/plain'");
      expect(header).toContain(
        "accept: UpdatePetByIdAccept = 'application/json'",
      );
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

    it('emits filterParams helper only once for mixed resource and mutation query params', () => {
      const getVerb = createVerbOption({
        queryParams: {
          schema: { name: 'ListPetsParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          name: 'params',
          definition: 'params: ListPetsParams',
          implementation: 'params: ListPetsParams',
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
            definition: 'params: ListPetsParams',
            implementation: 'params: ListPetsParams',
            default: false,
            required: false,
            type: GetterPropType.QUERY_PARAM,
          },
        ],
      });
      const postVerb = createVerbOption({
        operationId: 'createPet',
        operationName: 'createPet',
        verb: 'post',
        route: '/pets',
        pathRoute: '/pets',
        queryParams: {
          schema: { name: 'CreatePetParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          name: 'params',
          definition: 'params: CreatePetParams',
          implementation: 'params: CreatePetParams',
          default: false,
          required: false,
          type: GetterPropType.QUERY_PARAM,
        } as never,
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
          {
            name: 'params',
            definition: 'params: CreatePetParams',
            implementation: 'params: CreatePetParams',
            default: false,
            required: false,
            type: GetterPropType.QUERY_PARAM,
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

      expect(header.match(/type AngularHttpParamValue =/g)).toHaveLength(1);
      expect(header.match(/function filterParams\(/g)).toHaveLength(3);
    });
  });

  // ─── Tag scoping (modes: tags, tags-split) ────────────────────────

  describe('tag scoping', () => {
    // https://github.com/orval-labs/orval/issues/3209 — in `tags`/`tags-split`
    // modes each tag file is written with per-tag imports; emitting every
    // operation's resource into every tag file caused the file-local import
    // filter to drop the types that came from other tags' operations.
    it('restricts retrievals and mutations to the requested tag', () => {
      const petsVerb = createVerbOption({
        operationId: 'getPetById',
        operationName: 'getPetById',
        tags: ['pets'],
        route: '/pets/${petId}',
      });
      const healthVerb = createVerbOption({
        operationId: 'healthCheck',
        operationName: 'healthCheck',
        tags: ['health'],
        verb: 'get',
        route: '/health',
        params: [],
        props: [],
        response: baseResponse({
          definition: { success: 'string', errors: 'Error' },
          types: {
            success: [createSuccessType('string', 'text/plain')],
            errors: [],
          },
          isBlob: false,
        }),
      });
      const petsMutation = createVerbOption({
        operationId: 'createPet',
        operationName: 'createPet',
        tags: ['pets'],
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
        params: [],
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
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');
      routeRegistry.set('healthCheck', '/api/health');
      routeRegistry.set('createPet', '/api/pets');

      const petsHeader = generateHttpResourceHeader({
        title: 'PetsService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: {
          getPetById: petsVerb,
          healthCheck: healthVerb,
          createPet: petsMutation,
        },
        tag: 'pets',
        clientImplementation: '',
      } as never);

      expect(petsHeader).toContain('getPetByIdResource');
      expect(petsHeader).toContain('createPet');
      expect(petsHeader).not.toContain('healthCheckResource');
    });

    it('only emits resources belonging to the requested tag', () => {
      const petsVerb = createVerbOption({
        operationId: 'getPetById',
        operationName: 'getPetById',
        tags: ['pets'],
        route: '/pets/${petId}',
      });
      const healthVerb = createVerbOption({
        operationId: 'healthCheck',
        operationName: 'healthCheck',
        tags: ['health'],
        verb: 'get',
        route: '/health',
        params: [],
        props: [],
        response: baseResponse({
          definition: { success: 'string', errors: 'Error' },
          types: {
            success: [createSuccessType('string', 'text/plain')],
            errors: [],
          },
          isBlob: false,
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');
      routeRegistry.set('healthCheck', '/api/health');

      const healthHeader = generateHttpResourceHeader({
        title: 'HealthService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: petsVerb, healthCheck: healthVerb },
        tag: 'health',
        clientImplementation: '',
      } as never);

      expect(healthHeader).toContain('healthCheckResource');
      expect(healthHeader).not.toContain('getPetByIdResource');
      expect(healthHeader).not.toContain('Pet');
    });

    it('matches tags case-insensitively (camelCase comparison)', () => {
      const verbOption = createVerbOption({
        tags: ['Pet Store'],
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const header = generateHttpResourceHeader({
        title: 'PetStoreService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: verbOption },
        tag: 'pet-store',
        clientImplementation: '',
      } as never);

      expect(header).toContain('getPetByIdResource');
    });

    it('falls back to all verb options when no tag is provided', () => {
      const petsVerb = createVerbOption({
        operationId: 'getPetById',
        operationName: 'getPetById',
        tags: ['pets'],
        route: '/pets/${petId}',
      });
      const healthVerb = createVerbOption({
        operationId: 'healthCheck',
        operationName: 'healthCheck',
        tags: ['health'],
        verb: 'get',
        route: '/health',
        params: [],
        props: [],
        response: baseResponse({
          definition: { success: 'string', errors: 'Error' },
          types: {
            success: [createSuccessType('string', 'text/plain')],
            errors: [],
          },
          isBlob: false,
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');
      routeRegistry.set('healthCheck', '/api/health');

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: { getPetById: petsVerb, healthCheck: healthVerb },
        clientImplementation: '',
      } as never);

      expect(header).toContain('getPetByIdResource');
      expect(header).toContain('healthCheckResource');
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

      expect(header).toContain('export type GetPetByIdAccept');
      expect(header).toContain("accept: 'text/plain'");
      expect(header).toContain("accept: 'application/json'");
      expect(header).toContain("accept: GetPetByIdAccept = 'application/json'");
      expect(header).toContain('httpResource<Pet>');
      expect(header).toContain('httpResource.text<string>');
      expect(header).toContain('Accept: accept');
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
      expect(header).toContain(
        'options?: OrvalHttpResourceOptions<Pet, unknown>',
      );
      expect(header).toContain('params: filterParams(params?.() ?? {}');
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

    it('supports caller-provided defaultValue overloads', () => {
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

      expect(header).toContain(
        'options: OrvalHttpResourceOptions<Pet, unknown> & { defaultValue: NoInfer<Pet> }',
      );
      expect(header).toContain(
        'options?: OrvalHttpResourceOptions<Pet, unknown>): HttpResourceRef<Pet | undefined>;',
      );
    });
  });

  // ─── URL-only form for simple GETs ────────────────────────────────

  describe('URL-only form', () => {
    it('uses URL-only form for simple GET with only path params', () => {
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

      // URL-only: no request object, no "const request"
      expect(header).toContain(
        'httpResource<Pet>(() => `/api/pets/${petId()}`, options)',
      );
      expect(header).not.toContain('const request');
    });

    it('uses request object form when query params are present', () => {
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

      expect(header).toContain('url: `/api/pets/${petId()}`');
      expect(header).toContain('params: filterParams(params?.() ?? {}');
    });

    it('uses request object form for POST verbs', () => {
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

      expect(header).toContain("method: 'POST'");
      expect(header).toContain('const request');
    });

    it('uses request object form when mutator is present', () => {
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

      // Mutators need the request object to transform
      expect(header).toContain('const request');
      expect(header).toContain('return customHttpRequest(request)');
    });
  });

  // ─── Zod parse option ─────────────────────────────────────────────

  describe('zod parse option', () => {
    it('includes parse option when explicit isZodSchema flag is set', () => {
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

      expect(header).toContain('parse: PetSchema.parse');
    });

    it('auto-detects zod parse when schemas.type is zod', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'Pet' }],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('parse: Pet.parse');
    });

    it('does not add parse when schemas.type is not zod', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'Pet' }],
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

      expect(header).not.toContain('parse:');
    });

    it('does not add parse for primitive response types with zod', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          definition: { success: 'string', errors: 'Error' },
          types: {
            success: [createSuccessType('string', 'text/plain')],
            errors: [],
          },
          contentTypes: ['text/plain'],
          imports: [{ name: 'string' }],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).not.toContain('parse:');
    });

    it('does not add parse for non-JSON response factories', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          definition: { success: 'Blob', errors: 'Error' },
          types: {
            success: [createSuccessType('Blob', 'image/png')],
            errors: [],
          },
          contentTypes: ['image/png'],
          isBlob: true,
          imports: [{ name: 'Blob' }],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).not.toContain('parse:');
    });

    it('does not add parse when response type has no matching import', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          // No imports — the response type doesn't resolve to a zod schema
          imports: [],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).not.toContain('parse:');
    });

    it('does not add parse when runtimeValidation is explicitly false', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'Pet' }],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
        override: {
          ...createOutput().override,
          angular: angularOverride('httpResource', false),
        },
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).not.toContain('parse:');
    });

    it('still adds parse with explicit isZodSchema even when runtimeValidation is false', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'PetSchema', isZodSchema: true } as never],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        override: {
          ...createOutput().override,
          angular: angularOverride('httpResource', false),
        },
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      // Explicit isZodSchema flag bypasses the runtimeValidation toggle
      expect(header).toContain('parse: PetSchema.parse');
    });

    it('combines parse and configured httpResource options', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'Pet' }],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
        override: {
          ...createOutput().override,
          angular: angularOverride('httpResource', true, {
            defaultValue: { id: 'fallback' },
            debugName: 'getPetByIdResource',
          }),
        },
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('parse: Pet.parse');
      expect(header).toContain('defaultValue: {"id":"fallback"}');
      expect(header).toContain('debugName: "getPetByIdResource"');
    });
  });

  describe('httpResource options', () => {
    it('supports global defaultValue/debugName/injector/equal options', () => {
      const verbOption = createVerbOption();
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        override: {
          ...createOutput().override,
          angular: angularOverride('httpResource', true, {
            defaultValue: { id: 'fallback' },
            debugName: 'getPetByIdResource',
            injector: 'inject(Injector)',
            equal: '(a, b) => a?.id === b?.id',
          }),
        },
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('HttpResourceRef<Pet>');
      expect(header).not.toContain('HttpResourceRef<Pet | undefined>');
      expect(header).toContain(
        'options?: OrvalHttpResourceOptions<Pet, unknown>',
      );
      expect(header).toContain('defaultValue: {"id":"fallback"}');
      expect(header).toContain('debugName: "getPetByIdResource"');
      expect(header).toContain('injector: inject(Injector)');
      expect(header).toContain('equal: (a, b) => a?.id === b?.id');
    });

    it('prefers operation-level httpResource options over global options', () => {
      const baseVerbOption = createVerbOption();
      const verbOption = createVerbOption({
        override: {
          ...baseVerbOption.override,
          operations: {
            ...baseVerbOption.override.operations,
            getPetById: {
              angular: {
                provideIn: 'root',
                client: 'httpResource',
                runtimeValidation: true,
                httpResource: {
                  debugName: 'operation-level',
                },
              },
            },
          },
          angular: angularOverride('httpResource', true),
        } as GeneratorVerbOptions['override'],
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        override: {
          ...createOutput().override,
          angular: angularOverride('httpResource', true, {
            debugName: 'global-level',
          }),
        },
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('debugName: "operation-level"');
      expect(header).not.toContain('debugName: "global-level"');
    });

    it('emits the shared httpResource options helper type', () => {
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

      expect(header).toContain('export type OrvalHttpResourceOptions');
      expect(header).toContain('TOmitParse extends boolean = false');
      expect(header).toContain(': HttpResourceOptions<TValue, TRaw>;');
    });

    it('omits parse from resource options when generating Zod-backed resources', () => {
      const verbOption = createVerbOption();
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain('TOmitParse extends boolean = true');
      expect(header).toContain(
        "? Omit<HttpResourceOptions<TValue, TRaw>, 'parse'>",
      );
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

      expect(header).toContain('GetPetByIdResourceResult');
      expect(header).toContain('NonNullable<Pet>');
    });

    it('emits Zod output types in ResourceResult aliases', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'Pet' }],
        }),
      });
      routeRegistry.set('getPetById', '/api/pets/${petId}');

      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain(
        'export type GetPetByIdResourceResult = NonNullable<PetOutput>',
      );
    });

    it('emits Zod output unions in multi-content ResourceResult aliases', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          definition: { success: 'string | Pet', errors: 'Error' },
          imports: [{ name: 'Pet' }],
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

      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
      });

      const header = generateHttpResourceHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output,
        verbOptions: { getPetById: verbOption },
        clientImplementation: '',
      } as never);

      expect(header).toContain(
        'export type GetPetByIdResourceResult = NonNullable<string | PetOutput>',
      );
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

    it('generates per-tag .resource.ts files in both tags-split mode', async () => {
      const petsVerb = createVerbOption({
        tags: ['Pets'],
      });
      const healthVerb = createVerbOption({
        operationId: 'getHealth',
        operationName: 'getHealth',
        route: '/health',
        pathRoute: '/health',
        tags: ['Health'],
        params: [],
        props: [],
      });
      const postVerb = createVerbOption({
        operationId: 'createPet',
        operationName: 'createPet',
        verb: 'post',
        route: '/pets',
        pathRoute: '/pets',
        tags: ['Pets'],
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
        target: '/tmp/endpoints.ts',
        mode: 'tags-split',
        override: {
          ...createOutput().override,
          angular: {
            ...angularOverride('both'),
          },
        },
      });

      const context = createContextSpec(output, {
        workspace: '/tmp',
        target: '/tmp/endpoints.ts',
        projectName: 'pets',
      });

      const extraFiles = await generateHttpResourceExtraFiles(
        {
          getPetById: petsVerb,
          getHealth: healthVerb,
          createPet: postVerb,
        },
        output,
        context,
      );

      expect(extraFiles.map((file) => file.path).toSorted()).toEqual([
        '/tmp/health/health.resource.ts',
        '/tmp/pets/pets.resource.ts',
      ]);

      const petsFile = extraFiles.find(
        (file) => file.path === '/tmp/pets/pets.resource.ts',
      );
      const healthFile = extraFiles.find(
        (file) => file.path === '/tmp/health/health.resource.ts',
      );

      expect(petsFile?.content).toContain('getPetByIdResource');
      expect(petsFile?.content).not.toContain('getHealthResource');
      expect(petsFile?.content).not.toContain('createPet');
      expect(healthFile?.content).toContain('getHealthResource');
      expect(healthFile?.content).not.toContain('getPetByIdResource');
    });
  });
});
