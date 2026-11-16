import { defineConfig, defineTransformer } from 'orval';

// Shares the specifications with the valibot fixture. Their titles name
// Valibot, which the generated headers would repeat.
const input = (target: string) => ({
  target,
  override: {
    transformer: defineTransformer((spec) => ({
      ...spec,
      info: {
        ...spec.info,
        title: spec.info.title.replace(/^Valibot/, 'Effect'),
      },
    })),
  },
});

const project = (name: string, output: Record<string, unknown>) => ({
  output: {
    target: `../generated/effect-schemas/${name}/endpoints.ts`,
    schemas: {
      path: `../generated/effect-schemas/${name}/model`,
      type: 'effect' as const,
    },
    clean: true,
    formatter: 'prettier' as const,
    ...output,
  },
  input: input('../specifications/valibot-schemas.yaml'),
});

const edge = input('../specifications/valibot-schemas-edge.yaml');

const fetchValidation = { fetch: { runtimeValidation: true } };
const angularValidation = (retrievalClient: string) => ({
  angular: { retrievalClient, runtimeValidation: true },
});

export default defineConfig({
  logLevel: 'error',
  fetch: project('fetch', { client: 'fetch', override: fetchValidation }),
  fetchBoth: project('fetch-both', {
    client: 'fetch',
    override: { fetch: { runtimeValidation: { strategy: 'both' } } },
  }),
  fetchDates: project('fetch-dates', {
    client: 'fetch',
    override: { ...fetchValidation, useDates: true, useDatesTransform: true },
  }),
  fetchDateComponent: {
    ...project('fetch-date-component', {
      client: 'fetch',
      override: { ...fetchValidation, useDates: true },
    }),
    input: input('../specifications/valibot-schemas-date.yaml'),
  },
  fetchShared: project('fetch-shared', {
    client: 'fetch',
    override: {
      fetch: { runtimeValidation: true, runtimeImplementationStyle: 'shared' },
    },
  }),
  // The mutator is shared with the valibot fixture and validates through
  // `~standard`.
  fetchMutator: project('fetch-mutator', {
    client: 'fetch',
    override: {
      ...fetchValidation,
      includeZodSchemaInArguments: true,
      mutator: {
        path: '../mutators/valibot-schema-fetch.ts',
        name: 'schemaFetch',
      },
    },
  }),
  fetchMutatorNative: project('fetch-mutator-native', {
    client: 'fetch',
    override: {
      ...fetchValidation,
      includeZodSchemaInArguments: true,
      mutator: {
        path: '../mutators/effect-schema-fetch.ts',
        name: 'effectSchemaFetch',
      },
    },
  }),
  reactQuery: project('react-query', {
    client: 'react-query',
    httpClient: 'fetch',
    override: fetchValidation,
  }),
  swr: project('swr', {
    client: 'swr',
    httpClient: 'fetch',
    override: fetchValidation,
  }),
  fetchEdge: {
    ...project('fetch-edge', {
      client: 'fetch',
      override: {
        ...fetchValidation,
        useDates: true,
        useNamedParameters: true,
      },
    }),
    input: edge,
  },
  fetchNames: {
    ...project('fetch-names', {
      client: 'fetch',
      override: fetchValidation,
    }),
    input: input('../specifications/effect-schemas-names.yaml'),
  },
  fetchValidation: {
    ...project('fetch-validation', {
      client: 'fetch',
      override: fetchValidation,
    }),
    input: input('../specifications/effect-schemas-validation.yaml'),
  },
  angularNames: {
    ...project('angular-names', {
      client: 'angular',
      override: angularValidation('httpClient'),
    }),
    input: input('../specifications/effect-schemas-names.yaml'),
  },
  axios: project('axios', { client: 'axios' }),
  angular: project('angular', {
    client: 'angular',
    override: angularValidation('httpClient'),
  }),
  angularBodies: project('angular-bodies', {
    client: 'angular',
    override: {
      angular: {
        retrievalClient: 'httpClient',
        runtimeValidation: { enabled: true, requestBodies: true },
      },
    },
  }),
  angularResource: project('angular-resource', {
    client: 'angular',
    override: angularValidation('httpResource'),
  }),
  angularQuery: project('angular-query', {
    client: 'angular-query',
    override: { query: { runtimeValidation: true } },
  }),
});
