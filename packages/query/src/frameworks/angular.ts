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
  toObjectString,
} from '@orval/core';

import {
  generateAngularHttpRequestFunction,
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
import { getQueryOptionsDefinition, QueryType } from '../query-options';
import { getQueryTypeForFramework } from '../utils';

export const createAngularAdapter = ({
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
}: {
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
}): FrameworkAdapter => ({
  outputClient: OutputClient.ANGULAR_QUERY,
  hookPrefix: 'inject',
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,

  transformProps(props: GetterProps): GetterProps {
    return props;
  },

  getHookPropsDefinitions(props: GetterProps): string {
    // Angular: allow params to be a getter function for reactive signal support
    return toObjectString(
      props.map((prop) => {
        const getterType = prop.definition.replace(
          /^(\w+)(\??): (.+)$/,
          (
            _match: string,
            name: string,
            optional: string,
            type: string,
          ): string =>
            `${name}${optional}: ${type} | (() => ${type.replace(' | undefined', '')}${optional ? ' | undefined' : ''})`,
        );
        return { ...prop, definition: getterType };
      }),
      'definition',
    );
  },

  shouldDestructureNamedPathParams(): boolean {
    return true;
  },

  getHttpFunctionQueryProps(
    queryProperties: string,
    _httpClient: OutputHttpClient,
    isAngularHttp: boolean,
    hasMutator: boolean,
  ): string {
    // For Angular, prefix with http since request functions take HttpClient as first param
    // Skip when custom mutator is used
    if (isAngularHttp && !hasMutator) {
      return queryProperties ? `http, ${queryProperties}` : 'http';
    }
    return queryProperties;
  },

  getInfiniteQueryHttpProps(
    props: GetterProps,
    queryParam: string,
    isAngularHttp: boolean,
    hasMutator: boolean,
  ): string {
    let result = props
      .map((param) => {
        if (param.type === GetterPropType.NAMED_PATH_PARAMS)
          return param.destructured;
        return param.name === 'params'
          ? `{...params, '${queryParam}': pageParam || params?.['${queryParam}']}`
          : param.name;
      })
      .join(',');

    // For Angular with infinite queries, prefix with http
    // Skip when custom mutator is used
    if (isAngularHttp && !hasMutator) {
      result = result ? `http, ${result}` : 'http';
    }

    return result;
  },

  getQueryReturnType({ type }: QueryReturnTypeContext): string {
    if (type !== QueryType.INFINITE && type !== QueryType.SUSPENSE_INFINITE) {
      return `CreateQueryResult<TData, TError>`;
    }
    return `CreateInfiniteQueryResult<TData, TError>`;
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
  }: QueryReturnStatementContext): string {
    return `return ${queryResultVarName};`;
  },

  getQueryKeyRouteString(route: string, shouldSplitQueryKey: boolean): string {
    if (shouldSplitQueryKey) {
      return getRouteAsArray(route);
    }
    return `\`${route}\``;
  },

  shouldAnnotateQueryKey(): boolean {
    // Angular skips DataTag annotation
    return false;
  },

  getUnrefStatements(): string {
    return '';
  },

  generateQueryInit({ mutator }: QueryInitContext): string {
    // Angular: inject HttpClient if needed, no queryOptions assignment
    if (!mutator || mutator.hasSecondArg) {
      return `const http = inject(HttpClient);`;
    }
    return '';
  },

  generateQueryInvocationArgs({
    props,
    queryOptionsFnName,
    isRequestOptions,
    mutator,
  }: QueryInvocationContext): string {
    // Angular: () => { resolve getters; return options(http, ...); }
    return `() => {${
      props.length > 0
        ? `
    // Resolve params if getter function (for signal reactivity)
    ${props.map((p) => `const _${p.name} = typeof ${p.name} === 'function' ? ${p.name}() : ${p.name};`).join('\n    ')}`
        : ''
    }
    // Resolve options if getter function (for signal reactivity)
    const _options = typeof ${isRequestOptions ? 'options' : 'queryOptions'} === 'function' ? ${isRequestOptions ? 'options' : 'queryOptions'}() : ${isRequestOptions ? 'options' : 'queryOptions'};
    return ${queryOptionsFnName}(${!mutator || mutator.hasSecondArg ? 'http' : ''}${props.length > 0 ? `${!mutator || mutator.hasSecondArg ? ', ' : ''}${props.map((p) => `_${p.name}`).join(', ')}` : ''}, _options);
  }`;
  },

  getQueryInvocationSuffix(): string {
    return '';
  },

  shouldGenerateOverrideTypes(): boolean {
    return false;
  },

  getOptionalQueryClientArgument(): string {
    // Angular never has optional queryClient argument (it injects it)
    return '';
  },

  getQueryOptionsDefinitionPrefix(): string {
    return 'Create';
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
    forQueryOptions = false,
  }): string {
    const definition = getQueryOptionsDefinition({
      operationName,
      mutator,
      definitions,
      type,
      prefix: 'Create',
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

    // For Angular inject* functions (query hooks, not queryOptions or mutations),
    // allow options to be a getter for reactivity.
    // Inject style applies when type is defined (it's a query hook) and not forQueryOptions.
    const forAngularInject = type !== undefined && !forQueryOptions;
    if (forAngularInject) {
      return `options${isQueryRequired ? '' : '?'}: ${optionsType} | (() => ${optionsType})\n`;
    }

    return `options${isQueryRequired ? '' : '?'}: ${optionsType}\n`;
  },

  generateMutationImplementation({
    mutationOptionsFnName,
    hasInvalidation,
    isRequestOptions,
  }): string {
    return `${mutationOptionsFnName}(${hasInvalidation ? `queryClient, ` : ''}${
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
    return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, onMutateResult: TContext, context: MutationFunctionContext) => {
${uniqueInvalidates.map((t) => generateInvalidateCall(t)).join('\n')}
    mutationOptions?.onSuccess?.(data, variables, onMutateResult, context);
  };`;
  },

  generateMutationHookBody({
    operationPrefix,
    mutationOptionsFnName,
    mutationOptionsVarName,
    isRequestOptions,
    isAngularHttp,
    mutator,
    hasInvalidation,
  }: MutationHookBodyContext): string {
    if (isAngularHttp && (!mutator || mutator.hasSecondArg)) {
      return `      const http = inject(HttpClient);${hasInvalidation ? '\n      const queryClient = inject(QueryClient);' : ''}
      const ${mutationOptionsVarName} = ${mutationOptionsFnName}(http${hasInvalidation ? ', queryClient' : ''}${isRequestOptions ? ', options' : ', mutationOptions'});

      return ${operationPrefix}Mutation(() => ${mutationOptionsVarName});`;
    }

    const mutationImpl = `${mutationOptionsFnName}(${hasInvalidation ? `queryClient, ` : ''}${
      isRequestOptions ? 'options' : 'mutationOptions'
    })`;
    return `      const ${mutationOptionsVarName} = ${mutationImpl};

      return ${operationPrefix}Mutation(() => ${mutationOptionsVarName});`;
  },

  getQueryType(type: string): string {
    return getQueryTypeForFramework(type);
  },

  generateRequestFunction(
    verbOptions: GeneratorVerbOptions,
    options: GeneratorOptions,
  ): string {
    return generateAngularHttpRequestFunction(verbOptions, options);
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
