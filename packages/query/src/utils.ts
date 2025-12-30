import {
  getIsBodyVerb,
  type GetterProps,
  GetterPropType,
  isObject,
  isString,
  type Mutator,
  type NormalizedMutator,
  type NormalizedQueryOptions,
  OutputClient,
  type OutputClientFunc,
  type QueryOptions,
  TEMPLATE_TAG_REGEX,
  upath,
  Verbs,
} from '@orval/core';
import chalk from 'chalk';

export const normalizeQueryOptions = (
  queryOptions: QueryOptions = {},
  outputWorkspace: string,
): NormalizedQueryOptions => {
  return {
    ...(queryOptions.usePrefetch ? { usePrefetch: true } : {}),
    ...(queryOptions.useInvalidate ? { useInvalidate: true } : {}),
    ...(queryOptions.useQuery ? { useQuery: true } : {}),
    ...(queryOptions.useInfinite ? { useInfinite: true } : {}),
    ...(queryOptions.useInfiniteQueryParam
      ? { useInfiniteQueryParam: queryOptions.useInfiniteQueryParam }
      : {}),
    ...(queryOptions.options ? { options: queryOptions.options } : {}),
    ...(queryOptions.queryKey
      ? {
          queryKey: normalizeMutator(outputWorkspace, queryOptions.queryKey),
        }
      : {}),
    ...(queryOptions.queryOptions
      ? {
          queryOptions: normalizeMutator(
            outputWorkspace,
            queryOptions.queryOptions,
          ),
        }
      : {}),
    ...(queryOptions.mutationOptions
      ? {
          mutationOptions: normalizeMutator(
            outputWorkspace,
            queryOptions.mutationOptions,
          ),
        }
      : {}),
    ...(queryOptions.signal ? { signal: true } : {}),
    ...(queryOptions.shouldExportMutatorHooks
      ? { shouldExportMutatorHooks: true }
      : {}),
    ...(queryOptions.shouldExportQueryKey
      ? { shouldExportQueryKey: true }
      : {}),
    ...(queryOptions.shouldExportHttpClient
      ? { shouldExportHttpClient: true }
      : {}),
    ...(queryOptions.shouldSplitQueryKey ? { shouldSplitQueryKey: true } : {}),
    ...(queryOptions.useOperationIdAsQueryKey
      ? { useOperationIdAsQueryKey: true }
      : {}),
  };
};

// Temporary duplicate code before next major release
const normalizeMutator = (
  workspace: string,
  mutator?: Mutator,
): NormalizedMutator | undefined => {
  if (isObject(mutator)) {
    if (!mutator.path) {
      throw new Error(chalk.red(`Mutator need a path`));
    }

    return {
      ...mutator,
      path: upath.resolve(workspace, mutator.path),
      default: mutator.default ?? !mutator.name,
    };
  }

  if (isString(mutator)) {
    return {
      path: upath.resolve(workspace, mutator),
      default: true,
    };
  }

  return mutator;
};

export function vueWrapTypeWithMaybeRef(props: GetterProps): GetterProps {
  return props.map((prop) => {
    const [paramName, paramType] = prop.implementation.split(':');
    if (!paramType) return prop;
    const name =
      prop.type === GetterPropType.NAMED_PATH_PARAMS ? prop.name : paramName;

    const [type, defaultValue] = paramType.split('=');
    return {
      ...prop,
      implementation: `${name}: MaybeRef<${type.trim()}>${
        defaultValue ? ` = ${defaultValue}` : ''
      }`,
    };
  });
}

export const vueUnRefParams = (props: GetterProps): string => {
  return props
    .map((prop) => {
      if (prop.type === GetterPropType.NAMED_PATH_PARAMS) {
        return `const ${prop.destructured} = unref(${prop.name});`;
      }
      return `${prop.name} = unref(${prop.name});`;
    })
    .join('\n');
};

export const wrapRouteParameters = (
  route: string,
  prepend: string,
  append: string,
): string => route.replaceAll(TEMPLATE_TAG_REGEX, `\${${prepend}$1${append}}`);

export const makeRouteSafe = (route: string): string =>
  wrapRouteParameters(route, 'encodeURIComponent(String(', '))');

export const isVue = (client: OutputClient | OutputClientFunc) =>
  OutputClient.VUE_QUERY === client;

export const isAngular = (client: OutputClient | OutputClientFunc) =>
  OutputClient.ANGULAR_QUERY === client;

export const getQueryTypeForFramework = (type: string): string => {
  // Angular Query and Svelte Query don't have suspense variants, map them to regular queries
  switch (type) {
    case 'suspenseQuery': {
      return 'query';
    }
    case 'suspenseInfiniteQuery': {
      return 'infiniteQuery';
    }
    default: {
      return type;
    }
  }
};

export const getHasSignal = ({
  overrideQuerySignal = false,
  verb,
}: {
  verb: Verbs;
  overrideQuerySignal?: boolean;
}) => overrideQuerySignal && (!getIsBodyVerb(verb) || verb === Verbs.POST);
