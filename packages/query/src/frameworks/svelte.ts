import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GetterProps,
  OutputClient,
  OutputHttpClient,
  pascal,
  toObjectString,
} from '@orval/core';
import { generateRequestFunction as generateFetchRequestFunction } from '@orval/fetch';

import {
  generateAxiosRequestFunction,
  getQueryArgumentsRequestType,
} from '../client';
import type {
  FrameworkAdapterConfig,
  MutationHookBodyContext,
  MutationOnSuccessContext,
  MutationReturnTypeContext,
  QueryInitContext,
  QueryInvocationContext,
  QueryReturnStatementContext,
  QueryReturnTypeContext,
} from '../framework-adapter';
import { getQueryOptionsDefinition } from '../query-options';
import { getQueryTypeForFramework } from '../utils';

export const createSvelteAdapter = ({
  hasSvelteQueryV4,
  hasSvelteQueryV6,
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
}: {
  hasSvelteQueryV4: boolean;
  hasSvelteQueryV6: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
}): FrameworkAdapterConfig => {
  const prefix = hasSvelteQueryV4 ? 'Create' : 'Use';

  return {
    outputClient: OutputClient.SVELTE_QUERY,
    hookPrefix: hasSvelteQueryV4 ? 'create' : 'use',
    hasQueryV5,
    hasQueryV5WithDataTagError,
    hasQueryV5WithInfiniteQueryOptionsError,

    getHookPropsDefinitions(props: GetterProps): string {
      if (hasSvelteQueryV6) {
        return toObjectString(
          props.map((p) => ({
            ...p,
            definition: p.definition.replace(':', ': () => '),
          })),
          'definition',
        );
      }
      return toObjectString(props, 'implementation');
    },

    getQueryReturnType({
      type,
      isMutatorHook,
      operationName,
    }: QueryReturnTypeContext): string {
      if (!hasSvelteQueryV4) {
        return `Use${pascal(type)}StoreResult<Awaited<ReturnType<${
          isMutatorHook
            ? `ReturnType<typeof use${pascal(operationName)}Hook>`
            : `typeof ${operationName}`
        }>>, TError, TData, QueryKey> & { queryKey: QueryKey }`;
      }

      return `Create${pascal(
        type,
      )}Result<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
    },

    getMutationReturnType({
      dataType,
      variableType,
    }: MutationReturnTypeContext): string {
      return `: CreateMutationResult<
        Awaited<ReturnType<${dataType}>>,
        TError,
        ${variableType},
        TContext
      >`;
    },

    getQueryReturnStatement({
      queryResultVarName,
      queryOptionsVarName,
    }: QueryReturnStatementContext): string {
      if (hasSvelteQueryV6) {
        return `return ${queryResultVarName}`;
      }
      if (hasSvelteQueryV4) {
        return `${queryResultVarName}.queryKey = ${queryOptionsVarName}.queryKey;

  return ${queryResultVarName};`;
      }
      // Svelte v3 - same as default
      return `return { ...${queryResultVarName}, queryKey: ${queryOptionsVarName}.queryKey };`;
    },

    generateQueryInit({
      queryOptionsFnName,
      queryProperties,
      isRequestOptions,
    }: QueryInitContext): string {
      if (hasSvelteQueryV6) {
        return '';
      }
      const queryOptionsVarName = isRequestOptions ? 'queryOptions' : 'options';
      return `const ${queryOptionsVarName} = ${queryOptionsFnName}(${queryProperties}${
        queryProperties ? ',' : ''
      }${isRequestOptions ? 'options' : 'queryOptions'})`;
    },

    generateQueryInvocationArgs({
      props,
      queryOptionsFnName,
      isRequestOptions,
      queryOptionsVarName,
      optionalQueryClientArgument,
    }: QueryInvocationContext): string {
      if (hasSvelteQueryV6) {
        return `() => ${queryOptionsFnName}(${toObjectString(
          props.map((p) => ({
            ...p,
            name: p.default || !p.required ? `${p.name}?.()` : `${p.name}()`,
          })),
          'name',
        )}${isRequestOptions ? 'options?.()' : 'queryOptions?.()'})`;
      }
      return `${queryOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''}`;
    },

    getQueryInvocationSuffix(): string {
      return hasSvelteQueryV6 ? `, queryClient` : '';
    },

    getOptionalQueryClientArgument(hasInvalidation?: boolean): string {
      if (hasSvelteQueryV6) {
        return `, queryClient?: () => QueryClient`;
      }
      if (hasQueryV5 || hasInvalidation) {
        return ', queryClient?: QueryClient';
      }
      return '';
    },

    getQueryOptionsDefinitionPrefix(): string {
      return prefix;
    },

    generateQueryArguments({
      operationName,
      definitions,
      mutator,
      isRequestOptions,
      type,
      queryParams,
      queryParam,
      initialData,
      httpClient,
      forQueryOptions = false,
    }): string {
      const definition = getQueryOptionsDefinition({
        operationName,
        mutator,
        definitions,
        type,
        prefix,
        hasQueryV5,
        hasQueryV5WithInfiniteQueryOptionsError,
        queryParams,
        queryParam,
        isReturnType: false,
        initialData,
      });

      if (!isRequestOptions) {
        return `${type ? 'queryOptions' : 'mutationOptions'}${
          initialData === 'defined' ? '' : '?'
        }: ${definition}`;
      }

      const requestType = getQueryArgumentsRequestType(httpClient, mutator);
      const isQueryRequired = initialData === 'defined';
      const optionsType = `{ ${
        type ? 'query' : 'mutation'
      }${isQueryRequired ? '' : '?'}:${definition}, ${requestType}}`;

      return `options${isQueryRequired ? '' : '?'}: ${hasSvelteQueryV6 && !forQueryOptions ? '() => ' : ''}${optionsType}\n`;
    },

    generateMutationImplementation({
      mutationOptionsFnName,
      hasInvalidation,
      isRequestOptions,
    }): string {
      if (hasSvelteQueryV6) {
        return `${mutationOptionsFnName}(${hasInvalidation ? `backupQueryClient, ` : ''}${
          isRequestOptions ? 'options' : 'mutationOptions'
        }?.())`;
      }
      return `${mutationOptionsFnName}(${hasInvalidation ? `queryClient ?? backupQueryClient, ` : ''}${
        isRequestOptions ? 'options' : 'mutationOptions'
      })`;
    },

    supportsMutationInvalidation(): boolean {
      return true;
    },

    generateMutationOnSuccess({
      operationName,
      definitions,
      generateInvalidateCall,
      uniqueInvalidates,
    }: MutationOnSuccessContext): string {
      if (hasSvelteQueryV6) {
        return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, onMutateResult: TContext, context: MutationFunctionContext) => {
${uniqueInvalidates.map((t) => generateInvalidateCall(t)).join('\n')}
    mutationOptions?.onSuccess?.(data, variables, onMutateResult, context);
  };`;
      }
      return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, context: TContext | undefined) => {
${uniqueInvalidates.map((t) => generateInvalidateCall(t)).join('\n')}
    mutationOptions?.onSuccess?.(data, variables, context);
  };`;
    },

    generateMutationHookBody({
      operationPrefix,
      mutationImplementation,
      hasInvalidation,
      optionalQueryClientArgument,
    }: MutationHookBodyContext): string {
      if (hasSvelteQueryV6) {
        return `      ${hasInvalidation ? `const backupQueryClient = useQueryClient(${optionalQueryClientArgument ? 'queryClient?.()' : ''});\n      ` : ''}return ${operationPrefix}Mutation(() => ({ ...${mutationImplementation} })${optionalQueryClientArgument ? `, queryClient` : ''});`;
      }
      // Svelte v4/v5
      return `      ${hasInvalidation ? `const backupQueryClient = useQueryClient();\n      ` : ''}return ${operationPrefix}Mutation(${mutationImplementation});`;
    },

    getQueryType(type: string): string {
      if (hasSvelteQueryV4) {
        return getQueryTypeForFramework(type);
      }
      return type;
    },

    generateRequestFunction(
      verbOptions: GeneratorVerbOptions,
      options: GeneratorOptions,
    ): string {
      return options.context.output.httpClient === OutputHttpClient.AXIOS
        ? generateAxiosRequestFunction(verbOptions, options, false)
        : generateFetchRequestFunction(verbOptions, options);
    },
  };
};
