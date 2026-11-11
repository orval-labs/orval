import { defineConfig } from 'orval';

const project = (name: string, output: Record<string, unknown>) => ({
  output: {
    target: `../generated/valibot-schemas/${name}/endpoints.ts`,
    schemas: {
      path: `../generated/valibot-schemas/${name}/model`,
      type: 'valibot' as const,
    },
    clean: true,
    formatter: 'prettier' as const,
    ...output,
  },
  input: { target: '../specifications/valibot-schemas.yaml' },
});

const edge = { target: '../specifications/valibot-schemas-edge.yaml' };

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
    input: { target: '../specifications/valibot-schemas-date.yaml' },
  },
  fetchShared: project('fetch-shared', {
    client: 'fetch',
    override: {
      fetch: { runtimeValidation: true, runtimeImplementationStyle: 'shared' },
    },
  }),
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
