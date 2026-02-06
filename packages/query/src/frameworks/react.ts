import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getRouteAsArray,
  type GetterParams,
  type GetterProp,
  type GetterProps,
  GetterPropType,
  isObject,
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
  FrameworkAdapter,
  MutationHookBodyContext,
  MutationOnSuccessContext,
  MutationReturnTypeContext,
  QueryInitContext,
  QueryInvocationContext,
  QueryReturnStatementContext,
  QueryReturnTypeContext,
} from '../framework-adapter';
import { getQueryOptionsDefinition, isSuspenseQuery } from '../query-options';

export const createReactAdapter = ({
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
}: {
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
}): FrameworkAdapter => ({
  outputClient: OutputClient.REACT_QUERY,
  hookPrefix: 'use',
  isAngularHttp: false,
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,

  transformProps(props: GetterProps): GetterProps {
    return props;
  },

  getHookPropsDefinitions(props: GetterProps): string {
    return toObjectString(props, 'implementation');
  },

  shouldDestructureNamedPathParams(): boolean {
    return true;
  },

  getHttpFunctionQueryProps(
    queryProperties: string,
    _httpClient: OutputHttpClient,
  ): string {
    return queryProperties;
  },

  getHttpFirstParam(): string {
    return '';
  },

  getMutationHttpPrefix(): string {
    return '';
  },

  getInfiniteQueryHttpProps(props: GetterProps, queryParam: string): string {
    return props
      .map((param) => {
        if (param.type === GetterPropType.NAMED_PATH_PARAMS)
          return param.destructured;
        return param.name === 'params'
          ? `{...params, '${queryParam}': pageParam || params?.['${queryParam}']}`
          : param.name;
      })
      .join(',');
  },

  getQueryReturnType({
    type,
    isInitialDataDefined,
  }: QueryReturnTypeContext): string {
    return ` ${
      isInitialDataDefined && !isSuspenseQuery(type) ? 'Defined' : ''
    }Use${pascal(type)}Result<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
  },

  getMutationReturnType({
    dataType,
    variableType,
  }: MutationReturnTypeContext): string {
    return `: UseMutationResult<
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
    return `return { ...${queryResultVarName}, queryKey: ${queryOptionsVarName}.queryKey };`;
  },

  getQueryKeyRouteString(route: string, shouldSplitQueryKey: boolean): string {
    if (shouldSplitQueryKey) {
      return getRouteAsArray(route);
    }
    return `\`${route}\``;
  },

  shouldAnnotateQueryKey(): boolean {
    return true;
  },

  getUnrefStatements(): string {
    return '';
  },

  generateQueryInit({
    queryOptionsFnName,
    queryProperties,
    isRequestOptions,
  }: QueryInitContext): string {
    const queryOptionsVarName = isRequestOptions ? 'queryOptions' : 'options';
    return `const ${queryOptionsVarName} = ${queryOptionsFnName}(${queryProperties}${
      queryProperties ? ',' : ''
    }${isRequestOptions ? 'options' : 'queryOptions'})`;
  },

  generateQueryInvocationArgs({
    queryOptionsVarName,
    optionalQueryClientArgument,
  }: QueryInvocationContext): string {
    return `${queryOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''}`;
  },

  getQueryInvocationSuffix(): string {
    return '';
  },

  shouldGenerateOverrideTypes(): boolean {
    return hasQueryV5;
  },

  getOptionalQueryClientArgument(): string {
    return hasQueryV5 ? ', queryClient?: QueryClient' : '';
  },

  getQueryOptionsDefinitionPrefix(): string {
    return 'Use';
  },

  generateEnabledOption(
    params: GetterParams,
    options?: object | boolean,
  ): string {
    if (!isObject(options) || !Object.hasOwn(options, 'enabled')) {
      return `enabled: !!(${params.map(({ name }) => name).join(' && ')}),`;
    }
    return '';
  },

  getQueryKeyPrefix(): string {
    return 'queryOptions?.queryKey ?? ';
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
  }): string {
    const definition = getQueryOptionsDefinition({
      operationName,
      mutator,
      definitions,
      type,
      prefix: 'Use',
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

    return `options${isQueryRequired ? '' : '?'}: ${optionsType}\n`;
  },

  generateMutationImplementation({
    mutationOptionsFnName,
    hasInvalidation,
    isRequestOptions,
  }): string {
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
    return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, context: TContext) => {
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
    return `      ${hasInvalidation ? `const backupQueryClient = useQueryClient();\n      ` : ''}return ${operationPrefix}Mutation(${mutationImplementation}${optionalQueryClientArgument ? `, queryClient` : ''});`;
  },

  getQueryType(type: string): string {
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

  getQueryPropertyForProp(
    prop: GetterProp,
    body: { implementation: string },
  ): string {
    if (prop.type === GetterPropType.NAMED_PATH_PARAMS)
      return prop.destructured;
    return prop.type === GetterPropType.BODY ? body.implementation : prop.name;
  },
});
