import {
  type GeneratorVerbOptions,
  isFunction,
  OutputClient,
  OutputHttpClient,
  type ResReqTypesValue,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  createTestGeneratorOptions,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
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
    type: ResReqTypesValue['type'];
    runtimeValidation?: boolean;
  }): GeneratorVerbOptions =>
    createTestGeneratorVerbOptions({
      verb: 'get',
      route: '/items',
      pathRoute: '/items',
      operationId: 'listItems',
      operationName: 'listItems',
      typeName: 'listItems',
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
            } satisfies ResReqTypesValue,
          ],
          errors: [],
        },
        contentTypes: ['application/json'],
      },
      override: {
        requestOptions: true,
        fetch: {
          includeHttpResponseReturnType: false,
          forceSuccessResponse: false,
          runtimeValidation: {
            enabled: runtimeValidation,
            strategy: 'throw',
          },
        },
      },
    });

  const options = createTestGeneratorOptions({
    route: '/items',
    pathRoute: '/items',
    context: {
      output: {
        client: OutputClient.SWR,
        httpClient: OutputHttpClient.FETCH,
        schemas: { path: './model', type: 'zod', splitByTags: false },
      },
    },
  });

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
