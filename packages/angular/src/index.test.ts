import type {
  GeneratorVerbOptions,
  GetterBody,
  GetterResponse,
} from '@orval/core';
import { Verbs } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { generateAngular } from './index';

describe('angular generator implementation signature', () => {
  it('should restrict implementation signature observe to valid Angular observe modes', async () => {
    const body: GetterBody = {
      originalSchema: {},
      imports: [],
      definition: '',
      implementation: '',
      schemas: [],
      formData: undefined,
      formUrlEncoded: undefined,
      contentType: 'application/json',
      isOptional: true,
    };

    const response: GetterResponse = {
      imports: [],
      definition: {
        success: 'Pet',
        errors: 'unknown',
      },
      isBlob: false,
      types: {
        success: [
          {
            value: 'Pet',
            isEnum: false,
            type: 'object',
            imports: [],
            schemas: [],
            isRef: false,
            hasReadonlyProps: false,
            dependencies: [],
            example: undefined,
            examples: undefined,
            key: '200',
            contentType: 'application/json',
            originalSchema: {},
          },
        ],
        errors: [],
      },
      contentTypes: ['application/json'],
      schemas: [],
      originalSchema: {},
    };

    const verbOptions = {
      headers: undefined,
      queryParams: undefined,
      operationName: 'getPet',
      response,
      mutator: undefined,
      body,
      props: [],
      params: [],
      verb: Verbs.GET,
      override: {
        requestOptions: true,
        formData: { disabled: true },
        formUrlEncoded: false,
        paramsSerializerOptions: undefined,
      },
      formData: undefined,
      formUrlEncoded: undefined,
      paramsSerializer: undefined,
    } as unknown as GeneratorVerbOptions;

    const { implementation } = await generateAngular(
      verbOptions,
      {
        route: '/pet',
        context: {
          output: {
            tsconfig: {
              compilerOptions: {},
            },
          },
        },
      } as never,
      'angular',
    );

    expect(implementation).toContain(
      "options?: HttpClientOptions & { observe?: 'body' | 'events' | 'response' }",
    );
    expect(implementation).not.toContain('observe?: any');
    expect(implementation).toContain("if (options?.observe === 'events')");
    expect(implementation).toContain("if (options?.observe === 'response')");
    expect(implementation).toContain("observe: 'events'");
    expect(implementation).toContain("observe: 'response'");
    expect(implementation).toContain("observe: 'body'");
    expect(implementation).not.toContain('Observable<any>');
  });

  it('should emit content-type overloads aligned with runtime responseType branches', async () => {
    const body: GetterBody = {
      originalSchema: {},
      imports: [],
      definition: '',
      implementation: '',
      schemas: [],
      formData: undefined,
      formUrlEncoded: undefined,
      contentType: 'application/json',
      isOptional: true,
    };

    const response: GetterResponse = {
      imports: [],
      definition: {
        success: 'Pet',
        errors: 'unknown',
      },
      isBlob: false,
      types: {
        success: [
          {
            value: 'string',
            isEnum: false,
            type: 'string',
            imports: [],
            schemas: [],
            isRef: false,
            hasReadonlyProps: false,
            dependencies: [],
            example: undefined,
            examples: undefined,
            key: '200',
            contentType: 'text/plain',
            originalSchema: {},
          },
          {
            value: 'Pet',
            isEnum: false,
            type: 'object',
            imports: [],
            schemas: [],
            isRef: false,
            hasReadonlyProps: false,
            dependencies: [],
            example: undefined,
            examples: undefined,
            key: '200',
            contentType: 'application/xml',
            originalSchema: {},
          },
          {
            value: 'Pet',
            isEnum: false,
            type: 'object',
            imports: [],
            schemas: [],
            isRef: false,
            hasReadonlyProps: false,
            dependencies: [],
            example: undefined,
            examples: undefined,
            key: '200',
            contentType: 'application/json',
            originalSchema: {},
          },
        ],
        errors: [],
      },
      contentTypes: ['text/plain', 'application/xml', 'application/json'],
      schemas: [],
      originalSchema: {},
    };

    const verbOptions = {
      headers: undefined,
      queryParams: undefined,
      operationName: 'getPetByContentType',
      response,
      mutator: undefined,
      body,
      props: [],
      params: [],
      verb: Verbs.GET,
      override: {
        requestOptions: true,
        formData: { disabled: true },
        formUrlEncoded: false,
        paramsSerializerOptions: undefined,
      },
      formData: undefined,
      formUrlEncoded: undefined,
      paramsSerializer: undefined,
    } as unknown as GeneratorVerbOptions;

    const { implementation } = await generateAngular(
      verbOptions,
      {
        route: '/pet/{petId}',
        context: {
          output: {
            tsconfig: {
              compilerOptions: {},
            },
          },
        },
      } as never,
      'angular',
    );

    expect(implementation).toContain(
      "accept: 'text/plain', options?: HttpClientOptions): Observable<string>;",
    );
    expect(implementation).toContain(
      "accept: 'application/xml', options?: HttpClientOptions): Observable<string>;",
    );
    expect(implementation).toContain(
      "accept: 'application/json', options?: HttpClientOptions): Observable<Pet>;",
    );
    expect(implementation).toContain(
      'accept?: string, options?: HttpClientOptions): Observable<Pet | string | Blob>;',
    );
    expect(implementation).toContain(
      'const headers = options?.headers instanceof HttpHeaders',
    );
    expect(implementation).toContain("options.headers.set('Accept', accept)");
    expect(implementation).toContain(
      '{ ...(options?.headers ?? {}), Accept: accept }',
    );
    expect(implementation).not.toContain(
      "accept: 'application/xml', options?: HttpClientOptions): Observable<Pet>;",
    );
    expect(implementation).not.toContain('Observable<any>');
  });

  it('should preserve required nullable query params in angular filtering expression', async () => {
    const body: GetterBody = {
      originalSchema: {},
      imports: [],
      definition: '',
      implementation: '',
      schemas: [],
      formData: undefined,
      formUrlEncoded: undefined,
      contentType: 'application/json',
      isOptional: true,
    };

    const response: GetterResponse = {
      imports: [],
      definition: {
        success: 'Pet',
        errors: 'unknown',
      },
      isBlob: false,
      types: {
        success: [
          {
            value: 'Pet',
            isEnum: false,
            type: 'object',
            imports: [],
            schemas: [],
            isRef: false,
            hasReadonlyProps: false,
            dependencies: [],
            example: undefined,
            examples: undefined,
            key: '200',
            contentType: 'application/json',
            originalSchema: {},
          },
        ],
        errors: [],
      },
      contentTypes: ['application/json'],
      schemas: [],
      originalSchema: {},
    };

    const verbOptions = {
      headers: undefined,
      queryParams: {
        schema: {
          name: 'SearchParams',
          model:
            'export type SearchParams = { requiredNullableParam: string | null; optionalParam?: string; };',
          imports: [],
        },
        deps: [],
        isOptional: false,
        requiredNullableKeys: ['requiredNullableParam'],
      },
      operationName: 'searchPets',
      response,
      mutator: undefined,
      body,
      props: [
        {
          name: 'params',
          definition: 'params: SearchParams,',
          implementation: 'params: SearchParams,',
          default: false,
          required: true,
          type: 'queryParam',
        },
      ],
      params: [],
      verb: Verbs.GET,
      override: {
        requestOptions: true,
        formData: { disabled: true },
        formUrlEncoded: false,
        paramsSerializerOptions: undefined,
      },
      formData: undefined,
      formUrlEncoded: undefined,
      paramsSerializer: {
        name: 'paramsSerializerMutator',
        path: './paramsSerializerMutator',
        default: true,
        hasErrorType: false,
        errorTypeName: 'unknown',
        hasSecondArg: false,
        hasThirdArg: false,
        isHook: false,
      },
    } as unknown as GeneratorVerbOptions;

    const { implementation } = await generateAngular(
      verbOptions,
      {
        route: '/search',
        context: {
          output: {
            tsconfig: {
              compilerOptions: {},
            },
          },
        },
      } as never,
      'angular',
    );

    expect(implementation).toContain(
      'const requiredNullableParamKeys = new Set',
    );
    expect(implementation).toContain('"requiredNullableParam"');
    expect(implementation).toContain(
      'value === null && requiredNullableParamKeys.has(key)',
    );
  });
});
