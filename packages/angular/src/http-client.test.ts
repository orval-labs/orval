import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
  NormalizedOutputOptions,
  ResReqTypesValue,
} from '@orval/core';
import { GetterPropType } from '@orval/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { ANGULAR_HTTP_CLIENT_DEPENDENCIES } from './constants';
import {
  generateAngular,
  generateAngularFooter,
  generateAngularHeader,
  generateHttpClientImplementation,
  getAngularDependencies,
  getHttpClientReturnTypes,
  resetHttpClientReturnTypes,
} from './http-client';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type AngularOverride = {
  provideIn: 'root' | 'any' | boolean;
  client: 'httpClient' | 'httpResource' | 'both';
};

const angularOverride = {
  provideIn: 'root',
  client: 'httpClient',
} satisfies AngularOverride;

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
      angular: angularOverride,
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
): GeneratorVerbOptions =>
  ({
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
    } as GeneratorVerbOptions['override'],
    deprecated: false,
    originalOperation: {} as GeneratorVerbOptions['originalOperation'],
    ...overrides,
  }) as GeneratorVerbOptions;

const createContextSpec = (output: NormalizedOutputOptions): ContextSpec => {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('angular HttpClient generator', () => {
  beforeEach(() => {
    resetHttpClientReturnTypes();
  });

  // ── Dependencies ──────────────────────────────────────────────────────

  describe('getAngularDependencies', () => {
    it('returns the HttpClient dependency array', () => {
      const deps = getAngularDependencies(false, false);
      expect(deps).toEqual(ANGULAR_HTTP_CLIENT_DEPENDENCIES);
    });

    it('includes HttpClient, Injectable, inject, Observable', () => {
      const deps = getAngularDependencies(false, false);
      const allExports = deps.flatMap((d) => d.exports.map((e) => e.name));
      expect(allExports).toContain('HttpClient');
      expect(allExports).toContain('Injectable');
      expect(allExports).toContain('inject');
      expect(allExports).toContain('Observable');
    });
  });

  // ── Header ────────────────────────────────────────────────────────────

  describe('generateAngularHeader', () => {
    it('generates @Injectable class with provideIn root', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
      } as never);

      expect(header).toContain("@Injectable({ providedIn: 'root' })");
      expect(header).toContain('export class PetService');
      expect(header).toContain('private readonly http = inject(HttpClient)');
    });

    it('generates @Injectable without provideIn when set to false', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: false,
        hasAwaitedType: false,
      } as never);

      expect(header).toContain('@Injectable()');
      expect(header).not.toContain('providedIn');
    });

    it('generates @Injectable with custom provideIn value', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'any',
        hasAwaitedType: false,
      } as never);

      expect(header).toContain("@Injectable({ providedIn: 'any' })");
    });

    it('includes HttpClientOptions interface when isRequestOptions is true', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
      } as never);

      expect(header).toContain('interface HttpClientOptions');
      expect(header).toContain('headers?: HttpHeaders');
      expect(header).toContain('referrerPolicy?: ReferrerPolicy');
    });

    it('omits HttpClientOptions when isRequestOptions is false', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: false,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
      } as never);

      expect(header).not.toContain('interface HttpClientOptions');
    });

    it('omits HttpClientOptions when isGlobalMutator is true', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: true,
        provideIn: 'root',
        hasAwaitedType: false,
      } as never);

      expect(header).not.toContain('interface HttpClientOptions');
    });

    it('includes ThirdParameter when isMutator is true', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: true,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
      } as never);

      expect(header).toContain('type ThirdParameter');
    });

    it('omits ThirdParameter when isMutator is false', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
      } as never);

      expect(header).not.toContain('type ThirdParameter');
    });
  });

  // ── Footer ────────────────────────────────────────────────────────────

  describe('generateAngularFooter', () => {
    it('closes the class with };', () => {
      const footer = generateAngularFooter({
        operationNames: [],
        title: 'PetService',
        hasMutator: false,
        hasAwaitedType: false,
      } as never);

      expect(footer).toContain('};');
    });

    it('includes return type aliases registered during implementation', () => {
      // Generate an implementation to populate the registry
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();
      generateHttpClientImplementation(verbOption, options);

      const footer = generateAngularFooter({
        operationNames: ['getPetById'],
        title: 'PetService',
        hasMutator: false,
        hasAwaitedType: false,
      } as never);

      expect(footer).toContain(
        'export type GetPetByIdClientResult = NonNullable<Pet>',
      );
    });

    it('omits return types for unknown operation names', () => {
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();
      generateHttpClientImplementation(verbOption, options);

      const footer = generateAngularFooter({
        operationNames: ['someOtherOperation'],
        title: 'PetService',
        hasMutator: false,
        hasAwaitedType: false,
      } as never);

      expect(footer).not.toContain('ClientResult');
    });
  });

  // ── Implementation — GET ──────────────────────────────────────────────

  describe('generateHttpClientImplementation', () => {
    it('generates a GET method with typed return', () => {
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('getPetById<TData = Pet>');
      expect(impl).toContain('this.http.get<TData>');
      expect(impl).toContain('Observable<any>');
    });

    it('includes petId parameter in the method signature', () => {
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('petId: string');
    });

    it('includes HttpClientOptions parameter when requestOptions is true', () => {
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('options?: HttpClientOptions');
    });

    it('omits HttpClientOptions when requestOptions is false', () => {
      const verbOption = createVerbOption({
        override: {
          requestOptions: false,
          formData: { disabled: true, arrayHandling: 'serialize' },
          formUrlEncoded: true,
          paramsSerializerOptions: undefined,
        } as GeneratorVerbOptions['override'],
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).not.toContain('options?: HttpClientOptions');
    });

    // ── Observe overloads ─────────────────────────────────────────────

    it('generates observe overloads for body, events, and response', () => {
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain("observe?: 'body'");
      expect(impl).toContain("observe: 'events'");
      expect(impl).toContain("observe: 'response'");
      expect(impl).toContain('Observable<TData>');
      expect(impl).toContain('Observable<HttpEvent<TData>>');
      expect(impl).toContain('Observable<AngularHttpResponse<TData>>');
    });

    it('skips observe overloads when requestOptions is false', () => {
      const verbOption = createVerbOption({
        override: {
          requestOptions: false,
          formData: { disabled: true, arrayHandling: 'serialize' },
          formUrlEncoded: true,
          paramsSerializerOptions: undefined,
        } as GeneratorVerbOptions['override'],
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).not.toContain("observe?: 'body'");
      expect(impl).not.toContain("observe: 'events'");
    });

    // ── POST (mutation) ───────────────────────────────────────────────

    it('generates a POST method with body parameter', () => {
      const verbOption = createVerbOption({
        operationId: 'createPet',
        operationName: 'createPet',
        verb: 'post',
        route: '/pets',
        pathRoute: '/pets',
        params: [],
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
      });
      const options = createGeneratorOptions({ route: '/api/pets' });

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('createPet<TData = Pet>');
      expect(impl).toContain('this.http.post<TData>');
      expect(impl).toContain('createPetBody: CreatePetBody');
    });

    // ── PUT ───────────────────────────────────────────────────────────

    it('generates a PUT method', () => {
      const verbOption = createVerbOption({
        operationId: 'updatePet',
        operationName: 'updatePet',
        verb: 'put',
        route: '/pets/${petId}',
        pathRoute: '/pets/{petId}',
        body: {
          implementation: 'updatePetBody',
          definition: 'UpdatePetBody',
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
            name: 'updatePetBody',
            definition: 'updatePetBody: UpdatePetBody',
            implementation: 'updatePetBody: UpdatePetBody',
            default: false,
            required: true,
            type: GetterPropType.BODY,
          },
        ],
      });
      const options = createGeneratorOptions({
        route: '/api/pets/${petId}',
      });

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('updatePet<TData = Pet>');
      expect(impl).toContain('this.http.put<TData>');
    });

    // ── DELETE ────────────────────────────────────────────────────────

    it('generates a DELETE method', () => {
      const verbOption = createVerbOption({
        operationId: 'deletePet',
        operationName: 'deletePet',
        verb: 'delete',
        route: '/pets/${petId}',
        pathRoute: '/pets/{petId}',
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
        response: baseResponse({
          definition: { success: 'void', errors: 'Error' },
          types: {
            success: [createSuccessType('void', 'application/json')],
            errors: [],
          },
        }),
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
      });
      const options = createGeneratorOptions({
        route: '/api/pets/${petId}',
      });

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('deletePet<TData = void>');
      expect(impl).toContain('this.http.delete<TData>');
    });

    // ── Non-model types (string, Blob) ────────────────────────────────

    it('skips generic TData for string response types', () => {
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
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      // string is not a model type — no <TData> generic
      expect(impl).not.toContain('getPetById<TData');
      expect(impl).toContain('getPetById(');
      expect(impl).toContain('this.http.get(');
    });

    it('skips generic TData for Blob response types', () => {
      const verbOption = createVerbOption({
        response: baseResponse({
          definition: { success: 'Blob', errors: 'Error' },
          types: {
            success: [createSuccessType('Blob', 'application/octet-stream')],
            errors: [],
          },
          contentTypes: ['application/octet-stream'],
          isBlob: true,
        }),
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).not.toContain('getPetById<TData');
      expect(impl).toContain('this.http.get(');
    });

    // ── Multiple content types ────────────────────────────────────────

    it('generates content-type overloads for multiple response types', () => {
      const verbOption = createVerbOption({
        operationId: 'getPetFile',
        operationName: 'getPetFile',
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
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain("accept: 'application/json'");
      expect(impl).toContain("accept: 'text/plain'");
      expect(impl).toContain('Observable<Pet>');
      expect(impl).toContain('Observable<string>');
      // Content-type dispatch logic
      expect(impl).toContain("responseType: 'json'");
      expect(impl).toContain("responseType: 'text'");
      // Default accept uses JSON when available
      expect(impl).toContain("accept: string = 'application/json'");
    });

    // ── Mutator support ───────────────────────────────────────────────

    it('generates mutator-based implementation', () => {
      const verbOption = createVerbOption({
        mutator: {
          name: 'customHttpRequest',
          path: './custom-instance.ts',
          default: false,
          hasSecondArg: true,
          hasThirdArg: true,
          isHook: false,
        } as GeneratorVerbOptions['mutator'],
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('customHttpRequest<TData>');
      expect(impl).toContain('this.http');
      expect(impl).toContain(
        'options?: ThirdParameter<typeof customHttpRequest>',
      );
    });

    it('omits ThirdParameter when mutator has no third arg', () => {
      const verbOption = createVerbOption({
        mutator: {
          name: 'customHttpRequest',
          path: './custom-instance.ts',
          default: false,
          hasSecondArg: true,
          hasThirdArg: false,
          isHook: false,
        } as GeneratorVerbOptions['mutator'],
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('customHttpRequest<TData>');
      expect(impl).not.toContain('ThirdParameter');
    });

    // ── Return type registry ──────────────────────────────────────────

    it('registers ClientResult type for each operation', () => {
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();

      generateHttpClientImplementation(verbOption, options);

      const types = getHttpClientReturnTypes(['getPetById']);
      expect(types).toContain(
        'export type GetPetByIdClientResult = NonNullable<Pet>',
      );
    });

    it('uses pascal-cased operation name for the result type', () => {
      const verbOption = createVerbOption({
        operationId: 'listPets',
        operationName: 'listPets',
        route: '/pets',
        pathRoute: '/pets',
        params: [],
        props: [],
        response: baseResponse({
          definition: { success: 'Pet[]', errors: 'Error' },
        }),
      });
      const options = createGeneratorOptions({ route: '/api/pets' });

      generateHttpClientImplementation(verbOption, options);

      const types = getHttpClientReturnTypes(['listPets']);
      expect(types).toContain(
        'export type ListPetsClientResult = NonNullable<Pet[]>',
      );
    });
  });

  // ── generateAngular (full builder) ──────────────────────────────────

  describe('generateAngular', () => {
    it('returns implementation and imports', async () => {
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();

      const result = await generateAngular(
        verbOption,
        options,
        'angular',
        createOutput(),
      );

      expect(result.implementation).toContain('this.http.get');
      expect(result.imports).toBeDefined();
    });
  });

  // ── resetHttpClientReturnTypes ──────────────────────────────────────

  describe('resetHttpClientReturnTypes', () => {
    it('clears all registered return types', () => {
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();
      generateHttpClientImplementation(verbOption, options);

      // Verify registered
      expect(getHttpClientReturnTypes(['getPetById'])).toContain(
        'GetPetByIdClientResult',
      );

      // Reset
      resetHttpClientReturnTypes();

      // Verify cleared
      expect(getHttpClientReturnTypes(['getPetById'])).toBe('');
    });
  });
});
