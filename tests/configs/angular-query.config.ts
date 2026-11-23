import { defineConfig, type OverrideOutput } from 'orval';

// `useDatesTransform` with a mapped `date-time`. The spec keeps dates out of
// path params, which a query key would interpolate as an object.
const datesTransform = (
  name: string,
  override: OverrideOutput = {},
  schemaType?: 'zod',
) => ({
  output: {
    target: `../generated/angular-query/${name}/endpoints.ts`,
    schemas: schemaType
      ? { type: schemaType, path: `../generated/angular-query/${name}/model` }
      : `../generated/angular-query/${name}/model`,
    client: 'angular-query' as const,
    httpClient: 'angular' as const,
    override: {
      query: { signal: true },
      useDatesTransform: true,
      formatType: {
        'date-time': {
          type: 'Temporal.Instant',
          decode: 'Temporal.Instant.from',
          encode: 'String',
        },
      },
      ...override,
    },
    clean: true,
    formatter: 'prettier' as const,
  },
  input: {
    target: '../specifications/angular-dates-transform-tags.yaml',
  },
});

export default defineConfig({
  logLevel: 'error',
  basic: {
    output: {
      target: '../generated/angular-query/basic/endpoints.ts',
      schemas: '../generated/angular-query/basic/model',
      client: 'angular-query',
      httpClient: 'angular',
      override: {
        query: {
          signal: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  tagsSplit: {
    output: {
      target: '../generated/angular-query/tags-split/endpoints.ts',
      schemas: '../generated/angular-query/tags-split/model',
      client: 'angular-query',
      httpClient: 'angular',
      mode: 'tags-split',
      override: {
        query: {
          signal: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  split: {
    output: {
      target: '../generated/angular-query/split/endpoints.ts',
      schemas: '../generated/angular-query/split/model',
      client: 'angular-query',
      httpClient: 'angular',
      mode: 'split',
      override: {
        query: {
          signal: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  usePrefetch: {
    output: {
      target: '../generated/angular-query/use-prefetch/endpoints.ts',
      schemas: '../generated/angular-query/use-prefetch/model',
      client: 'angular-query',
      httpClient: 'angular',
      override: {
        query: {
          usePrefetch: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  urlEncodeParameters: {
    output: {
      target: '../generated/angular-query/url-encode-parameters/endpoints.ts',
      schemas: '../generated/angular-query/url-encode-parameters/model',
      client: 'angular-query',
      httpClient: 'angular',
      mock: true,
      urlEncodeParameters: true,
      override: {
        query: {
          signal: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // `useInfiniteQueryParamLocation: 'body'` (#4025): the page param `offset`
  // is a property of the JSON request body, not a URL query parameter.
  // `exportElements` has no `offset` in its body, so it gets no infinite hook.
  infiniteQueryParamBody: {
    output: {
      target:
        '../generated/angular-query/infinite-query-param-body/endpoints.ts',
      schemas: '../generated/angular-query/infinite-query-param-body/model',
      client: 'angular-query',
      mode: 'single',
      clean: true,
      formatter: 'prettier',
      httpClient: 'angular',
      override: {
        query: {
          useInfiniteQueryParam: 'offset',
          useInfiniteQueryParamLocation: 'body',
        },
        operations: {
          searchElements: {
            query: {
              useQuery: true,
              useInfinite: true,
              useSuspenseInfiniteQuery: false,
            },
          },
          searchGroupElements: { query: { useInfinite: true } },
          searchTaggedElements: { query: { useInfinite: true } },
          exportElements: { query: { useInfinite: true } },
        },
      },
    },
    input: {
      target: '../specifications/infinite-query-param-body.yaml',
    },
  },
  typedHeaderParameters: {
    output: {
      target: '../generated/angular-query/typed-header-parameters/endpoints.ts',
      schemas: '../generated/angular-query/typed-header-parameters/model',
      client: 'angular-query',
      httpClient: 'angular',
      headers: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/typed-header-parameters.yaml',
    },
  },
  // #4592: `useDatesTransform` converts dates in the `HttpClient` request
  // functions, through a custom mutator, and before Zod validates the body.
  datesTransform: datesTransform('dates-transform'),
  datesTransformMutator: datesTransform('dates-transform-mutator', {
    mutator: {
      path: '../mutators/custom-client-angular-query.ts',
      name: 'customClient',
    },
  }),
  datesTransformZod: datesTransform(
    'dates-transform-zod',
    { query: { signal: true, runtimeValidation: true } },
    'zod',
  ),
});
