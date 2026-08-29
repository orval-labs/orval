import {
  type GeneratorMutator,
  type GetterParams,
  type GetterQueryParam,
  isObject,
  pascal,
  stringify,
} from '@orval/core';
import { omitBy } from 'remeda';

import type { FrameworkAdapter } from './framework-adapter';

type QueryType = 'infiniteQuery' | 'query';

export const QueryType = {
  INFINITE: 'infiniteQuery' as QueryType,
  QUERY: 'query' as QueryType,
  SUSPENSE_QUERY: 'suspenseQuery' as QueryType,
  SUSPENSE_INFINITE: 'suspenseInfiniteQuery' as QueryType,
};

const INFINITE_QUERY_PROPERTIES = new Set([
  'getNextPageParam',
  'getPreviousPageParam',
]);

/**
 * Whether a key from `override.query.options` reaches the emitted options
 * literal for this query type. Page-param callbacks are meaningless on a plain
 * query, so they are dropped there.
 */
const isConfiguredOptionEmitted = (key: string, type: QueryType) =>
  isInfiniteQuery(type) || !INFINITE_QUERY_PROPERTIES.has(key);

export const generateQueryOptions = ({
  params,
  options,
  type,
  adapter,
}: {
  params: GetterParams;
  options?: object | boolean;
  type: QueryType;
  adapter?: FrameworkAdapter;
}) => {
  if (options === false) {
    return '';
  }

  const queryConfig = isObject(options)
    ? ` ${stringify(
        omitBy(options, (_, key) => !isConfiguredOptionEmitted(key, type)),
      )?.slice(1, -1)}`
    : '';

  if (params.length === 0 || isSuspenseQuery(type)) {
    if (options) {
      return `${queryConfig} ...queryOptions`;
    }

    return '...queryOptions';
  }

  const enabledOption = adapter
    ? adapter.generateEnabledOption(params, options)
    : !isObject(options) || !Object.hasOwn(options, 'enabled')
      ? `enabled: ${params.map(({ name }) => `${name} != null`).join(' && ')},`
      : '';

  return `${enabledOption}${queryConfig} ...queryOptions`;
};

export const isSuspenseQuery = (type: QueryType) => {
  return [QueryType.SUSPENSE_INFINITE, QueryType.SUSPENSE_QUERY].includes(type);
};

export const isInfiniteQuery = (type: QueryType) => {
  return [QueryType.INFINITE, QueryType.SUSPENSE_INFINITE].includes(type);
};

const getOptionsKind = (type: QueryType): 'query' | 'infiniteQuery' =>
  isInfiniteQuery(type) ? 'infiniteQuery' : 'query';

/**
 * Resolves the adapter's constraint together with the plain options type it has
 * to be rendered against. Both are optional on `FrameworkAdapter` and neither is
 * useful alone: without a type name there is nothing to `Pick` from, and without
 * required keys the caller has nothing to supply. Returning them as one value is
 * what stops the signature and the type disagreeing about whether `options` is
 * mandatory.
 */
const resolveUserQueryOptionsConstraint = (
  adapter: FrameworkAdapter | undefined,
  type: QueryType,
  options?: object | boolean,
) => {
  const constraint = adapter?.getUserQueryOptionsConstraint?.(type);

  if (!constraint) {
    return undefined;
  }

  const optionsTypeName = adapter?.getOptionsReturnTypeName?.(
    getOptionsKind(type),
  );

  if (!optionsTypeName) {
    return undefined;
  }

  // A key that `override.query.options` already writes into the emitted literal
  // is satisfied, so the caller must not be asked for it a second time — and it
  // would be asked pointlessly, since `...queryOptions` spreads last and the
  // caller's value would shadow the configured one.
  const require = isObject(options)
    ? constraint.require?.filter(
        (key) =>
          !(
            isConfiguredOptionEmitted(key, type) && Object.hasOwn(options, key)
          ),
      )
    : constraint.require;

  return { ...constraint, require, optionsTypeName };
};

/**
 * Whether the caller must supply options the generator cannot infer, which is
 * what makes the whole `options` parameter mandatory. An `exclude`-only
 * constraint reshapes the type without requiring anything, so it does not count.
 */
export const requiresUserSuppliedQueryOptions = (
  adapter: FrameworkAdapter | undefined,
  type?: QueryType,
  options?: object | boolean,
) =>
  !!type &&
  !!resolveUserQueryOptionsConstraint(adapter, type, options)?.require?.length;

export const getQueryOptionsDefinition = ({
  operationName,
  mutator,
  definitions,
  mutationVariablesType,
  type,
  prefix,
  hasQueryV5,
  hasQueryV5WithInfiniteQueryOptionsError,
  queryParams,
  queryParam,
  isReturnType,
  initialData,
  adapter,
  options,
}: {
  operationName: string;
  mutator?: GeneratorMutator;
  definitions: string;
  /**
   * Named alias for the mutation variables, when the caller emitted one.
   * Falls back to the inline object literal built from `definitions`.
   */
  mutationVariablesType?: string;
  type?: QueryType;
  /** 'Use' or 'Create' — from adapter.getQueryOptionsDefinitionPrefix() */
  prefix: string;
  hasQueryV5: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  queryParams?: GetterQueryParam;
  queryParam?: string;
  isReturnType: boolean;
  initialData?: 'defined' | 'undefined';
  adapter?: FrameworkAdapter;
  /** `override.query.options` — the keys already written into the literal. */
  options?: object | boolean;
}) => {
  const isMutatorHook = mutator?.isHook;
  const partialOptions = !isReturnType && hasQueryV5;

  if (type) {
    const funcReturnType = `Awaited<ReturnType<${
      isMutatorHook
        ? `ReturnType<typeof use${pascal(operationName)}Hook>`
        : `typeof ${operationName}`
    }>>`;

    const isInfiniteType = isInfiniteQuery(type);

    const infiniteTypeArgs =
      hasQueryV5 && isInfiniteType && queryParam && queryParams
        ? `, QueryKey, ${queryParams.schema.name}['${queryParam}']`
        : '';

    const initialDataOptionsType =
      initialData && adapter?.getInitialDataOptionsType
        ? adapter.getInitialDataOptionsType({
            initialData,
            isInfinite: isInfiniteType,
            funcReturnType,
            infiniteTypeArgs,
          })
        : `${pascal(initialData ?? '')}InitialDataOptions<
          ${funcReturnType},
          TError,
          ${funcReturnType}${
            hasQueryV5 && isInfiniteType && queryParam && queryParams
              ? `, QueryKey`
              : ''
          }
        >`;

    const optionTypeInitialDataPostfix =
      initialData && !isSuspenseQuery(type)
        ? ` & Pick<
        ${initialDataOptionsType} , 'initialData'
      >`
        : '';

    // An adapter can demand that the caller supply options orval cannot infer.
    // The plain (non-Accessor) interface is required here: the keys are read off
    // the type, and Solid's `Use*Options` aliases are `Accessor<…>` function
    // types whose `Partial<…>` erases every property.
    const userOptionsConstraint = isReturnType
      ? undefined
      : resolveUserQueryOptionsConstraint(adapter, type, options);

    if (userOptionsConstraint) {
      const {
        optionsTypeName,
        require = [],
        exclude = [],
      } = userOptionsConstraint;
      const plainOptionsType = `${optionsTypeName}<${funcReturnType}, TError, TData${infiniteTypeArgs}>`;
      const quoteKeys = (keys: readonly string[]) =>
        keys.map((key) => `'${key}'`).join(' | ');

      // Required keys are omitted from the `Partial` and re-added by `Pick` so
      // they land non-optional. An empty `Pick<…, >` would not parse, so each
      // half is emitted only when it has keys.
      const omitted = [...require, ...exclude];
      const accepted = omitted.length
        ? `Omit<Partial<${plainOptionsType}>, ${quoteKeys(omitted)}>`
        : `Partial<${plainOptionsType}>`;
      const required = require.length
        ? ` & Pick<${plainOptionsType}, ${quoteKeys(require)}>`
        : '';

      return `${accepted}${required}${optionTypeInitialDataPostfix}`;
    }

    // Adapters without a constraint keep the prefix-based fallback for the
    // user-facing parameter, which is already the plain options shape in their
    // target library. See [issue #3365] for the mutation-side fix.
    const optionsTypeName = isReturnType
      ? adapter?.getOptionsReturnTypeName?.(getOptionsKind(type))
      : undefined;

    const optionType = optionsTypeName
      ? `${optionsTypeName}<${funcReturnType}, TError, TData${infiniteTypeArgs}>`
      : `${prefix}${pascal(type)}Options<${funcReturnType}, TError, TData${
          hasQueryV5 && isInfiniteType && queryParam && queryParams
            ? hasQueryV5WithInfiniteQueryOptionsError
              ? `, QueryKey, ${queryParams.schema.name}['${queryParam}']`
              : `, ${funcReturnType}, QueryKey, ${queryParams.schema.name}['${queryParam}']`
            : ''
        }>`;

    return `${partialOptions ? 'Partial<' : ''}${optionType}${
      partialOptions ? '>' : ''
    }${optionTypeInitialDataPostfix}`;
  }

  // Mutation options — use the adapter's plain-options type name for both
  // helper return type and user-facing `options.mutation` param (see comment
  // above for the Solid Query rationale).
  const mutationOptionsTypeName = adapter?.getOptionsReturnTypeName
    ? adapter.getOptionsReturnTypeName('mutation')
    : undefined;

  const variablesType =
    mutationVariablesType ?? (definitions ? `{${definitions}}` : 'void');

  return mutationOptionsTypeName
    ? `${mutationOptionsTypeName}<Awaited<ReturnType<${
        isMutatorHook
          ? `ReturnType<typeof use${pascal(operationName)}Hook>`
          : `typeof ${operationName}`
      }>>, TError,${variablesType}, TContext>`
    : `${prefix}MutationOptions<Awaited<ReturnType<${
        isMutatorHook
          ? `ReturnType<typeof use${pascal(operationName)}Hook>`
          : `typeof ${operationName}`
      }>>, TError,${variablesType}, TContext>`;
};
