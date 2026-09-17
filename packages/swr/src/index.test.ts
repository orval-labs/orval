import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
  isFunction,
  OutputClient,
  OutputHttpClient,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils/context';
import { builder, generateSwr } from './index';

describe('swr builder', () => {
  it('returns a valid builder function', () => {
    const result = builder();
    expect(result).toBeDefined();
    expect(isFunction(result)).toBe(true);
  });

  it('builder returns client builder with required methods', () => {
    const result = builder()();
    expect(result).toBeDefined();
    expect(result.client).toBeDefined();
    expect(result.dependencies).toBeDefined();
    expect(result.header).toBeDefined();
    expect(isFunction(result.client)).toBe(true);
    expect(isFunction(result.dependencies)).toBe(true);
    expect(isFunction(result.header)).toBe(true);
  });
});

describe('generateSwr — fetch runtimeValidation imports (#4136, #4137)', () => {
  const makeVerbOptions = ({
    definition,
    type,
    runtimeValidation = true,
  }: {
    definition: string;
    type: string;
    runtimeValidation?: boolean;
  }): GeneratorVerbOptions =>
    ({
      verb: 'get',
      route: '/items',
      pathRoute: '/items',
      operationId: 'listItems',
      operationName: 'listItems',
      typeName: 'listItems',
      doc: '',
      tags: [],
      response: {
        definition: { success: definition, errors: '' },
        imports: [{ name: 'Item' }],
        types: {
          success: [
            {
              key: '200',
              value: definition,
              contentType: 'application/json',
              hasReadonlyProps: false,
              imports: [{ name: 'Item' }],
              isEnum: false,
              isRef: type !== 'array',
              schemas: [],
              type,
              dependencies: [],
            },
          ],
          errors: [],
        },
        contentTypes: ['application/json'],
        schemas: [],
        isBlob: false,
      },
      body: {
        definition: '',
        implementation: '',
        imports: [],
        schemas: [],
        formData: undefined,
        formUrlEncoded: undefined,
        contentType: '',
        isOptional: true,
        originalSchema: {},
        isBlob: false,
      },
      params: [],
      props: [],
      override: {
        formData: { disabled: false, arrayHandling: 'serialize' },
        formUrlEncoded: false,
        requestOptions: true,
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
          runtimeValidation: {
            enabled: runtimeValidation,
            strategy: 'throw',
          },
        },
        swr: {},
      },
      originalOperation: {},
    }) as unknown as GeneratorVerbOptions;

  const options = {
    route: '/items',
    pathRoute: '/items',
    override: { operations: {} },
    output: '',
    context: createTestContextSpec({
      output: {
        client: OutputClient.SWR,
        httpClient: OutputHttpClient.FETCH,
        schemas: { path: './model', type: 'zod', splitByTags: false },
      },
    }),
  } as unknown as GeneratorOptions;

  it('imports the schema as a value and the Output alias it declares', async () => {
    const { implementation, imports } = await generateSwr(
      makeVerbOptions({ definition: 'Item', type: 'object' }),
      options,
      'swr',
    );

    expect(implementation).toContain('Item.parse(parsedBody)');
    expect(implementation).toContain('): Promise<ItemOutput> =>');
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'Item', values: true }),
    );
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'ItemOutput' }),
    );
  });

  it('imports the element schema and zod for an inline array response', async () => {
    const { implementation, imports } = await generateSwr(
      makeVerbOptions({ definition: 'Item[]', type: 'array' }),
      options,
      'swr',
    );

    expect(implementation).toContain('zod.array(Item).parse(parsedBody)');
    expect(implementation).toContain('): Promise<ItemOutput[]> =>');
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'Item', values: true }),
    );
    expect(imports).toContainEqual(
      expect.objectContaining({ name: 'zod', namespaceImport: true }),
    );
  });

  it('keeps the schema import type-only when runtimeValidation is off', async () => {
    const { implementation, imports } = await generateSwr(
      makeVerbOptions({
        definition: 'Item',
        type: 'object',
        runtimeValidation: false,
      }),
      options,
      'swr',
    );

    expect(implementation).not.toContain('Item.parse(');
    expect(imports).toContainEqual({ name: 'Item' });
    expect(imports).not.toContainEqual(
      expect.objectContaining({ name: 'ItemOutput' }),
    );
  });
});
