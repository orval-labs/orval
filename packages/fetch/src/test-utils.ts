import type {
  ContextSpec,
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiParameterObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResReqTypesValue,
} from '@orval/core';
import { OutputClient, PropertySortOrder, Verbs } from '@orval/core';

import {
  createTestContextSpec,
  createTestGeneratorOptions,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';

type OpenApiParameterLike = OpenApiParameterObject | OpenApiReferenceObject;

export type TestParameter = {
  name: string;
  in: string;
  style?: string;
  explode?: boolean;
  // Record keeps widened fixture objects assignable. OpenApiSchemaObject
  // adds JSON Schema booleans, which Record<string, unknown> rejects.
  schema?: OpenApiSchemaObject | Record<string, unknown>;
};

export const successType = (
  overrides: Partial<ResReqTypesValue> &
    Pick<ResReqTypesValue, 'key' | 'value'>,
): ResReqTypesValue => ({
  contentType: 'application/json',
  hasReadonlyProps: false,
  imports: [],
  isEnum: false,
  isRef: false,
  schemas: [],
  type: 'object',
  dependencies: [],
  ...overrides,
});

export function makeContext(
  parameters: TestParameter[] = [],
  useDates = false,
  schemas?: ContextSpec['output']['schemas'],
): ContextSpec {
  const context = createTestContextSpec({
    spec: {
      paths: {
        '/pets': {
          get: {
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    },
    output: {
      propertySortOrder: PropertySortOrder.ALPHABETICAL,
      ...(schemas === undefined ? {} : { schemas }),
    },
    override: { useDates },
  });
  const operation = context.spec.paths?.['/pets']?.get;
  if (operation) {
    operation.parameters = parameters as OpenApiParameterLike[];
  }
  return context;
}

export function makeVerbOptions(
  overrides: Parameters<typeof createTestGeneratorVerbOptions>[0] = {},
): GeneratorVerbOptions {
  const { override, ...rest } = overrides;
  return createTestGeneratorVerbOptions({
    verb: Verbs.GET,
    route: '/pets',
    pathRoute: '/pets',
    operationId: 'listPets',
    operationName: 'listPets',
    typeName: 'listPets',
    response: {
      definition: { success: 'Pet[]', errors: '' },
      contentTypes: ['application/json'],
    },
    ...rest,
    override: {
      requestOptions: false,
      formUrlEncoded: false,
      fetch: {
        includeHttpResponseReturnType: false,
        forceSuccessResponse: false,
        runtimeValidation: { enabled: false, strategy: 'throw' },
      },
      ...override,
    },
  });
}

export function makeOptions(
  context: ContextSpec,
  overrides: Partial<GeneratorOptions> = {},
): GeneratorOptions {
  return {
    ...createTestGeneratorOptions({
      route: '/pets',
      pathRoute: '/pets',
    }),
    context,
    ...overrides,
  } satisfies GeneratorOptions;
}

export const STUB_QUERY_PARAMS = {
  schema: {
    name: 'ListPetsParams',
    model: 'export type ListPetsParams = { limit?: string }',
    imports: [],
  },
  deps: [],
  isOptional: true,
} satisfies NonNullable<GeneratorVerbOptions['queryParams']>;

export function makeSharedOptions(
  parameters: TestParameter[] = [],
  {
    client = OutputClient.FETCH,
    useDates = false,
    mutator,
  }: {
    client?: OutputClient;
    useDates?: boolean;
    mutator?: boolean;
  } = {},
): GeneratorOptions {
  const options = makeOptions(makeContext(parameters, useDates));
  options.context.output.target = '/proj/src/api/endpoints.ts';
  options.context.output.client = client;
  Object.assign(options.context.output.override.fetch, {
    runtimeImplementationStyle: 'shared',
    runtimeOutputPath: '/proj/src/runtime.ts',
    clientConfigOutputPath: '/proj/src/api/client-config.ts',
  });
  if (mutator) {
    options.context.output.override.mutator = {
      path: '/proj/src/custom-fetch.ts',
      name: 'customFetch',
      default: false,
    };
  }
  return options;
}
