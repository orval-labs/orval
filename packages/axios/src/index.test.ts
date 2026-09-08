import type {
  GeneratorOptions,
  GeneratorVerbOptions,
  GeneratorMutator,
} from '@orval/core';
import { getOperationUrlHelperNames, OutputClient } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  generateAxios,
  generateAxiosFactory,
  generateAxiosHeader,
  generateAxiosFooter,
  generateAxiosFunctions,
  generateAxiosTitle,
  getAxiosDependencies,
  getAxiosFactoryDependencies,
} from './index';

const response = {
  imports: [],
  definition: { success: 'Pet', errors: 'unknown' },
  isBlob: false,
  types: { success: [], errors: [] },
  contentTypes: ['application/json'],
  schemas: [],
};

const createVerbOptions = (
  overrides: Partial<GeneratorVerbOptions> = {},
): GeneratorVerbOptions =>
  ({
    operationId: 'getPet',
    operationName: 'getPet',
    typeName: 'getPet',
    verb: 'get',
    route: '/pets/${petId}',
    pathRoute: '/pets/{petId}',
    tags: [],
    summary: '',
    doc: '',
    response,
    body: {
      implementation: '',
      definition: '',
      imports: [],
      schemas: [],
      originalSchema: {},
      contentType: '',
      formData: '',
      formUrlEncoded: '',
      isOptional: true,
      isBlob: false,
    },
    headers: undefined,
    queryParams: {
      schema: { name: 'PetParams', model: 'PetParams', imports: [] },
      deps: [],
      isOptional: true,
    },
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
    props: [
      {
        name: 'petId',
        definition: 'petId: string',
        implementation: 'petId: string',
        default: undefined,
        required: true,
        type: 'param',
      },
      {
        name: 'params',
        definition: 'params?: PetParams',
        implementation: 'params?: PetParams',
        default: undefined,
        required: false,
        type: 'queryParam',
      },
    ],
    mutator: undefined,
    formData: undefined,
    formUrlEncoded: undefined,
    paramsSerializer: undefined,
    override: {
      requestOptions: true,
      formData: { disabled: true, arrayHandling: 'serialize' },
      formUrlEncoded: true,
      paramsSerializerOptions: undefined,
    },
    originalOperation: {},
    ...overrides,
  }) as GeneratorVerbOptions;

const generatorOptions = {
  route: '/pets/${petId}',
  pathRoute: '/pets/{petId}',
  context: {
    output: {
      tsconfig: { compilerOptions: { allowSyntheticDefaultImports: true } },
    },
  },
} as unknown as GeneratorOptions;

const mutator: GeneratorMutator = {
  name: 'customInstance',
  path: './custom-instance',
  default: false,
  hasErrorType: false,
  errorTypeName: '',
  hasSecondArg: true,
  hasThirdArg: false,
  isHook: false,
};

describe('Axios URL helpers', () => {
  it('uses collision-safe helper names in functions and factory output', async () => {
    const [fooUrlName, getFooUrlName] = getOperationUrlHelperNames(
      ['foo', 'getFooUrl'],
      ['foo', 'getFooUrl'],
    );
    const foo = await generateAxiosFunctions(
      createVerbOptions({ operationName: 'foo', urlHelperName: fooUrlName }),
      generatorOptions,
      OutputClient.AXIOS_FUNCTIONS,
    );
    const getFoo = await generateAxiosFunctions(
      createVerbOptions({
        operationName: 'getFooUrl',
        urlHelperName: getFooUrlName,
      }),
      generatorOptions,
      OutputClient.AXIOS_FUNCTIONS,
    );

    expect(`${foo.implementation}\n${getFoo.implementation}`).toContain(
      'export const getFooUrl2',
    );
    expect(`${foo.implementation}\n${getFoo.implementation}`).toContain(
      'export const getGetFooUrlUrl',
    );
    expect(
      `${foo.implementation}\n${getFoo.implementation}`.match(
        /export const getFooUrl\s*=/g,
      ),
    ).toHaveLength(1);

    const footer = generateAxiosFooter({
      operationNames: ['foo', 'getFooUrl'],
      operations: [
        {
          operationName: 'foo',
          urlHelperName: fooUrlName,
          mutator: undefined,
        } as never,
        {
          operationName: 'getFooUrl',
          urlHelperName: getFooUrlName,
          mutator: undefined,
        } as never,
      ],
      noFunction: false,
      hasMutator: false,
      hasAwaitedType: true,
    });

    expect(footer).toContain(
      'return {foo,getFooUrl,getFooUrl2,getGetFooUrlUrl}};',
    );
  });

  it('adds a public helper without changing the existing request call', async () => {
    const { implementation } = await generateAxiosFunctions(
      createVerbOptions(),
      generatorOptions,
      OutputClient.AXIOS_FUNCTIONS,
    );

    expect(implementation).toContain(
      'export const getGetPetUrl = (petId: string,',
    );
    expect(implementation).toContain('params?: PetParams,');
    expect(implementation).toContain(
      "return axios.create({\n    baseURL: '',\n    params: null,\n  }).getUri({\n    url: `/pets/${petId}`",
    );
    expect(implementation).toContain(
      'return axios.get(\n      `/pets/${petId}`',
    );
    expect(implementation).not.toContain('axios.get(getGetPetUrl(');
  });

  it('keeps the exact route expression received by Axios generation', () => {
    const encodedRoute = '/pets/${encodeURIComponent(String(petId))}';
    const implementation = generateAxios(
      createVerbOptions({ route: encodedRoute }),
      { ...generatorOptions, route: encodedRoute },
    ).implementation;

    expect(implementation).toContain(`url: \`${encodedRoute}\``);
    expect(implementation).toContain(`axios.get(\n      \`${encodedRoute}\``);
  });

  it('does not add path encoding when urlEncodeParameters is enabled', () => {
    const route = '/pets/${petId}';
    const implementation = generateAxios(createVerbOptions({ route }), {
      ...generatorOptions,
      route,
      context: {
        ...generatorOptions.context,
        output: {
          ...generatorOptions.context.output,
          urlEncodeParameters: true,
        },
      },
    }).implementation;

    expect(implementation).toContain(`url: \`${route}\``);
    expect(implementation).toContain(`axios.get(\n      \`${route}\``);
  });

  it('returns the helper from factory-generated APIs', async () => {
    const { implementation } = await generateAxiosFactory(
      createVerbOptions(),
      generatorOptions,
      OutputClient.AXIOS,
    );
    const footer = generateAxiosFooter({
      operationNames: ['getPet'],
      operations: [{ operationName: 'getPet', mutator: undefined } as never],
      noFunction: false,
      hasMutator: false,
      hasAwaitedType: true,
    });

    expect(implementation).toContain('const getGetPetUrl = (petId: string,');
    expect(implementation).toContain('params?: PetParams,');
    expect(implementation).toContain(
      "axiosInstance.create({\n    baseURL: '',\n    params: null,\n  }).getUri",
    );
    expect(footer).toContain('return {getPet,getGetPetUrl}};');
  });

  it('does not emit a helper when a mutator owns the request', async () => {
    const { implementation } = await generateAxiosFunctions(
      createVerbOptions({ mutator }),
      generatorOptions,
      OutputClient.AXIOS_FUNCTIONS,
    );

    expect(implementation).not.toContain('getGetPetUrl');
  });

  it('omits mutator-owned helpers from mixed factory returns', () => {
    const footer = generateAxiosFooter({
      operationNames: ['getPet', 'getMutatedPet'],
      operations: [
        { operationName: 'getPet', mutator: undefined } as never,
        { operationName: 'getMutatedPet', mutator } as never,
      ],
      noFunction: false,
      hasMutator: true,
      hasAwaitedType: true,
    });

    expect(footer).toContain('return {getPet,getMutatedPet,getGetPetUrl}};');
    expect(footer).not.toContain('getMutatedPetUrl');
  });
  it('does not add request options to the URL helper when disabled', async () => {
    const { implementation } = await generateAxiosFunctions(
      createVerbOptions({
        override: {
          ...createVerbOptions().override,
          requestOptions: false,
        },
      }),
      generatorOptions,
      OutputClient.AXIOS_FUNCTIONS,
    );

    expect(implementation).toContain(
      'export const getGetPetUrl = (petId: string,',
    );
    expect(implementation).toContain('params?: PetParams,');
    expect(implementation).not.toContain('options?: AxiosRequestConfig');
  });
});

describe('getAxiosDependencies (axios-functions mode)', () => {
  it('should return axios runtime import when no global mutator', () => {
    const deps = getAxiosDependencies(false, false);

    expect(deps).toHaveLength(1);
    expect(deps[0].dependency).toBe('axios');
    expect(deps[0].exports).toContainEqual({
      name: 'axios',
      default: true,
      values: true,
      syntheticDefaultImport: true,
    });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosRequestConfig' });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosResponse' });
  });

  it('should return empty array when global mutator is present', () => {
    const deps = getAxiosDependencies(true, false);

    expect(deps).toHaveLength(0);
  });

  it('should include qs dependency when params serializer is enabled', () => {
    const deps = getAxiosDependencies(false, true);

    expect(deps).toHaveLength(2);
    expect(deps[1].dependency).toBe('qs');
  });
});

describe('getAxiosFactoryDependencies (axios factory mode)', () => {
  it('should return axios runtime import and AxiosInstance type when no global mutator', () => {
    const deps = getAxiosFactoryDependencies(false, false);

    expect(deps).toHaveLength(1);
    expect(deps[0].dependency).toBe('axios');
    // Should have runtime axios import (for default parameter value)
    expect(deps[0].exports).toContainEqual({
      name: 'axios',
      default: true,
      values: true,
      syntheticDefaultImport: true,
    });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosInstance' });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosRequestConfig' });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosResponse' });
  });

  it('should not include AxiosInstance when global mutator is present', () => {
    const deps = getAxiosFactoryDependencies(true, false);

    expect(deps).toHaveLength(1);
    expect(deps[0].dependency).toBe('axios');
    // Should have runtime axios import (for default parameter value)
    expect(deps[0].exports).toContainEqual({
      name: 'axios',
      default: true,
      values: true,
      syntheticDefaultImport: true,
    });
    // Should NOT include AxiosInstance when global mutator is present
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosInstance' });
    // Should NOT include other axios types when mutator is present
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosRequestConfig' });
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosResponse' });
  });

  it('should not include AxiosInstance when tags mutator is present', () => {
    const deps = getAxiosFactoryDependencies(
      false,
      false,
      undefined,
      undefined,
      true,
    );

    expect(deps).toHaveLength(1);
    expect(deps[0].dependency).toBe('axios');
    // Should have runtime axios import (for default parameter value)
    expect(deps[0].exports).toContainEqual({
      name: 'axios',
      default: true,
      values: true,
      syntheticDefaultImport: true,
    });
    // Should NOT include AxiosInstance when tags mutator is present
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosInstance' });
    // Should still include other axios types since global mutator is not present
    expect(deps[0].exports).toContainEqual({ name: 'AxiosRequestConfig' });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosResponse' });
  });

  it('should include qs dependency when params serializer is enabled', () => {
    const deps = getAxiosFactoryDependencies(false, true);

    expect(deps).toHaveLength(2);
    expect(deps[1].dependency).toBe('qs');
  });
});

describe('generateAxiosHeader', () => {
  const mockOutput = {
    tsconfig: {
      compilerOptions: {
        allowSyntheticDefaultImports: true,
      },
    },
  } as never;

  const baseMockParams = {
    title: 'getPetsApi',
    isGlobalMutator: false,
    provideIn: false as const,
    hasAwaitedType: false,
    output: mockOutput,
    verbOptions: {},
    clientImplementation: '',
  };

  it('should generate factory function with optional axios parameter when noFunction is false', () => {
    const header = generateAxiosHeader({
      ...baseMockParams,
      isRequestOptions: true,
      isMutator: false,
      noFunction: false,
    });

    expect(header).toContain(
      'export const getPetsApi = (axiosInstance: AxiosInstance = axios)',
    );
  });

  it('should not generate factory function when noFunction is true (axios-functions mode)', () => {
    const header = generateAxiosHeader({
      ...baseMockParams,
      isRequestOptions: true,
      isMutator: false,
      noFunction: true,
    });

    expect(header).not.toContain('export const getPetsApi');
    expect(header).not.toContain('AxiosInstance');
  });

  it('should include SecondParameter type when using mutator with request options', () => {
    const header = generateAxiosHeader({
      ...baseMockParams,
      isRequestOptions: true,
      isMutator: true,
      isGlobalMutator: true,
      noFunction: false,
    });

    expect(header).toContain('type SecondParameter<T extends (...args: never)');
    expect(header).toContain('export const getPetsApi = () => {');
    expect(header).not.toContain('axiosInstance');
  });

  it('should not include axiosInstance when tags-level mutator is present', () => {
    const header = generateAxiosHeader({
      ...baseMockParams,
      isRequestOptions: true,
      isMutator: false,
      isGlobalMutator: false,
      noFunction: false,
      verbOptions: {
        getPets: {
          mutator: { name: 'customInstance' },
        } as never,
      },
    });

    expect(header).toContain('export const getPetsApi = () => {');
    expect(header).not.toContain('axiosInstance');
    expect(header).not.toContain('AxiosInstance');
  });

  it('should not include axiosInstance when global mutator is present', () => {
    const header = generateAxiosHeader({
      ...baseMockParams,
      isRequestOptions: false,
      isMutator: false,
      isGlobalMutator: true,
      noFunction: false,
    });

    expect(header).toContain('export const getPetsApi = () => {');
    expect(header).not.toContain('axiosInstance');
    expect(header).not.toContain('AxiosInstance');
  });
});

describe('generateAxiosTitle', () => {
  it('should generate title with get prefix', () => {
    expect(generateAxiosTitle('pets')).toBe('getPets');
    // pascal() from @orval/core uses specific case conversion
    expect(generateAxiosTitle('swagger-petstore')).toBe('getSwaggerpetstore');
  });
});
