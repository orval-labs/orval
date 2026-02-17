import type {
  GeneratorVerbOptions,
  GetterBody,
  GetterResponse,
} from '@orval/core';
import { FormDataArrayHandling, Verbs } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { generateAngular } from './index';

type AngularGeneratorOptions = Parameters<typeof generateAngular>[1];

// Shared test fixtures
const makeBody = (overrides?: Partial<GetterBody>): GetterBody => ({
  originalSchema: {},
  imports: [],
  definition: '',
  implementation: '',
  schemas: [],
  formData: undefined,
  formUrlEncoded: undefined,
  contentType: 'application/json',
  isOptional: true,
  ...overrides,
});

const makeResponse = (overrides?: Partial<GetterResponse>): GetterResponse => ({
  imports: [{ name: 'Pet', schemaName: 'Pet', values: false }],
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
  ...overrides,
});

const makeVerbOptions = (
  overrides?: Partial<GeneratorVerbOptions>,
): GeneratorVerbOptions => {
  const baseVerbOptions = {
    headers: undefined,
    queryParams: undefined,
    operationName: 'getPet',
    response: makeResponse(),
    mutator: undefined,
    body: makeBody(),
    props: [],
    params: [],
    verb: Verbs.GET,
    override: {
      requestOptions: true,
      formData: {
        disabled: true,
        arrayHandling: FormDataArrayHandling.SERIALIZE,
      },
      formUrlEncoded: false,
      paramsSerializerOptions: undefined,
      angular: { provideIn: 'root', runtimeValidation: false },
    } as GeneratorVerbOptions['override'],
    formData: undefined,
    formUrlEncoded: undefined,
    paramsSerializer: undefined,
    tags: [],
  };

  return {
    ...baseVerbOptions,
    ...overrides,
  } as GeneratorVerbOptions;
};

const makeOverride = (
  runtimeValidation: boolean,
): GeneratorVerbOptions['override'] =>
  ({
    requestOptions: true,
    formData: {
      disabled: true,
      arrayHandling: FormDataArrayHandling.SERIALIZE,
    },
    formUrlEncoded: false,
    paramsSerializerOptions: undefined,
    angular: { provideIn: 'root', runtimeValidation },
  }) as GeneratorVerbOptions['override'];

const makeOptions = (schemasType?: string): AngularGeneratorOptions =>
  ({
    route: '/pet',
    context: {
      output: {
        tsconfig: {
          compilerOptions: {},
        },
        schemas: schemasType ? { type: schemasType } : undefined,
      },
    },
  }) as AngularGeneratorOptions;

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

    const verbOptions = makeVerbOptions({
      response,
      body,
      override: makeOverride(false),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions(),
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

    const verbOptions = makeVerbOptions({
      operationName: 'getPetByContentType',
      response,
      body,
      override: makeOverride(false),
    });

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
      } as AngularGeneratorOptions,
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

    const verbOptions = makeVerbOptions({
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
      override: makeOverride(false),
    });

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
      } as AngularGeneratorOptions,
      'angular',
    );

    expect(implementation).toContain('filterParams(');
    expect(implementation).toContain('"requiredNullableParam"');
    expect(implementation).toContain(
      'const filteredParams = paramsSerializerMutator(filterParams(',
    );
  });
});

describe('angular runtime validation (runtimeValidation + zod)', () => {
  const getObserveBranch = (
    implementation: string,
    mode: 'events' | 'response',
  ) => {
    const start = implementation.indexOf(`if (options?.observe === '${mode}')`);

    if (start === -1) {
      return '';
    }

    const tail = implementation.slice(start);
    const endMatch =
      mode === 'events'
        ? /\n\s*if \(options\?\.observe === 'response'\)/.exec(tail)
        : /\n\s*\n\s*return this\.http/.exec(tail);
    const end = endMatch?.index === undefined ? -1 : start + endMatch.index;

    return end === -1
      ? implementation.slice(start)
      : implementation.slice(start, end);
  };

  it('should apply .parse() validation pipe on body observe mode', async () => {
    const verbOptions = makeVerbOptions({
      override: makeOverride(true),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    // Body branch should have .pipe(map(data => Pet.parse(data) as TData))
    expect(implementation).toContain(
      '.pipe(map(data => Pet.parse(data) as TData))',
    );
  });

  it('should NOT apply .parse() on events or response observe modes', async () => {
    const verbOptions = makeVerbOptions({
      override: makeOverride(true),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    const eventsBranch = getObserveBranch(implementation, 'events');
    const responseBranch = getObserveBranch(implementation, 'response');

    expect(eventsBranch).toContain("observe: 'events'");
    expect(responseBranch).toContain("observe: 'response'");
    expect(eventsBranch).not.toContain('.parse(');
    expect(responseBranch).not.toContain('.parse(');

    // Body branch should still validate.
    expect(implementation).toContain(
      '.pipe(map(data => Pet.parse(data) as TData))',
    );
  });

  it('should NOT apply .parse() for primitive response types', async () => {
    const verbOptions = makeVerbOptions({
      response: makeResponse({
        imports: [],
        definition: { success: 'string', errors: 'unknown' },
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
              contentType: 'application/json',
              originalSchema: {},
            },
          ],
          errors: [],
        },
      }),
      override: makeOverride(true),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    expect(implementation).not.toContain('.parse(');
    expect(implementation).not.toContain('.pipe(map(');
  });

  it('should NOT apply .parse() for void response types', async () => {
    const verbOptions = makeVerbOptions({
      response: makeResponse({
        imports: [],
        definition: { success: 'void', errors: 'unknown' },
        types: { success: [], errors: [] },
      }),
      override: makeOverride(true),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    expect(implementation).not.toContain('.parse(');
  });

  it('should NOT apply .parse() when schemas output is not zod', async () => {
    const verbOptions = makeVerbOptions({
      override: makeOverride(true),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions(), // no zod schema type
      'angular',
    );

    expect(implementation).not.toContain('.parse(');
  });

  it('should NOT apply .parse() when runtimeValidation is false', async () => {
    const verbOptions = makeVerbOptions({
      override: makeOverride(false),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    expect(implementation).not.toContain('.parse(');
  });

  it('should import rxjs map only when validation pipe is emitted', async () => {
    const { imports: withValidationImports } = await generateAngular(
      makeVerbOptions({ override: makeOverride(true) }),
      makeOptions('zod'),
      'angular',
    );

    expect(withValidationImports).toContainEqual(
      expect.objectContaining({
        name: 'map',
        values: true,
        importPath: 'rxjs',
      }),
    );

    const { imports: withoutValidationImports } = await generateAngular(
      makeVerbOptions({ override: makeOverride(false) }),
      makeOptions('zod'),
      'angular',
    );

    expect(withoutValidationImports).not.toContainEqual(
      expect.objectContaining({
        name: 'map',
        importPath: 'rxjs',
      }),
    );
  });

  it('should NOT apply .parse() when using a custom mutator', async () => {
    const customMutator: NonNullable<GeneratorVerbOptions['mutator']> = {
      name: 'customMutator',
      path: './custom-mutator',
      default: true,
      hasErrorType: false,
      errorTypeName: 'unknown',
      hasSecondArg: false,
      hasThirdArg: false,
      isHook: false,
    };

    const verbOptions = makeVerbOptions({
      mutator: customMutator,
      override: makeOverride(true),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    // Mutator path returns from the mutator directly, no .parse()
    expect(implementation).not.toContain('.parse(');
    expect(implementation).toContain('customMutator');
  });

  it('should use ErrorSchema alias when response type is Error', async () => {
    const verbOptions = makeVerbOptions({
      response: makeResponse({
        imports: [{ name: 'Error', schemaName: 'Error', values: false }],
        definition: { success: 'Error', errors: 'unknown' },
        types: {
          success: [
            {
              value: 'Error',
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
      }),
      override: makeOverride(true),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    expect(implementation).toContain('ErrorSchema.parse(data) as TData');
    expect(implementation).not.toContain('Error.parse(data)');
  });

  it('should promote schema imports to value imports when validation is active', async () => {
    const verbOptions = makeVerbOptions({
      override: makeOverride(true),
    });

    const { imports } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    // The Pet import should be promoted to a value import (values: true)
    const petImport = imports.find((imp) => imp.name === 'Pet');
    expect(petImport).toBeDefined();
    expect(petImport?.values).toBe(true);
  });

  it('should NOT promote schema imports when validation is inactive', async () => {
    const verbOptions = makeVerbOptions({
      override: makeOverride(false),
    });

    const { imports } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    // The Pet import should NOT be promoted to a value import
    const petImport = imports.find((imp) => imp.name === 'Pet');
    if (petImport) {
      expect(petImport.values).toBeFalsy();
    }
  });

  it('should apply .parse() on JSON branch in multi-content-type responses', async () => {
    const verbOptions = makeVerbOptions({
      response: makeResponse({
        imports: [{ name: 'Pet', schemaName: 'Pet', values: false }],
        definition: { success: 'Pet', errors: 'unknown' },
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
              contentType: 'application/json',
              originalSchema: {},
            },
          ],
          errors: [],
        },
        contentTypes: ['text/plain', 'application/json'],
      }),
      override: makeOverride(true),
    });

    const { implementation } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    // JSON branch should have validation
    expect(implementation).toContain('.pipe(map(data => Pet.parse(data)))');
    // Text/blob branches should NOT have validation
    const textBranchMatch =
      /responseType: 'text'[\s\S]*?Observable<string>/.exec(implementation);
    if (textBranchMatch) {
      expect(textBranchMatch[0]).not.toContain('.parse(');
    }
  });

  it('should apply .parse() on JSON branch when primary content type is non-JSON', async () => {
    // When the primary content type is text/plain, definition.success is
    // 'string' (primitive). The JSON branch still returns Pet and needs
    // validation.
    const verbOptions = makeVerbOptions({
      response: makeResponse({
        imports: [{ name: 'Pet', schemaName: 'Pet', values: false }],
        definition: { success: 'string', errors: 'unknown' },
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
      }),
      override: makeOverride(true),
    });

    const { implementation, imports } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    // JSON branch should have validation even though primary type is string
    expect(implementation).toContain('.pipe(map(data => Pet.parse(data)))');
    // Pet import should be promoted to a value import for .parse()
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'Pet', values: true }),
    );
  });

  it('should NOT emit JSON branch .parse() when multiple JSON schema candidates exist', async () => {
    const verbOptions = makeVerbOptions({
      response: makeResponse({
        imports: [
          { name: 'Cat', schemaName: 'Cat', values: false },
          { name: 'Dog', schemaName: 'Dog', values: false },
        ],
        definition: { success: 'string', errors: 'unknown' },
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
              value: 'Cat',
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
            {
              value: 'Dog',
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
              contentType: 'application/vnd.api+json',
              originalSchema: {},
            },
          ],
          errors: [],
        },
        contentTypes: [
          'text/plain',
          'application/json',
          'application/vnd.api+json',
        ],
      }),
      override: makeOverride(true),
    });

    const { implementation, imports } = await generateAngular(
      verbOptions,
      makeOptions('zod'),
      'angular',
    );

    expect(implementation).toContain(
      "accept.includes('json') || accept.includes('+json')",
    );
    expect(implementation).not.toContain('.pipe(map(data => Cat.parse(data)))');
    expect(implementation).not.toContain('.pipe(map(data => Dog.parse(data)))');
    expect(imports).not.toContainEqual(
      expect.objectContaining({ name: 'Cat', values: true }),
    );
    expect(imports).not.toContainEqual(
      expect.objectContaining({ name: 'Dog', values: true }),
    );
  });
});
