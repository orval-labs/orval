import {
  createLogger,
  isObject,
  isString,
  Mutator,
  NormalizedMutator,
  NormalizedQueryOptions,
  QueryOptions,
  upath,
} from '@orval/core';
import chalk from 'chalk';

export const normalizeQueryOptions = (
  queryOptions: QueryOptions = {},
  outputWorkspace: string,
): NormalizedQueryOptions => {
  return {
    ...(queryOptions.useQuery ? { useQuery: true } : {}),
    ...(queryOptions.useInfinite ? { useInfinite: true } : {}),
    ...(queryOptions.useInfiniteQueryParam
      ? { useInfiniteQueryParam: queryOptions.useInfiniteQueryParam }
      : {}),
    ...(queryOptions.options ? { options: queryOptions.options } : {}),
    ...(queryOptions?.queryKey
      ? {
          queryKey: normalizeMutator(outputWorkspace, queryOptions?.queryKey),
        }
      : {}),
    ...(queryOptions?.queryOptions
      ? {
          queryOptions: normalizeMutator(
            outputWorkspace,
            queryOptions?.queryOptions,
          ),
        }
      : {}),
    ...(queryOptions?.mutationOptions
      ? {
          mutationOptions: normalizeMutator(
            outputWorkspace,
            queryOptions?.mutationOptions,
          ),
        }
      : {}),
    ...(queryOptions.signal ? { signal: true } : {}),
  };
};

// Temporary duplicate code before next major release
const normalizeMutator = <T>(
  workspace: string,
  mutator?: Mutator,
): NormalizedMutator | undefined => {
  if (isObject(mutator)) {
    if (!mutator.path) {
      createLogger().error(chalk.red(`Mutator need a path`));
      process.exit(1);
    }

    return {
      ...mutator,
      path: upath.resolve(workspace, mutator.path),
      default: (mutator.default || !mutator.name) ?? false,
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
