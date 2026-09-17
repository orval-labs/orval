import {
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientHeaderBuilder,
  generateVerbImports,
  getArrayResponseSchema,
  getZodNamespaceImport,
  hasSchemaImport,
  isPrimitiveResponseType,
  mergeDeep,
  type NormalizedOutputOptions,
  OutputHttpClient,
  type QueryOptions,
  rewriteImportsForResponseValidation,
} from '@orval/core';
import { getFetchResponseValidationImports } from '@orval/fetch';

import { getQueryHeader } from './client';
import {
  getAngularQueryDependencies,
  getReactQueryDependencies,
  getSolidQueryDependencies,
  getSvelteQueryDependencies,
  getVueQueryDependencies,
} from './dependencies';
import { createFrameworkAdapter } from './frameworks';
import { generateQueryHook } from './query-generator';
import { normalizeQueryOptions } from './utils';

export {
  getAngularQueryDependencies,
  getReactQueryDependencies,
  getSolidQueryDependencies,
  getSvelteQueryDependencies,
  getVueQueryDependencies,
} from './dependencies';

// Lazy-getter merge helper emitted once per file for the react-query client.
// It attaches `queryKey` to the hook result without spreading it (which would
// read every tracked field and over-subscribe the consumer) or mutating it
// (which react-compiler forbids). Each field is re-exposed as an own getter so
// React Query v5's per-property tracking still fires only for fields the
// consumer actually reads. See #3573.
const WITH_QUERY_KEY_HELPER = `const withQueryKey = <T extends object, K>(query: T, queryKey: K): T & { queryKey: K } => {
  const result = { queryKey } as T & { queryKey: K };
  for (const key of Object.keys(query)) {
    // The explicit queryKey always wins, matching the previous
    // \`{ ...query, queryKey }\` spread where it was set last.
    if (key === 'queryKey') continue;
    Object.defineProperty(result, key, {
      enumerable: true,
      configurable: true,
      get: () => (query as Record<string, unknown>)[key],
    });
  }
  return result;
};`;

export const generateQueryHeader: ClientHeaderBuilder = (params) => {
  const needsWithQueryKey =
    params.clientImplementation.includes('withQueryKey(');

  const innerHeader = getQueryHeader(params);
  const innerImpl =
    typeof innerHeader === 'string' ? innerHeader : innerHeader.implementation;
  const innerSharedTypes =
    typeof innerHeader === 'string' ? undefined : innerHeader.sharedTypes;

  const ownImplementation = `${
    params.hasAwaitedType
      ? ''
      : `type AwaitedInput<T> = PromiseLike<T> | T;\n
      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;\n\n`
  }
${
  params.isRequestOptions && params.isMutator
    ? `type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];\n\n`
    : ''
}
${innerImpl}
${needsWithQueryKey ? `${WITH_QUERY_KEY_HELPER}\n\n` : ''}`;

  if (innerSharedTypes && innerSharedTypes.length > 0) {
    return {
      implementation: ownImplementation,
      sharedTypes: innerSharedTypes,
    };
  }

  return ownImplementation;
};

export const generateQuery: ClientBuilder = async (
  verbOptions,
  options,
  outputClient,
) => {
  const adapter = createFrameworkAdapter({
    outputClient,
    packageJson: options.context.output.packageJson,
    queryVersion: verbOptions.override.query.version,
  });

  // Every non-Angular framework delegates its request function to the fetch (or
  // axios) generator, so what the response imports have to look like is that
  // generator's answer to give — `override.query.runtimeValidation` only drives
  // the Angular HttpClient pipeline built below (#4136, #4137).
  const fetchValidationImports =
    !adapter.isAngularHttp &&
    options.context.output.httpClient === OutputHttpClient.FETCH
      ? getFetchResponseValidationImports(verbOptions, options)
      : undefined;

  const isZodOutput =
    typeof options.context.output.schemas === 'object' &&
    options.context.output.schemas.type === 'zod';
  const responseType = verbOptions.response.definition.success;
  // A custom mutator skips the generated parse entirely, so its schema
  // import stays type-only and no rewrite is needed.
  const shouldUseRuntimeValidation =
    adapter.isAngularHttp &&
    verbOptions.override.query.runtimeValidation?.enabled &&
    !verbOptions.mutator &&
    isZodOutput &&
    !isPrimitiveResponseType(responseType) &&
    hasSchemaImport(verbOptions.response.imports, responseType);
  // An inline array response resolves to `Item[]`, which the exact-name check
  // above never matches: the Angular HttpClient request function validates it
  // through `zod.array(Item)`, so the element becomes the value import and
  // contributes the `Output` alias (#3718, #4106).
  const responseArraySchema =
    isZodOutput &&
    adapter.isAngularHttp &&
    verbOptions.override.query.runtimeValidation?.enabled &&
    !verbOptions.mutator
      ? getArrayResponseSchema(verbOptions.response.imports, responseType)
      : undefined;

  const validatedResponseImports = fetchValidationImports
    ? fetchValidationImports.imports
    : shouldUseRuntimeValidation
      ? rewriteImportsForResponseValidation(
          verbOptions.response.imports,
          responseType,
        )
      : responseArraySchema
        ? rewriteImportsForResponseValidation(
            verbOptions.response.imports,
            responseArraySchema.elementName,
          )
        : undefined;

  const normalizedVerbOptions = validatedResponseImports
    ? {
        ...verbOptions,
        response: {
          ...verbOptions.response,
          imports: validatedResponseImports,
        },
      }
    : verbOptions;

  const imports = generateVerbImports(normalizedVerbOptions);
  const functionImplementation = adapter.generateRequestFunction(
    normalizedVerbOptions,
    options,
  );
  const {
    implementation: hookImplementation,
    imports: hookImports,
    mutators,
  } = await generateQueryHook(
    normalizedVerbOptions,
    options,
    outputClient,
    adapter,
  );

  const isFetchHttpClient =
    options.context.output.httpClient !== OutputHttpClient.AXIOS;

  return {
    implementation: `${functionImplementation}\n\n${hookImplementation}`,
    imports: [
      ...imports,
      ...hookImports,
      ...(responseArraySchema || fetchValidationImports?.composesZodArray
        ? [getZodNamespaceImport(options.context.output.override)]
        : []),
    ],
    mutators,
    ...(isFetchHttpClient && { docComment: '' }),
  };
};

const dependenciesBuilder: Record<
  | 'react-query'
  | 'vue-query'
  | 'svelte-query'
  | 'angular-query'
  | 'solid-query',
  ClientDependenciesBuilder
> = {
  'react-query': getReactQueryDependencies,
  'vue-query': getVueQueryDependencies,
  'svelte-query': getSvelteQueryDependencies,
  'angular-query': getAngularQueryDependencies,
  'solid-query': getSolidQueryDependencies,
};

export const builder =
  ({
    type = 'react-query',
    options: queryOptions,
    output,
  }: {
    type?:
      | 'react-query'
      | 'vue-query'
      | 'svelte-query'
      | 'angular-query'
      | 'solid-query';
    options?: QueryOptions;
    output?: NormalizedOutputOptions;
  } = {}) =>
  () => {
    const client: ClientBuilder = (verbOptions, options, outputClient) => {
      if (
        options.override.useNamedParameters &&
        (type === 'vue-query' || outputClient === 'vue-query')
      ) {
        throw new Error(
          `vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686`,
        );
      }

      if (queryOptions) {
        const normalizedQueryOptions = normalizeQueryOptions(
          queryOptions,
          options.context.workspace,
        );
        verbOptions.override.query = mergeDeep(
          normalizedQueryOptions,
          verbOptions.override.query,
        );
        options.override.query = mergeDeep(
          normalizedQueryOptions,
          verbOptions.override.query,
        );
      }
      return generateQuery(verbOptions, options, outputClient, output);
    };

    return {
      client: client,
      header: generateQueryHeader,
      dependencies: dependenciesBuilder[type],
    };
  };

export default builder;
