import {
  type ContextSpec,
  EnumGeneration,
  FormDataArrayHandling,
  type GeneratorImport,
  NamingConvention,
  OutputClient,
  OutputHttpClient,
  OutputMode,
  OutputMockType,
  PropertySortOrder,
} from '@orval/core';
import { describe, expect, it } from 'vitest';

import type { MockSchema, MockSchemaObject } from '../../types';
import { collectAllOfRequired } from './all-of-required';
import { combineSchemasMock } from './combine';

function createMockContext(): ContextSpec {
  return {
    target: 'test',
    workspace: 'test',
    spec: { openapi: '3.1.0', info: { title: 'Test' }, paths: {} },
    output: {
      target: '',
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      schemaFileExtension: '.ts',
      mode: OutputMode.SINGLE,
      mock: { indexMockFiles: false, generators: [] },
      client: OutputClient.FETCH,
      httpClient: OutputHttpClient.FETCH,
      clean: false,
      docs: false,
      formatter: undefined,
      headers: false,
      indexFiles: false,
      allParamsOptional: false,
      urlEncodeParameters: false,
      unionAddMissingProperties: false,
      optionsParamRequired: false,
      propertySortOrder: PropertySortOrder.ALPHABETICAL,
      tagsSplitDeduplication: false,
      commonTypesFileName: 'common-types',
      factoryMethods: {
        functionNamePrefix: 'create',
        mode: 'single',
        outputDirectory: '',
        includeOptionalProperty: false,
      },
      override: {
        title: undefined,
        transformer: undefined,
        mutator: undefined,
        operations: {},
        tags: {},
        mock: undefined,
        contentType: undefined,
        header: false,
        formData: {
          disabled: false,
          arrayHandling: FormDataArrayHandling.SERIALIZE,
        },
        formUrlEncoded: false,
        paramsSerializer: undefined,
        paramsSerializerOptions: undefined,
        namingConvention: {},
        components: {
          schemas: { suffix: '', itemSuffix: '' },
          responses: { suffix: '' },
          parameters: { suffix: '' },
          requestBodies: { suffix: '' },
        },
        hono: {
          handlerGenerationStrategy: 'smart',
          compositeRoute: '',
          validator: false,
          validatorOutputPath: '',
        },
        query: {
          useQuery: false,
          useSuspenseQuery: false,
          useMutation: false,
          useInfinite: false,
          useSuspenseInfiniteQuery: false,
          useInfiniteQueryParam: '',
          usePrefetch: false,
          useInvalidate: false,
          useSetQueryData: false,
          useGetQueryData: false,
          shouldExportMutatorHooks: false,
          shouldExportHttpClient: false,
          shouldExportQueryKey: false,
          shouldSplitQueryKey: false,
          useOperationIdAsQueryKey: false,
          signal: false,
          version: 5,
        },
        angular: {
          provideIn: 'root',
          client: 'httpClient',
          runtimeValidation: false,
          queryObjectSerialization: 'spec',
        },
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
            param: false,
            query: false,
            header: false,
            body: false,
            response: false,
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
          generateReusableSchemas: false,
          generateMeta: false,
          generateDiscriminatedUnion: false,
          exactOptional: false,
          dateTimeOptions: {},
          timeOptions: { precision: 3 },
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
            param: false,
            query: false,
            header: false,
            body: false,
            response: false,
          },
          generateEachHttpStatus: false,
          useBrandedTypes: false,
          exactOptional: false,
        },
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
          serializeResponseHeaders: false,
          runtimeValidation: false,
          useRuntimeFetcher: false,
        },
        enumGenerationType: EnumGeneration.UNION,
        jsDoc: {},
        requestOptions: true,
        splitByContentType: false,
        aliasCombinedTypes: false,
        mcp: {},
      },
    },
  };
}

describe('collectAllOfRequired', () => {
  // Two component schemas whose allOf entries reference each other directly.
  // The `seen` cycle guard in derefAllOfMember must terminate the traversal
  // while still collecting the required fields declared on each side.
  it('terminates on a direct mutual $ref cycle and collects both sides', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        A: {
          allOf: [
            { $ref: '#/components/schemas/B' },
            {
              type: 'object',
              required: ['aField'],
              properties: { aField: { type: 'string' } },
            },
          ],
        },
        B: {
          allOf: [
            { $ref: '#/components/schemas/A' },
            {
              type: 'object',
              required: ['bField'],
              properties: { bField: { type: 'string' } },
            },
          ],
        },
      },
    };

    const members: MockSchema[] = [
      { $ref: '#/components/schemas/B' },
      {
        type: 'object',
        required: ['aField'],
        properties: { aField: { type: 'string' } },
      },
    ];

    let result: string[] = [];
    expect(() => {
      result = collectAllOfRequired(members, context);
    }).not.toThrow();

    expect(new Set(result)).toEqual(new Set(['aField', 'bField']));
  });

  // A schema alias chain that loops back on itself must resolve to nothing
  // rather than recurse forever.
  it('terminates on a cyclic $ref alias chain', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        A: { $ref: '#/components/schemas/B' },
        B: { $ref: '#/components/schemas/A' },
      },
    };

    let result: string[] = [];
    expect(() => {
      result = collectAllOfRequired(
        [{ $ref: '#/components/schemas/A' }],
        context,
      );
    }).not.toThrow();

    expect(result).toEqual([]);
  });
});

describe('combineSchemasMock', () => {
  it('should combine allOf schemas with primitive values', () => {
    const item: MockSchemaObject = {
      name: 'User',
      allOf: [
        { type: 'object', properties: { name: { type: 'string' } } },
        { type: 'object', properties: { age: { type: 'integer' } } },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toBeTruthy();
    expect(result.imports).toBeInstanceOf(Array);
    expect(result.name).toBe('User');
  });

  it('should combine oneOf schemas', () => {
    const item: MockSchemaObject = {
      name: 'Response',
      oneOf: [
        {
          type: 'object',
          properties: { type: { type: 'string', enum: ['success'] } },
        },
        {
          type: 'object',
          properties: { type: { type: 'string', enum: ['error'] } },
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'oneOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toContain('faker.helpers.arrayElement');
  });

  it('should combine anyOf schemas', () => {
    const item: MockSchemaObject = {
      name: 'Config',
      anyOf: [
        { type: 'string' },
        { type: 'object', properties: { value: { type: 'string' } } },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'anyOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.name).toBe('Config');
  });

  it('should skip already referenced properties in allOf', () => {
    const item: MockSchemaObject = {
      name: 'Extended',
      properties: { base: { type: 'string' } },
      allOf: [{ type: 'object', properties: { extra: { type: 'string' } } }],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: ['Extended'],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    // The combined included properties should contain the original property keys
    expect(result.includedProperties).toContain('base');
  });

  it('should handle empty combination arrays', () => {
    const item: MockSchemaObject = {
      name: 'Empty',
      allOf: [],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toBeDefined();
  });

  it('should merge required fields from parent with child schema in allOf', () => {
    const item: MockSchemaObject = {
      name: 'Parent',
      required: ['parentField'],
      allOf: [
        {
          type: 'object',
          properties: { childField: { type: 'string' } },
          required: ['childField'],
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.includedProperties).toBeDefined();
  });

  it('should return undefined when the only oneOf variant is a circular reference', () => {
    const item: MockSchemaObject = {
      name: 'Test',
      oneOf: [{ $ref: '#/components/schemas/ExistingRef' }],
    };

    const result = combineSchemasMock({
      item,
      separator: 'oneOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: ['ExistingRef'],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toBe('undefined');
  });

  it('should collect imports from combined schemas', () => {
    const mockImports: GeneratorImport[] = [
      { name: 'TestType', default: false },
    ];

    const item: MockSchemaObject = {
      name: 'WithImports',
      allOf: [{ type: 'object', properties: { field: { type: 'string' } } }],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: mockImports,
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.imports).toBeInstanceOf(Array);
  });

  it('should handle nested allOf combinations', () => {
    const item: MockSchemaObject = {
      name: 'Nested',
      allOf: [
        {
          type: 'object',
          properties: {
            level1: { type: 'string' },
          },
        },
        {
          type: 'object',
          properties: {
            level2: { type: 'string' },
          },
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).not.toBe('undefined');
  });

  it('should resolve allOf base schema even when base was seen in different branch', () => {
    const contextWithSchemas: ContextSpec = {
      ...createMockContext(),
      spec: {
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            Base: {
              type: 'object',
              required: ['id', 'name'],
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
              },
            },
          },
        },
      },
    };

    const item: MockSchemaObject = {
      name: 'Cat',
      isRef: true,
      allOf: [
        { $ref: '#/components/schemas/Base' },
        {
          type: 'object',
          properties: { meow: { type: 'boolean' } },
          required: ['meow'],
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context: contextWithSchemas,
      imports: [],
      existingReferencedProperties: ['Response', 'Dog', 'Base', 'Shelter'],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).not.toBe('undefined');
    expect(result.value).toContain('id:');
    expect(result.value).toContain('name:');
    expect(result.value).toContain('meow:');
  });

  it('should return undefined when the only oneOf variant points to a visited schema', () => {
    const item: MockSchemaObject = {
      name: 'Pet',
      oneOf: [{ $ref: '#/components/schemas/Cat' }],
    };

    const result = combineSchemasMock({
      item,
      separator: 'oneOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: ['Cat'],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    expect(result.value).toBe('undefined');
  });

  // Regression test for #2155: when a `oneOf` schema declares a discriminator
  // with a mapping AND the discriminator property is also listed in the
  // parent's `properties`, the parent's free-choice enum must NOT be emitted
  // alongside the picked variant. Each variant already encodes a constrained
  // value for that property via `resolveDiscriminators`, so a trailing parent
  // assignment would statically override it and guarantee a mismatch.
  it('should not emit the discriminator property when oneOf has a discriminator mapping (#2155)', () => {
    const item: MockSchemaObject = {
      name: 'DiscriminatorTest',
      type: 'object',
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['item1', 'item2', 'item3'] },
      },
      discriminator: {
        propertyName: 'type',
        mapping: {
          item1: '#/components/schemas/Item1',
          item2: '#/components/schemas/Item2',
          item3: '#/components/schemas/Item3',
        },
      },
      oneOf: [
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['item1'] },
            property1: { type: 'string' },
          },
          required: ['type'],
        },
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['item2'] },
            property2: { type: 'string' },
          },
          required: ['type'],
        },
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['item3'] },
            property3: { type: 'string' },
          },
          required: ['type'],
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'oneOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    // The picked variant carries the constrained discriminator value
    // (e.g. `type: 'item1'`); appending the parent's full enum after the
    // spread would overwrite it. Ensure the trailing override is gone.
    expect(result.value).not.toMatch(
      /faker\.helpers\.arrayElement\(\[\s*'item1'\s*,\s*'item2'\s*,\s*'item3'\s*\]/,
    );
  });

  // Regression test for #2081: a oneOf variant that points back to an
  // already-visited schema must be skipped, otherwise polymorphic recursion
  // (Base → Parent.oneOf → Derived → allOf [Base]) overflows the stack.
  it('should skip oneOf variants that reference already-visited schemas (#2081)', () => {
    const item: MockSchemaObject = {
      name: 'Parent',
      oneOf: [
        { $ref: '#/components/schemas/Derived1' },
        { $ref: '#/components/schemas/Derived2' },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'oneOf',
      operationId: 'testOp',
      tags: ['test'],
      context: createMockContext(),
      imports: [],
      // Derived1 already on the resolution stack — skip it, keep Derived2.
      existingReferencedProperties: ['Derived1'],
      splitMockImplementations: [],
    });

    expect(result).toBeDefined();
    // Derived1 should not appear because it's a circular reference here.
    expect(result.value).not.toContain('Derived1');
  });

  // Regression test: `required` fields declared on a `$ref`'d allOf base must
  // propagate to sibling override branches. `BaseError` requires `errorType`;
  // the override branch narrows its enum to a single value without re-listing
  // it in its own `required`. Treating it as optional there emits
  // `faker.helpers.arrayElement([..., undefined])`, which breaks assignability
  // to the generated intersection type (errorType stays required).
  it('unions required fields from $ref allOf members into sibling branches', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        BaseError: {
          type: 'object',
          required: ['errorType', 'message'],
          properties: {
            errorType: {
              type: 'string',
              enum: ['GENERIC_ERROR', 'VALIDATION_ERROR'],
            },
            message: { type: 'string' },
          },
        },
      },
    };

    const item: MockSchemaObject = {
      name: 'ValidationError',
      isRef: true,
      allOf: [
        { $ref: '#/components/schemas/BaseError' },
        {
          type: 'object',
          required: ['violations'],
          properties: {
            errorType: { type: 'string', enum: ['VALIDATION_ERROR'] },
            violations: { type: 'array', items: { type: 'string' } },
          },
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toContain(
      "errorType: faker.helpers.arrayElement(['VALIDATION_ERROR'] as const)",
    );
    expect(result.value).not.toContain('undefined');
  });

  // Same propagation, one level deeper: the base is itself an `allOf` whose
  // required fields live on a nested `$ref` member. The union must be
  // collected recursively.
  it('unions required fields from nested allOf chains behind a $ref', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        RootError: {
          type: 'object',
          required: ['errorType'],
          properties: {
            errorType: {
              type: 'string',
              enum: ['GENERIC_ERROR', 'VALIDATION_ERROR'],
            },
          },
        },
        BaseError: {
          allOf: [{ $ref: '#/components/schemas/RootError' }],
        },
      },
    };

    const item: MockSchemaObject = {
      name: 'ValidationError',
      isRef: true,
      allOf: [
        { $ref: '#/components/schemas/BaseError' },
        {
          type: 'object',
          properties: {
            errorType: { type: 'string', enum: ['VALIDATION_ERROR'] },
          },
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toContain(
      "errorType: faker.helpers.arrayElement(['VALIDATION_ERROR'] as const)",
    );
    expect(result.value).not.toContain('undefined');
  });

  // The required union must survive `$ref`-to-`$ref` alias chains: the model
  // side follows them (derefComponentSchema), so the mock must too or the
  // undefined branch re-appears behind a one-hop alias.
  it('unions required fields through $ref alias chains', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        BaseError: {
          type: 'object',
          required: ['errorType'],
          properties: {
            errorType: {
              type: 'string',
              enum: ['GENERIC_ERROR', 'VALIDATION_ERROR'],
            },
          },
        },
        BaseAlias: { $ref: '#/components/schemas/BaseError' },
      },
    };

    const item: MockSchemaObject = {
      name: 'ValidationError',
      isRef: true,
      allOf: [
        { $ref: '#/components/schemas/BaseAlias' },
        {
          type: 'object',
          properties: {
            errorType: { type: 'string', enum: ['VALIDATION_ERROR'] },
          },
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toContain(
      "errorType: faker.helpers.arrayElement(['VALIDATION_ERROR'] as const)",
    );
    expect(result.value).not.toContain('undefined');
  });

  // Narrowing via the composed schema's own sibling `properties` (declared
  // next to `allOf` instead of inside a member) is emitted last and wins the
  // spread merge, so it must receive the same required union.
  it('unions required fields into sibling properties declared next to allOf', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        BaseError: {
          type: 'object',
          required: ['errorType'],
          properties: {
            errorType: {
              type: 'string',
              enum: ['GENERIC_ERROR', 'VALIDATION_ERROR'],
            },
          },
        },
      },
    };

    const item: MockSchemaObject = {
      name: 'ValidationError',
      isRef: true,
      allOf: [{ $ref: '#/components/schemas/BaseError' }],
      properties: {
        errorType: { type: 'string', enum: ['VALIDATION_ERROR'] },
      },
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toContain(
      "errorType: faker.helpers.arrayElement(['VALIDATION_ERROR'] as const)",
    );
    expect(result.value).not.toContain('undefined');
  });

  // A constraint-only member (`required` with no `type`/`properties`) makes
  // the listed properties required on the composition (#3750 on the model
  // side); the mock must agree and drop the undefined branch for them.
  it('applies required from constraint-only allOf members', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        Item: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    };

    const item: MockSchemaObject = {
      name: 'ItemDetail',
      isRef: true,
      allOf: [{ $ref: '#/components/schemas/Item' }, { required: ['id'] }],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    // `id` is required through the constraint-only member; `name` stays
    // optional (keeps its undefined branch).
    expect(result.value).toMatch(/id: faker\.string\.alpha/);
    expect(result.value).not.toMatch(
      /id: faker\.helpers\.arrayElement\(\[faker\.string\.alpha[^\]]*, undefined\]\)/,
    );
    expect(result.value).toMatch(
      /name: faker\.helpers\.arrayElement\(\[faker\.string\.alpha[^\]]*, undefined\]\)/,
    );
  });

  // Nested `required` names that the nested composition never declares must
  // NOT cross its boundary: the generated type keeps such a property optional,
  // and treating it as required here would flip the #910 cyclic-reference
  // guard from omission to `key: null` on a self-referential sibling,
  // emitting a mock the type rejects.
  it('does not propagate nested required names the nested composition never declares', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        NodeBase: {
          allOf: [
            {
              type: 'object',
              required: ['parent'],
              properties: { label: { type: 'string' } },
            },
          ],
        },
        Node: {
          allOf: [
            { $ref: '#/components/schemas/NodeBase' },
            {
              type: 'object',
              properties: { parent: { $ref: '#/components/schemas/Node' } },
            },
          ],
        },
      },
    };

    const item: MockSchemaObject = {
      name: 'Node',
      isRef: true,
      allOf: [
        { $ref: '#/components/schemas/NodeBase' },
        {
          type: 'object',
          properties: { parent: { $ref: '#/components/schemas/Node' } },
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context,
      imports: [],
      existingReferencedProperties: ['Node'],
      splitMockImplementations: [],
    });

    // The cyclic `parent` property must be omitted (optional in the generated
    // type), not emitted as `parent: null`.
    expect(result.value).not.toContain('parent: null');
  });

  // With faker `schemas: true`, a $ref member normally delegates to its
  // shared `get<X>Mock()` factory. Delegation must be skipped when the
  // composition requires a property the factory emits as optional, including
  // when the target declares that property behind its OWN allOf chain
  // (overlay pattern): the factory only encodes the target's own optionality.
  it('skips factory delegation when the required union covers a property declared behind the target allOf', () => {
    const context = createMockContext();
    context.output.schemas = 'model';
    context.output.mock = {
      indexMockFiles: false,
      generators: [{ type: OutputMockType.FAKER, schemas: true }],
    };
    context.spec.components = {
      schemas: {
        OverlayBase: {
          allOf: [
            {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
              },
            },
          ],
        },
      },
    };

    const item: MockSchemaObject = {
      name: 'OverlayDetail',
      isRef: true,
      allOf: [
        { $ref: '#/components/schemas/OverlayBase' },
        { required: ['id'] },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    // The base must be inlined (not `...getOverlayBaseMock()`), with `id`
    // required and `label` still optional.
    expect(result.value).not.toContain('getOverlayBaseMock');
    expect(result.value).toMatch(/id: faker\.string\.alpha/);
    expect(result.value).not.toMatch(
      /id: faker\.helpers\.arrayElement\(\[faker\.string\.alpha[^\]]*, undefined\]\)/,
    );
    expect(result.value).toMatch(
      /label: faker\.helpers\.arrayElement\(\[faker\.string\.alpha[^\]]*, undefined\]\)/,
    );
  });

  // The union is one-directional per JSON Schema semantics: a property listed
  // in NO branch's `required` must stay optional in the mock.
  it('keeps properties optional when no allOf member requires them', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        Base: {
          type: 'object',
          properties: {
            label: { type: 'string' },
          },
        },
      },
    };

    const item: MockSchemaObject = {
      name: 'Extended',
      isRef: true,
      allOf: [
        { $ref: '#/components/schemas/Base' },
        {
          type: 'object',
          properties: {
            label: { type: 'string', enum: ['EXTENDED'] },
          },
        },
      ],
    };

    const result = combineSchemasMock({
      item,
      separator: 'allOf',
      operationId: 'testOp',
      tags: ['test'],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toMatch(
      /label: faker\.helpers\.arrayElement\(\[faker\.helpers\.arrayElement\(\['EXTENDED'\] as const\), undefined\]\)/,
    );
  });

  // Regression test: a cycle made purely of top-level named schemas that
  // extend each other via `allOf` (`A: allOf[B]`, `B: allOf[A]`) used to
  // overflow the stack. Every hop has `item.isRef === true`, so the
  // `!item.isRef` guard never fired; the `existingReferencedAllOfRefs` chain
  // breaks the cycle instead.
  it('terminates on a mutual allOf cycle between top-level schemas', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        A: { allOf: [{ $ref: '#/components/schemas/B' }] },
        B: { allOf: [{ $ref: '#/components/schemas/A' }] },
      },
    };

    const item: MockSchemaObject = {
      name: 'A',
      isRef: true,
      allOf: [{ $ref: '#/components/schemas/B' }],
    };

    let result: ReturnType<typeof combineSchemasMock> | undefined;
    expect(() => {
      result = combineSchemasMock({
        item,
        separator: 'allOf',
        operationId: 'testOp',
        tags: ['test'],
        context,
        imports: [],
        // `A` is already on the resolution path (it is the schema being expanded).
        existingReferencedProperties: ['A'],
        splitMockImplementations: [],
      });
    }).not.toThrow();

    expect(result).toBeDefined();
  });

  // Regression test: a longer `allOf` inheritance chain that loops back
  // (`A: allOf[B]`, `B: allOf[C]`, `C: allOf[A]`) — mirrors the real-world
  // `System.Xml.Linq.*` hierarchy. Must terminate rather than overflow.
  it('terminates on a multi-hop allOf inheritance cycle', () => {
    const context = createMockContext();
    context.spec.components = {
      schemas: {
        A: { allOf: [{ $ref: '#/components/schemas/B' }] },
        B: { allOf: [{ $ref: '#/components/schemas/C' }] },
        C: { allOf: [{ $ref: '#/components/schemas/A' }] },
      },
    };

    const item: MockSchemaObject = {
      name: 'A',
      isRef: true,
      allOf: [{ $ref: '#/components/schemas/B' }],
    };

    let result: ReturnType<typeof combineSchemasMock> | undefined;
    expect(() => {
      result = combineSchemasMock({
        item,
        separator: 'allOf',
        operationId: 'testOp',
        tags: ['test'],
        context,
        imports: [],
        existingReferencedProperties: ['A'],
        splitMockImplementations: [],
      });
    }).not.toThrow();

    expect(result).toBeDefined();
  });
});
