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
import { createQueryParams } from './test-helpers';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface AngularOverride {
  provideIn: 'root' | 'any' | boolean;
  client: 'httpClient' | 'httpResource' | 'both';
  runtimeValidation: boolean;
}

const angularOverride = {
  provideIn: 'root',
  client: 'httpClient',
  runtimeValidation: false,
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
    schemaFileExtension: '.ts',
    mode: 'single',
    mock: { indexMockFiles: false, generators: [] },
    override: {
      operations: {},
      tags: {},
      query: {},
      jsDoc: {},
      header: false,
      hono: {
        handlerGenerationStrategy: 'smart',
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
        version: 'auto',
        variant: 'classic',
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
        generateReusableSchemas: false,
        generateMeta: false,
        useBrandedTypes: false,
        dateTimeOptions: {},
        timeOptions: {},
      },
      effect: {
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
        generateEachHttpStatus: false,
        useBrandedTypes: false,
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
    tagsSplitDeduplication: false,
    commonTypesFileName: 'common-types',
    factoryMethods: {
      functionNamePrefix: 'create',
      mode: 'single',
      outputDirectory: '',
      includeOptionalProperty: false,
    },
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
      originalSchema: { type: 'object' },
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
      angular: angularOverride,
    } as GeneratorVerbOptions['override'],
    deprecated: false,
    originalOperation: {} as GeneratorVerbOptions['originalOperation'],
    ...overrides,
  }) as GeneratorVerbOptions;

const createHeaderParams = (
  overrides: Partial<Parameters<typeof generateAngularHeader>[0]> = {},
): Parameters<typeof generateAngularHeader>[0] => ({
  title: 'PetService',
  isRequestOptions: true,
  isMutator: false,
  isGlobalMutator: false,
  provideIn: 'root',
  hasAwaitedType: false,
  output: createOutput(),
  verbOptions: { getPetById: createVerbOption() },
  clientImplementation: '',
  ...overrides,
});

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
      expect(
        deps.flatMap((d) => d.exports).find((e) => e.name === 'HttpHeaders')
          ?.values,
      ).toBe(true);
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
        verbOptions: {},
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
        verbOptions: {},
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
        verbOptions: {},
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
        verbOptions: {},
      } as never);

      expect(header).toContain('interface HttpClientOptions');
      expect(header).toContain('readonly headers?: HttpHeaders');
      expect(header).toContain('readonly referrerPolicy?: ReferrerPolicy');
      expect(header).toContain('type HttpClientObserveOptions');
    });

    it('omits HttpClientOptions when isRequestOptions is false', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: false,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        verbOptions: {},
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
        verbOptions: {},
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
        verbOptions: {},
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
        verbOptions: {},
      } as never);

      expect(header).not.toContain('type ThirdParameter');
    });

    it('emits filterParams helper for untagged operations in tags-split default file (#3103)', () => {
      const verbOptionWithQueryParams = createVerbOption({
        tags: [],
        queryParams: createQueryParams({
          schema: { name: 'GetApiProductParams', model: '', imports: [] },
        }),
      });

      const header = generateAngularHeader(
        createHeaderParams({
          title: 'DefaultService',
          verbOptions: { getApiProduct: verbOptionWithQueryParams },
          tag: 'default',
        }),
      );

      expect(header).toContain('function filterParams(');
    });

    it('includes both explicit default-tagged and untagged operations in the default bucket', () => {
      const untaggedVerb = createVerbOption({
        operationId: 'getUntaggedProduct',
        tags: [],
        queryParams: createQueryParams({
          schema: { name: 'GetApiProductParams', model: '', imports: [] },
        }),
      });
      const explicitDefaultVerb = createVerbOption({
        operationId: 'getTaggedDefaultProduct',
        tags: ['default'],
      });

      const header = generateAngularHeader(
        createHeaderParams({
          title: 'DefaultService',
          verbOptions: {
            getUntaggedProduct: untaggedVerb,
            getTaggedDefaultProduct: explicitDefaultVerb,
          },
          tag: 'default',
        }),
      );

      expect(header).toContain('function filterParams(');
    });

    it('does not enable the implicit default bucket when only explicit default tags exist', () => {
      const explicitDefaultVerb = createVerbOption({
        operationId: 'getTaggedDefaultProduct',
        tags: ['default'],
      });

      const header = generateAngularHeader(
        createHeaderParams({
          title: 'DefaultService',
          verbOptions: { getTaggedDefaultProduct: explicitDefaultVerb },
          tag: 'default',
        }),
      );

      expect(header).not.toContain('function filterParams(');
    });

    // Issue #3326: a user-supplied `paramsFilter` mutator owns the filter
    // logic entirely, so the shared built-in helper would be dead code if
    // every operation overrides it.
    it('suppresses the shared filterParams helper when every operation has paramsFilter', () => {
      const verbOptionWithCustomFilter = createVerbOption({
        queryParams: createQueryParams({
          schema: { name: 'GetPetByIdParams', model: '', imports: [] },
        }),
        paramsFilter: {
          name: 'myFilter',
          path: './my-filter',
          default: false,
          hasErrorType: false,
          errorTypeName: '',
          hasSecondArg: false,
          hasThirdArg: false,
          isHook: false,
        },
      });

      const header = generateAngularHeader(
        createHeaderParams({
          title: 'PetService',
          verbOptions: { getPetById: verbOptionWithCustomFilter },
        }),
      );

      expect(header).not.toContain('function filterParams(');
    });

    it('still emits the shared helper when at least one operation lacks paramsFilter', () => {
      const verbWithFilter = createVerbOption({
        operationName: 'a',
        queryParams: createQueryParams({
          schema: { name: 'AParams', model: '', imports: [] },
        }),
        paramsFilter: {
          name: 'myFilter',
          path: './my-filter',
          default: false,
          hasErrorType: false,
          errorTypeName: '',
          hasSecondArg: false,
          hasThirdArg: false,
          isHook: false,
        },
      });
      const verbWithoutFilter = createVerbOption({
        operationName: 'b',
        queryParams: createQueryParams({
          schema: { name: 'BParams', model: '', imports: [] },
        }),
      });

      const header = generateAngularHeader(
        createHeaderParams({
          title: 'PetService',
          verbOptions: { a: verbWithFilter, b: verbWithoutFilter },
        }),
      );

      expect(header).toContain('function filterParams(');
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

  // ── paramsFilter + nonPrimitiveKeys (issue #3326) ─────────────────────

  describe('query parameter filtering (#3326)', () => {
    const customFilter = {
      name: 'myFilter',
      path: './my-filter',
      default: false,
      hasErrorType: false,
      errorTypeName: '',
      hasSecondArg: false,
      hasThirdArg: false,
      isHook: false,
    };

    it('does not emit a passthrough set without a paramsSerializer', () => {
      const verbOption = createVerbOption({
        queryParams: {
          schema: { name: 'GetPetByIdParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          originalSchema: {} as never,
          requiredNullableKeys: [],
          nonPrimitiveKeys: ['filters'],
        },
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      // Without a consumer that can handle a raw object, the passthrough set
      // would make `filterParams` return `unknown` (uncompilable against
      // HttpClient). `filters` is dropped instead. See #3326.
      expect(impl).not.toContain('new Set<string>(["filters"])');
    });

    it('passes nonPrimitiveKeys through when a paramsSerializer is configured', () => {
      const verbOption = createVerbOption({
        queryParams: {
          schema: { name: 'GetPetByIdParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          originalSchema: {} as never,
          requiredNullableKeys: [],
          nonPrimitiveKeys: ['filters'],
        },
        paramsSerializer: {
          name: 'mySerializer',
          path: './my-serializer',
          default: false,
          hasErrorType: false,
          errorTypeName: '',
          hasSecondArg: false,
          hasThirdArg: false,
          isHook: false,
        },
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      // The serializer can consume the raw object, so `filters` survives the
      // built-in filter via the passthrough set.
      expect(impl).toContain('new Set<string>(["filters"])');
    });

    it('replaces the built-in filter with the user-supplied paramsFilter', () => {
      const verbOption = createVerbOption({
        queryParams: {
          schema: { name: 'GetPetByIdParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          originalSchema: {} as never,
          requiredNullableKeys: [],
        },
        paramsFilter: customFilter,
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      // Filtered params come from `myFilter(...)`; the built-in helper is
      // not called for this operation.
      expect(impl).toContain(
        'const filteredParams = myFilter({...params, ...options?.params})',
      );
      expect(impl).not.toContain('filterParams({...params');
    });

    it('wraps a configured paramsSerializer around the custom paramsFilter', () => {
      const verbOption = createVerbOption({
        queryParams: {
          schema: { name: 'GetPetByIdParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          originalSchema: {} as never,
          requiredNullableKeys: [],
        },
        paramsFilter: customFilter,
        paramsSerializer: {
          name: 'mySerializer',
          path: './my-serializer',
          default: false,
          hasErrorType: false,
          errorTypeName: '',
          hasSecondArg: false,
          hasThirdArg: false,
          isHook: false,
        },
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain(
        'const filteredParams = mySerializer(myFilter({...params, ...options?.params}))',
      );
    });

    it('preserves required nullable params in request-options mode when a paramsSerializer is configured', () => {
      const verbOption = createVerbOption({
        queryParams: {
          schema: { name: 'GetPetByIdParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          originalSchema: {} as never,
          requiredNullableKeys: ['filters'],
        },
        paramsSerializer: {
          name: 'mySerializer',
          path: './my-serializer',
          default: false,
          hasErrorType: false,
          errorTypeName: '',
          hasSecondArg: false,
          hasThirdArg: false,
          isHook: false,
        },
      });
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain(
        'const filteredParams = mySerializer(filterParams({...params, ...options?.params}, new Set<string>(["filters"]), true))',
      );
    });
  });

  describe('generateHttpClientImplementation', () => {
    it('generates a GET method with typed return', () => {
      const verbOption = createVerbOption();
      const options = createGeneratorOptions();

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('getPetById<TData = Pet>');
      expect(impl).toContain('this.http.get<TData>');
      expect(impl).toContain('Observable<TData>');
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

      expect(impl).toContain('options?: HttpClientObserveOptions');
    });

    it('omits HttpClientOptions when requestOptions is false', () => {
      const verbOption = createVerbOption({
        override: {
          requestOptions: false,
          formData: { disabled: true, arrayHandling: 'serialize' },
          formUrlEncoded: true,
          paramsSerializerOptions: undefined,
          angular: angularOverride,
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

      expect(impl).toContain('HttpClientBodyOptions');
      expect(impl).toContain('HttpClientEventOptions');
      expect(impl).toContain('HttpClientResponseOptions');
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
          angular: angularOverride,
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
      expect(impl).toContain("responseType: 'text'");
      expect(impl).toContain('as Observable<string>');
    });

    it('emits HttpClient generic for JSON primitive string responses', () => {
      const verbOption = createVerbOption({
        operationId: 'authenticate',
        operationName: 'authenticate',
        verb: 'post',
        route: '/api/auth',
        pathRoute: '/api/auth',
        params: [],
        body: {
          implementation: 'authenticateBody',
          definition: 'AuthenticateBody',
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
            name: 'authenticateBody',
            definition: 'authenticateBody?: AuthenticateBody',
            implementation: 'authenticateBody?: AuthenticateBody',
            default: false,
            required: false,
            type: GetterPropType.BODY,
          },
        ],
        response: baseResponse({
          definition: { success: 'string', errors: 'Error' },
          types: {
            success: [createSuccessType('string', 'application/json')],
            errors: [],
          },
          contentTypes: ['application/json'],
        }),
      });
      const options = createGeneratorOptions({ route: '/api/auth' });

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).not.toContain('authenticate<TData');
      expect(impl).toContain('this.http.post<string>');
      expect(impl).toContain("if (options?.observe === 'events')");
      expect(impl).toContain("if (options?.observe === 'response')");
      expect(impl).not.toContain("responseType: 'text'");
    });

    it('casts Blob responses when responseType is injected', () => {
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
      expect(impl).toContain("responseType: 'blob'");
      expect(impl).toContain('this.http.get(');
      expect(impl).not.toContain('this.http.get<Blob>');
      expect(impl).toContain('as Observable<Blob>');
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

    it('generates accept-aware signatures for multiple response types', () => {
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

      expect(impl).toContain('accept?: GetPetFileAccept');
      expect(impl).toContain('Observable<Pet | string>');
      expect(impl).toContain('this.http.get<Pet>');
      expect(impl).toContain('as Observable<any>');
      // Content-type dispatch logic
      expect(impl).toContain("responseType: 'json'");
      expect(impl).toContain("responseType: 'text'");
      expect(impl).toContain("accept: 'application/json'");
      expect(impl).toContain("accept: 'text/plain'");
      // Default accept prefers JSON when available
      expect(impl).toContain("accept: GetPetFileAccept = 'application/json'");
    });

    it('passes request bodies for PUT operations with multiple response types', () => {
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
      const options = createGeneratorOptions({ route: '/api/pets/${petId}' });

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain(
        'this.http.put<Pet>(`/api/pets/${petId}`, updatePetBody, {',
      );
      expect(impl).toContain(
        'this.http.put(`/api/pets/${petId}`, updatePetBody, {',
      );
    });

    // Regression test for https://github.com/orval-labs/orval/issues/3349
    it('places optional body before accept in overloads for multi-content responses', () => {
      const verbOption = createVerbOption({
        operationId: 'confirmReservation',
        operationName: 'confirmReservation',
        verb: 'post',
        route: '/reservations/${token}/confirm',
        pathRoute: '/reservations/{token}/confirm',
        body: {
          implementation: 'confirmReservationBody',
          definition: 'ConfirmReservationBody',
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
            name: 'token',
            definition: 'token: string',
            implementation: 'token: string',
            default: false,
            required: true,
            type: GetterPropType.PARAM,
          },
          {
            name: 'confirmReservationBody',
            definition:
              'confirmReservationBody?: ConfirmReservationBody | null',
            implementation:
              'confirmReservationBody?: ConfirmReservationBody | null',
            default: false,
            required: false,
            type: GetterPropType.BODY,
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
      const options = createGeneratorOptions({
        route: '/api/reservations/${token}/confirm',
      });

      const impl = generateHttpClientImplementation(verbOption, options);

      // Body must come before accept in all overload and implementation signatures.
      // Check the first occurrence of each — body must appear first.
      const bodyIdx = impl.indexOf('confirmReservationBody');
      const acceptIdx = impl.indexOf("accept: 'application/json'");
      expect(bodyIdx).toBeGreaterThanOrEqual(0);
      expect(acceptIdx).toBeGreaterThanOrEqual(0);
      expect(bodyIdx).toBeLessThan(acceptIdx);

      // TS1016 regression guard: per-content-type overloads must render the
      // optional body as a positionally required parameter — the `?` is
      // dropped and the type is widened with `| undefined` so a required
      // `accept` literal can follow it. The catch-all fallback overload
      // legitimately keeps `confirmReservationBody?:` because no required
      // parameter follows it there, so we only forbid the optional body
      // form when it's directly followed by a required `accept` literal.
      expect(impl).toMatch(
        /confirmReservationBody:\s*ConfirmReservationBody\s*\|\s*null\s*\|\s*undefined,\s*\n\s*accept:\s*'/,
      );
      expect(impl).not.toMatch(
        /confirmReservationBody\?:[^\n]*\n\s*accept:\s*'/,
      );

      // The HTTP call itself must still pass the body as the positional argument
      expect(impl).toContain(
        'this.http.post<Pet>(`/api/reservations/${token}/confirm`, confirmReservationBody, {',
      );
    });

    it('places required body before accept in overloads for multi-content responses', () => {
      const verbOption = createVerbOption({
        operationId: 'updatePet',
        operationName: 'updatePet',
        verb: 'put',
        route: '/pets/${petId}',
        pathRoute: '/pets/{petId}',
        body: {
          implementation: 'pet',
          definition: 'Pet',
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
            name: 'pet',
            definition: 'pet: Pet',
            implementation: 'pet: Pet',
            default: false,
            required: true,
            type: GetterPropType.BODY,
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
      const options = createGeneratorOptions({
        route: '/api/pets/${petId}',
      });

      const impl = generateHttpClientImplementation(verbOption, options);

      // Body must come before accept in all overload and implementation signatures.
      const bodyIdx = impl.indexOf('pet: Pet');
      const acceptIdx = impl.indexOf("accept: 'application/json'");
      expect(bodyIdx).toBeGreaterThanOrEqual(0);
      expect(acceptIdx).toBeGreaterThanOrEqual(0);
      expect(bodyIdx).toBeLessThan(acceptIdx);

      // Required body must NOT be widened to `Pet | undefined`.
      expect(impl).not.toContain('Pet | undefined');

      // The HTTP call must pass the body as the positional argument.
      expect(impl).toContain('this.http.put<Pet>(`/api/pets/${petId}`, pet, {');
    });

    it('preserves query params for multi-content responses', () => {
      const verbOption = createVerbOption({
        operationId: 'listPets',
        operationName: 'listPets',
        route: '/pets',
        pathRoute: '/pets',
        params: [],
        queryParams: {
          schema: { name: 'ListPetsParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          name: 'params',
          definition: 'params?: ListPetsParams',
          implementation: 'params?: ListPetsParams',
          default: false,
          required: false,
          type: GetterPropType.QUERY_PARAM,
          requiredNullableKeys: [],
        } as never,
        props: [
          {
            name: 'params',
            definition: 'params?: ListPetsParams',
            implementation: 'params?: ListPetsParams',
            default: false,
            required: false,
            type: GetterPropType.QUERY_PARAM,
          },
        ],
        response: baseResponse({
          definition: { success: 'Pet | string', errors: 'Error' },
          types: {
            success: [
              createSuccessType('Pet', 'application/json'),
              createSuccessType('string', 'application/xml'),
            ],
            errors: [],
          },
          contentTypes: ['application/json', 'application/xml'],
        }),
      });
      const options = createGeneratorOptions({ route: '/api/pets' });

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('const filteredParams =');
      expect(impl).toContain('params: filteredParams');
    });

    it('places body in options (not positional arg) for DELETE with multiple response types', () => {
      const verbOption = createVerbOption({
        operationId: 'deletePet',
        operationName: 'deletePet',
        verb: 'delete',
        route: '/pets/${petId}',
        pathRoute: '/pets/{petId}',
        body: {
          implementation: 'deletePetBody',
          definition: 'DeletePetBody',
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
            name: 'deletePetBody',
            definition: 'deletePetBody: DeletePetBody',
            implementation: 'deletePetBody: DeletePetBody',
            default: false,
            required: true,
            type: GetterPropType.BODY,
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
      const options = createGeneratorOptions({ route: '/api/pets/${petId}' });

      const impl = generateHttpClientImplementation(verbOption, options);

      // Body must be in options, not a positional argument
      expect(impl).toContain('body: deletePetBody');
      // DELETE must NOT get a positional body argument
      expect(impl).not.toContain(
        'this.http.delete(`/api/pets/${petId}`, deletePetBody,',
      );
    });

    it('preserves query params for multi-content responses when requestOptions is false', () => {
      const verbOption = createVerbOption({
        operationId: 'listPets',
        operationName: 'listPets',
        route: '/pets',
        pathRoute: '/pets',
        params: [],
        queryParams: {
          schema: { name: 'ListPetsParams', model: '', imports: [] },
          deps: [],
          isOptional: true,
          name: 'params',
          definition: 'params?: ListPetsParams',
          implementation: 'params?: ListPetsParams',
          default: false,
          required: false,
          type: GetterPropType.QUERY_PARAM,
          requiredNullableKeys: [],
        } as never,
        props: [
          {
            name: 'params',
            definition: 'params?: ListPetsParams',
            implementation: 'params?: ListPetsParams',
            default: false,
            required: false,
            type: GetterPropType.QUERY_PARAM,
          },
        ],
        response: baseResponse({
          definition: { success: 'Pet | string', errors: 'Error' },
          types: {
            success: [
              createSuccessType('Pet', 'application/json'),
              createSuccessType('string', 'application/xml'),
            ],
            errors: [],
          },
          contentTypes: ['application/json', 'application/xml'],
        }),
        override: {
          requestOptions: false,
          formData: { disabled: true, arrayHandling: 'serialize' },
          formUrlEncoded: true,
          paramsSerializerOptions: undefined,
          angular: angularOverride,
        } as GeneratorVerbOptions['override'],
      });
      const options = createGeneratorOptions({ route: '/api/pets' });

      const impl = generateHttpClientImplementation(verbOption, options);

      // Should include inline IIFE-based param filtering (not filterParams helper)
      expect(impl).toContain('filteredParams');
      expect(impl).toContain('params:');
      // Should NOT use filterParams helper (not available when isRequestOptions=false)
      expect(impl).not.toContain('filterParams(');
    });

    it('validates Zod responses for response and event observe modes', () => {
      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
        override: {
          ...createOutput().override,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        },
      });
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'Pet' }],
        }),
        override: {
          ...createVerbOption().override,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        } as GeneratorVerbOptions['override'],
      });
      const options = {
        route: '/api/pets/${petId}',
        pathRoute: '/pets/{petId}',
        override: output.override,
        context: createContextSpec(output),
        output: output.target,
      } satisfies GeneratorOptions;

      const impl = generateHttpClientImplementation(verbOption, options);

      // The Zod validation path parses with `Pet.parse(...)` whose output type
      // is `PetOutput`. Casting that to a caller-overridable `TData` would be
      // unsound, so the generator no longer emits `as TData` on this path.
      expect(impl).toContain(
        'response.clone({ body: Pet.parse(response.body) })',
      );
      expect(impl).not.toContain('Pet.parse(response.body) as TData');
      expect(impl).toContain(
        'event instanceof AngularHttpResponse ? event.clone({ body: Pet.parse(event.body) }) : event',
      );
      expect(impl).not.toContain('Pet.parse(event.body) as TData');
    });

    it('uses Zod output types directly and drops the TData generic on validated methods', () => {
      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
        override: {
          ...createOutput().override,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        },
      });
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'Pet' }],
        }),
        override: {
          ...createVerbOption().override,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        } as GeneratorVerbOptions['override'],
      });
      const options = {
        route: '/api/pets/${petId}',
        pathRoute: '/pets/{petId}',
        override: output.override,
        context: createContextSpec(output),
        output: output.target,
      } satisfies GeneratorOptions;

      const impl = generateHttpClientImplementation(verbOption, options);
      const footer = getHttpClientReturnTypes(['getPetById']);

      // The validated method no longer exposes a `<TData>` generic because the
      // runtime value is fixed to `PetOutput` (the zod output type).
      expect(impl).not.toContain('getPetById<TData');
      expect(impl).toContain('getPetById(');
      expect(impl).toContain('Observable<PetOutput>');
      // The underlying HttpClient call is typed as `<PetOutput>` so the pipe
      // flows naturally without an `as TData` cast.
      expect(impl).toContain('this.http.get<PetOutput>');
      expect(impl).toContain('.pipe(map(data => Pet.parse(data)))');
      expect(impl).not.toContain('Pet.parse(data) as TData');
      expect(footer).toContain(
        'export type GetPetByIdClientResult = NonNullable<PetOutput>',
      );
    });

    it('uses Zod output types inside multi-content client result aliases', () => {
      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
        override: {
          ...createOutput().override,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        },
      });
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
        override: {
          ...createVerbOption().override,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        } as GeneratorVerbOptions['override'],
      });
      const options = {
        route: '/api/pets/${petId}',
        pathRoute: '/pets/{petId}',
        override: output.override,
        context: createContextSpec(output),
        output: output.target,
      } satisfies GeneratorOptions;

      const impl = generateHttpClientImplementation(verbOption, options);
      const footer = getHttpClientReturnTypes(['getPetById']);

      expect(footer).toContain(
        'export type GetPetByIdClientResult = NonNullable<string | PetOutput>',
      );
      // Multi-content signatures use per-branch accept overloads and never
      // expose a shared `<TData>` generic, regardless of validation.
      expect(impl).not.toContain('getPetById<TData');
    });

    it('drops the TData generic on validated mutation (POST) methods', () => {
      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
        override: {
          ...createOutput().override,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        },
      });
      const verbOption = createVerbOption({
        operationId: 'createPet',
        operationName: 'createPet',
        verb: 'post',
        route: '/pets',
        pathRoute: '/pets',
        params: [],
        body: {
          implementation: 'createPetBody',
          definition: 'Pet',
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
            definition: 'createPetBody: Pet',
            implementation: 'createPetBody: Pet',
            default: false,
            required: true,
            type: GetterPropType.BODY,
          },
        ],
        response: baseResponse({
          imports: [{ name: 'Pet' }],
        }),
        override: {
          ...createVerbOption().override,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        } as GeneratorVerbOptions['override'],
      });
      const options = {
        route: '/api/pets',
        pathRoute: '/pets',
        override: output.override,
        context: createContextSpec(output),
        output: output.target,
      } satisfies GeneratorOptions;

      const impl = generateHttpClientImplementation(verbOption, options);

      // Mutations with response validation share the same sound-typing path
      // as GETs: no `<TData>` generic, zod output in the signature, and no
      // `as TData` cast inside the pipe.
      expect(impl).not.toContain('createPet<TData');
      expect(impl).toContain('createPet(');
      expect(impl).toContain('Observable<PetOutput>');
      expect(impl).toContain('this.http.post<PetOutput>');
      expect(impl).toContain('.pipe(map(data => Pet.parse(data)))');
      expect(impl).not.toContain('Pet.parse(data) as TData');
    });

    it('validates Zod responses without TData when requestOptions is false', () => {
      const output = createOutput({
        schemas: {
          type: 'zod',
          path: '/tmp/schemas',
        } as NormalizedOutputOptions['schemas'],
        override: {
          ...createOutput().override,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        },
      });
      const verbOption = createVerbOption({
        response: baseResponse({
          imports: [{ name: 'Pet' }],
        }),
        override: {
          requestOptions: false,
          formData: { disabled: true, arrayHandling: 'serialize' },
          formUrlEncoded: true,
          paramsSerializerOptions: undefined,
          angular: {
            ...angularOverride,
            runtimeValidation: true,
          },
        } as GeneratorVerbOptions['override'],
      });
      const options = {
        route: '/api/pets/${petId}',
        pathRoute: '/pets/{petId}',
        override: output.override,
        context: createContextSpec(output),
        output: output.target,
      } satisfies GeneratorOptions;

      const impl = generateHttpClientImplementation(verbOption, options);

      // Covers the non-overload (`!isRequestOptions`) single-expression return
      // form at http-client.ts where validation must still flip the typing.
      expect(impl).not.toContain('getPetById<TData');
      expect(impl).toContain('Observable<PetOutput>');
      expect(impl).toContain('this.http.get<PetOutput>');
      expect(impl).toContain('.pipe(map(data => Pet.parse(data)))');
      expect(impl).not.toContain('Pet.parse(data) as TData');
      // Sanity-check we actually hit the non-overload branch.
      expect(impl).not.toContain('HttpClientObserveOptions');
    });

    it('generates reusable Accept helper declarations in the header', () => {
      const header = generateAngularHeader({
        title: 'PetService',
        isRequestOptions: true,
        isMutator: false,
        isGlobalMutator: false,
        provideIn: 'root',
        hasAwaitedType: false,
        output: createOutput(),
        verbOptions: {
          getPetFile: createVerbOption({
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
          }),
        },
      } as never);

      expect(header).toContain('export type GetPetFileAccept');
      expect(header).toContain('export const GetPetFileAccept = {');
      expect(header).toContain("application_json: 'application/json'");
      expect(header).toContain("text_plain: 'text/plain'");
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

  // ── urlEncodeParameters ─────────────────────────────────────────────

  describe('urlEncodeParameters', () => {
    const createOptionsWithUrlEncode = (urlEncodeParameters: boolean) => {
      const output = createOutput({ urlEncodeParameters });
      return createGeneratorOptions({
        route: '/api/pets/${petId}',
        context: createContextSpec(output),
      });
    };

    it('encodes path parameters when urlEncodeParameters is true', () => {
      const verbOption = createVerbOption();
      const options = createOptionsWithUrlEncode(true);

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain(
        '`/api/pets/${encodeURIComponent(String(petId))}`',
      );
      expect(impl).not.toContain('`/api/pets/${petId}`');
    });

    it('leaves the route unchanged when urlEncodeParameters is false', () => {
      const verbOption = createVerbOption();
      const options = createOptionsWithUrlEncode(false);

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('`/api/pets/${petId}`');
      expect(impl).not.toContain('encodeURIComponent');
    });

    it('encodes the route passed to the mutator config', () => {
      const verbOption = createVerbOption({
        mutator: {
          name: 'customInstance',
          path: './mutator',
          default: true,
          hasThirdArg: false,
          hasSecondArg: false,
        } as GeneratorVerbOptions['mutator'],
      });
      const options = createOptionsWithUrlEncode(true);

      const impl = generateHttpClientImplementation(verbOption, options);

      expect(impl).toContain('/api/pets/${encodeURIComponent(String(petId))}');
      expect(impl).not.toContain('url: `/api/pets/${petId}`');
    });
  });
});
