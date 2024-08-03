import {
  ConfigExternal,
  createLogger,
  GlobalOptions,
  HonoOptions,
  Hook,
  HookFunction,
  HookOption,
  HooksOptions,
  isBoolean,
  isFunction,
  isObject,
  isString,
  isUndefined,
  isUrl,
  mergeDeep,
  Mutator,
  NormalizedHonoOptions,
  NormalizedHookOptions,
  NormalizedMutator,
  NormalizedOperationOptions,
  NormalizedOptions,
  NormalizedQueryOptions,
  OperationOptions,
  OptionsExport,
  OutputClient,
  OutputHttpClient,
  OutputMode,
  QueryOptions,
  RefComponentSuffix,
  SwaggerParserOptions,
  upath,
} from '@orval/core';
import { DEFAULT_MOCK_OPTIONS } from '@orval/mock';
import chalk from 'chalk';
import pkg from '../../package.json';
import { githubResolver } from './github';
import { loadPackageJson } from './package-json';
import { loadTsconfig } from './tsconfig';

/**
 * Type helper to make it easier to use orval.config.ts
 * accepts a direct {@link ConfigExternal} object.
 */
export function defineConfig(options: ConfigExternal): ConfigExternal {
  return options;
}

export const normalizeOptions = async (
  optionsExport: OptionsExport,
  workspace = process.cwd(),
  globalOptions: GlobalOptions = {},
) => {
  const options = await (isFunction(optionsExport)
    ? optionsExport()
    : optionsExport);

  if (!options.input) {
    createLogger().error(chalk.red(`Config require an input`));
    process.exit(1);
  }

  if (!options.output) {
    createLogger().error(chalk.red(`Config require an output`));
    process.exit(1);
  }

  const inputOptions = isString(options.input)
    ? { target: options.input }
    : options.input;

  const outputOptions = isString(options.output)
    ? { target: options.output }
    : options.output;

  const outputWorkspace = normalizePath(
    outputOptions.workspace || '',
    workspace,
  );

  const { clean, prettier, client, httpClient, mode, tslint, biome } =
    globalOptions;

  const tsconfig = await loadTsconfig(
    outputOptions.tsconfig || globalOptions.tsconfig,
    workspace,
  );

  const packageJson = await loadPackageJson(
    outputOptions.packageJson || globalOptions.packageJson,
    workspace,
  );

  let mock = outputOptions.mock ?? globalOptions.mock;
  if (typeof mock === 'boolean' && mock) {
    mock = DEFAULT_MOCK_OPTIONS;
  } else if (isFunction(mock)) {
  } else if (!mock) {
    mock = undefined;
  } else {
    mock = {
      ...DEFAULT_MOCK_OPTIONS,
      ...mock,
    };
  }

  const defaultFileExtension = '.ts';

  const globalQueryOptions: NormalizedQueryOptions = {
    useQuery: true,
    useMutation: true,
    signal: true,
    shouldExportMutatorHooks: true,
    shouldExportHttpClient: true,
    shouldExportQueryKey: true,
    ...normalizeQueryOptions(outputOptions.override?.query, workspace),
  };

  const normalizedOptions: NormalizedOptions = {
    input: {
      target: globalOptions.input
        ? normalizePathOrUrl(globalOptions.input, process.cwd())
        : normalizePathOrUrl(inputOptions.target, workspace),
      validation: inputOptions.validation || false,
      override: {
        transformer: normalizePath(
          inputOptions.override?.transformer,
          workspace,
        ),
      },
      converterOptions: inputOptions.converterOptions ?? {},
      parserOptions: mergeDeep(
        parserDefaultOptions,
        inputOptions.parserOptions ?? {},
      ),
      filters: inputOptions.filters,
    },
    output: {
      target: globalOptions.output
        ? normalizePath(globalOptions.output, process.cwd())
        : normalizePath(outputOptions.target, outputWorkspace),
      schemas: normalizePath(outputOptions.schemas, outputWorkspace),
      fileExtension: outputOptions.fileExtension || defaultFileExtension,
      workspace: outputOptions.workspace ? outputWorkspace : undefined,
      client: outputOptions.client ?? client ?? OutputClient.AXIOS_FUNCTIONS,
      httpClient:
        outputOptions.httpClient ?? httpClient ?? OutputHttpClient.AXIOS,
      mode: normalizeOutputMode(outputOptions.mode ?? mode),
      mock,
      clean: outputOptions.clean ?? clean ?? false,
      prettier: outputOptions.prettier ?? prettier ?? false,
      tslint: outputOptions.tslint ?? tslint ?? false,
      biome: outputOptions.biome ?? biome ?? false,
      tsconfig,
      packageJson,
      headers: outputOptions.headers ?? false,
      indexFiles: outputOptions.indexFiles ?? true,
      baseUrl: outputOptions.baseUrl,
      unionAddMissingProperties:
        outputOptions.unionAddMissingProperties ?? false,
      override: {
        ...outputOptions.override,
        mock: {
          arrayMin: outputOptions.override?.mock?.arrayMin ?? 1,
          arrayMax: outputOptions.override?.mock?.arrayMax ?? 10,
          ...(outputOptions.override?.mock ?? {}),
        },
        operations: normalizeOperationsAndTags(
          outputOptions.override?.operations ?? {},
          outputWorkspace,
          {
            query: globalQueryOptions,
          },
        ),
        tags: normalizeOperationsAndTags(
          outputOptions.override?.tags ?? {},
          outputWorkspace,
          {
            query: globalQueryOptions,
          },
        ),
        mutator: normalizeMutator(
          outputWorkspace,
          outputOptions.override?.mutator,
        ),
        formData:
          (!isBoolean(outputOptions.override?.formData)
            ? normalizeMutator(
                outputWorkspace,
                outputOptions.override?.formData,
              )
            : outputOptions.override?.formData) ?? true,
        formUrlEncoded:
          (!isBoolean(outputOptions.override?.formUrlEncoded)
            ? normalizeMutator(
                outputWorkspace,
                outputOptions.override?.formUrlEncoded,
              )
            : outputOptions.override?.formUrlEncoded) ?? true,
        paramsSerializer: normalizeMutator(
          outputWorkspace,
          outputOptions.override?.paramsSerializer,
        ),
        header:
          outputOptions.override?.header === false
            ? false
            : isFunction(outputOptions.override?.header)
              ? outputOptions.override?.header!
              : getDefaultFilesHeader,
        requestOptions: outputOptions.override?.requestOptions ?? true,
        components: {
          schemas: {
            suffix: RefComponentSuffix.schemas,
            itemSuffix:
              outputOptions.override?.components?.schemas?.itemSuffix ?? 'Item',
            ...(outputOptions.override?.components?.schemas ?? {}),
          },
          responses: {
            suffix: RefComponentSuffix.responses,
            ...(outputOptions.override?.components?.responses ?? {}),
          },
          parameters: {
            suffix: RefComponentSuffix.parameters,
            ...(outputOptions.override?.components?.parameters ?? {}),
          },
          requestBodies: {
            suffix: RefComponentSuffix.requestBodies,
            ...(outputOptions.override?.components?.requestBodies ?? {}),
          },
        },
        hono: normalizeHonoOptions(outputOptions.override?.hono, workspace),
        query: globalQueryOptions,
        zod: {
          strict: {
            param: outputOptions.override?.zod?.strict?.param ?? false,
            query: outputOptions.override?.zod?.strict?.query ?? false,
            header: outputOptions.override?.zod?.strict?.header ?? false,
            body: outputOptions.override?.zod?.strict?.body ?? false,
            response: outputOptions.override?.zod?.strict?.response ?? false,
          },
          generate: {
            param: outputOptions.override?.zod?.generate?.param ?? true,
            query: outputOptions.override?.zod?.generate?.query ?? true,
            header: outputOptions.override?.zod?.generate?.header ?? true,
            body: outputOptions.override?.zod?.generate?.body ?? true,
            response: outputOptions.override?.zod?.generate?.response ?? true,
          },
          coerce: {
            param: outputOptions.override?.zod?.coerce?.param ?? false,
            query: outputOptions.override?.zod?.coerce?.query ?? false,
            header: outputOptions.override?.zod?.coerce?.header ?? false,
            body: outputOptions.override?.zod?.coerce?.body ?? false,
            response: outputOptions.override?.zod?.coerce?.response ?? false,
          },
          preprocess: {
            ...(outputOptions.override?.zod?.preprocess?.param
              ? {
                  param: normalizeMutator(
                    workspace,
                    outputOptions.override.zod.preprocess.param,
                  ),
                }
              : {}),
            ...(outputOptions.override?.zod?.preprocess?.query
              ? {
                  query: normalizeMutator(
                    workspace,
                    outputOptions.override.zod.preprocess.query,
                  ),
                }
              : {}),
            ...(outputOptions.override?.zod?.preprocess?.header
              ? {
                  header: normalizeMutator(
                    workspace,
                    outputOptions.override.zod.preprocess.header,
                  ),
                }
              : {}),
            ...(outputOptions.override?.zod?.preprocess?.body
              ? {
                  body: normalizeMutator(
                    workspace,
                    outputOptions.override.zod.preprocess.body,
                  ),
                }
              : {}),
            ...(outputOptions.override?.zod?.preprocess?.response
              ? {
                  response: normalizeMutator(
                    workspace,
                    outputOptions.override.zod.preprocess.response,
                  ),
                }
              : {}),
          },
          generateEachHttpStatus:
            outputOptions.override?.zod?.generateEachHttpStatus ?? false,
        },
        swr: {
          ...(outputOptions.override?.swr ?? {}),
        },
        angular: {
          provideIn: outputOptions.override?.angular?.provideIn ?? 'root',
        },
        fetch: {
          includeHttpStatusReturnType:
            outputOptions.override?.fetch?.includeHttpStatusReturnType ?? true,
          ...(outputOptions.override?.fetch ?? {}),
        },
        useDates: outputOptions.override?.useDates || false,
        useDeprecatedOperations:
          outputOptions.override?.useDeprecatedOperations ?? true,
        useNativeEnums: outputOptions.override?.useNativeEnums ?? false,
        suppressReadonlyModifier:
          outputOptions.override?.suppressReadonlyModifier || false,
      },
      allParamsOptional: outputOptions.allParamsOptional ?? false,
      urlEncodeParameters: outputOptions.urlEncodeParameters ?? false,
      optionsParamRequired: outputOptions.optionsParamRequired ?? false,
    },
    hooks: options.hooks ? normalizeHooks(options.hooks) : {},
  };

  if (!normalizedOptions.input.target) {
    createLogger().error(chalk.red(`Config require an input target`));
    process.exit(1);
  }

  if (!normalizedOptions.output.target && !normalizedOptions.output.schemas) {
    createLogger().error(
      chalk.red(`Config require an output target or schemas`),
    );
    process.exit(1);
  }

  return normalizedOptions;
};

const parserDefaultOptions = {
  validate: true,
  resolve: { github: githubResolver },
} as SwaggerParserOptions;

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

const normalizePathOrUrl = <T>(path: T, workspace: string) => {
  if (isString(path) && !isUrl(path)) {
    return normalizePath(path, workspace);
  }

  return path;
};

export const normalizePath = <T>(path: T, workspace: string) => {
  if (!isString(path)) {
    return path;
  }
  return upath.resolve(workspace, path);
};

const normalizeOperationsAndTags = (
  operationsOrTags: {
    [key: string]: OperationOptions;
  },
  workspace: string,
  global: {
    query: NormalizedQueryOptions;
  },
): {
  [key: string]: NormalizedOperationOptions;
} => {
  return Object.fromEntries(
    Object.entries(operationsOrTags).map(
      ([
        key,
        {
          transformer,
          mutator,
          formData,
          formUrlEncoded,
          paramsSerializer,
          query,
          zod,
          ...rest
        },
      ]) => {
        return [
          key,
          {
            ...rest,
            ...(query
              ? {
                  query: normalizeQueryOptions(query, workspace, global.query),
                }
              : {}),
            ...(zod
              ? {
                  zod: {
                    strict: {
                      param: zod.strict?.param ?? false,
                      query: zod.strict?.query ?? false,
                      header: zod.strict?.header ?? false,
                      body: zod.strict?.body ?? false,
                      response: zod.strict?.response ?? false,
                    },
                    generate: {
                      param: zod.generate?.param ?? true,
                      query: zod.generate?.query ?? true,
                      header: zod.generate?.header ?? true,
                      body: zod.generate?.body ?? true,
                      response: zod.generate?.response ?? true,
                    },
                    coerce: {
                      param: zod.coerce?.param ?? false,
                      query: zod.coerce?.query ?? false,
                      header: zod.coerce?.header ?? false,
                      body: zod.coerce?.body ?? false,
                      response: zod.coerce?.response ?? false,
                    },
                    preprocess: {
                      ...(zod.preprocess?.param
                        ? {
                            param: normalizeMutator(
                              workspace,
                              zod.preprocess.param,
                            ),
                          }
                        : {}),
                      ...(zod.preprocess?.query
                        ? {
                            query: normalizeMutator(
                              workspace,
                              zod.preprocess.query,
                            ),
                          }
                        : {}),
                      ...(zod.preprocess?.header
                        ? {
                            header: normalizeMutator(
                              workspace,
                              zod.preprocess.header,
                            ),
                          }
                        : {}),
                      ...(zod.preprocess?.body
                        ? {
                            body: normalizeMutator(
                              workspace,
                              zod.preprocess.body,
                            ),
                          }
                        : {}),
                      ...(zod.preprocess?.response
                        ? {
                            response: normalizeMutator(
                              workspace,
                              zod.preprocess.response,
                            ),
                          }
                        : {}),
                    },
                    generateEachHttpStatus:
                      zod?.generateEachHttpStatus ?? false,
                  },
                }
              : {}),
            ...(transformer
              ? { transformer: normalizePath(transformer, workspace) }
              : {}),
            ...(mutator
              ? { mutator: normalizeMutator(workspace, mutator) }
              : {}),
            ...(formData
              ? {
                  formData: !isBoolean(formData)
                    ? normalizeMutator(workspace, formData)
                    : formData,
                }
              : {}),
            ...(formUrlEncoded
              ? {
                  formUrlEncoded: !isBoolean(formUrlEncoded)
                    ? normalizeMutator(workspace, formUrlEncoded)
                    : formUrlEncoded,
                }
              : {}),
            ...(paramsSerializer
              ? {
                  paramsSerializer: normalizeMutator(
                    workspace,
                    paramsSerializer,
                  ),
                }
              : {}),
          },
        ];
      },
    ),
  );
};

const normalizeOutputMode = (mode?: OutputMode): OutputMode => {
  if (!mode) {
    return OutputMode.SINGLE;
  }

  if (!Object.values(OutputMode).includes(mode)) {
    createLogger().warn(chalk.yellow(`Unknown the provided mode => ${mode}`));
    return OutputMode.SINGLE;
  }

  return mode;
};

const normalizeHooks = (hooks: HooksOptions): NormalizedHookOptions => {
  const keys = Object.keys(hooks) as unknown as Hook[];

  return keys.reduce((acc, key: Hook) => {
    if (isString(hooks[key])) {
      return {
        ...acc,
        [key]: [hooks[key]] as string[],
      };
    } else if (Array.isArray(hooks[key])) {
      return {
        ...acc,
        [key]: hooks[key] as string[],
      };
    } else if (isFunction(hooks[key])) {
      return {
        ...acc,
        [key]: [hooks[key]] as HookFunction[],
      };
    } else if (isObject(hooks[key])) {
      return {
        ...acc,
        [key]: [hooks[key]] as HookOption[],
      };
    }

    return acc;
  }, {} as NormalizedHookOptions);
};

const normalizeHonoOptions = (
  hono: HonoOptions = {},
  workspace: string,
): NormalizedHonoOptions => {
  return {
    ...(hono.handlers
      ? { handlers: upath.resolve(workspace, hono.handlers) }
      : {}),
    validator: hono.validator ?? true,
  };
};

const normalizeQueryOptions = (
  queryOptions: QueryOptions = {},
  outputWorkspace: string,
  globalOptions: NormalizedQueryOptions = {},
): NormalizedQueryOptions => {
  if (queryOptions.options) {
    console.warn(
      '[WARN] Using query options is deprecated and will be removed in a future major release. Please use queryOptions or mutationOptions instead.',
    );
  }

  return {
    ...(!isUndefined(queryOptions.usePrefetch)
      ? { usePrefetch: queryOptions.usePrefetch }
      : {}),
    ...(!isUndefined(queryOptions.useQuery)
      ? { useQuery: queryOptions.useQuery }
      : {}),
    ...(!isUndefined(queryOptions.useSuspenseQuery)
      ? { useSuspenseQuery: queryOptions.useSuspenseQuery }
      : {}),
    ...(!isUndefined(queryOptions.useMutation)
      ? { useMutation: queryOptions.useMutation }
      : {}),
    ...(!isUndefined(queryOptions.useInfinite)
      ? { useInfinite: queryOptions.useInfinite }
      : {}),
    ...(!isUndefined(queryOptions.useSuspenseInfiniteQuery)
      ? { useSuspenseInfiniteQuery: queryOptions.useSuspenseInfiniteQuery }
      : {}),
    ...(queryOptions.useInfiniteQueryParam
      ? { useInfiniteQueryParam: queryOptions.useInfiniteQueryParam }
      : {}),
    ...(queryOptions.options ? { options: queryOptions.options } : {}),
    ...(globalOptions.queryKey
      ? {
          queryKey: globalOptions.queryKey,
        }
      : {}),
    ...(queryOptions?.queryKey
      ? {
          queryKey: normalizeMutator(outputWorkspace, queryOptions?.queryKey),
        }
      : {}),
    ...(globalOptions.queryOptions
      ? {
          queryOptions: globalOptions.queryOptions,
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
    ...(globalOptions.mutationOptions
      ? {
          mutationOptions: globalOptions.mutationOptions,
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
    ...(!isUndefined(globalOptions.shouldExportQueryKey)
      ? {
          shouldExportQueryKey: globalOptions.shouldExportQueryKey,
        }
      : {}),
    ...(!isUndefined(queryOptions.shouldExportQueryKey)
      ? { shouldExportQueryKey: queryOptions.shouldExportQueryKey }
      : {}),
    ...(!isUndefined(globalOptions.shouldExportHttpClient)
      ? {
          shouldExportHttpClient: globalOptions.shouldExportHttpClient,
        }
      : {}),
    ...(!isUndefined(queryOptions.shouldExportHttpClient)
      ? { shouldExportHttpClient: queryOptions.shouldExportHttpClient }
      : {}),
    ...(!isUndefined(globalOptions.shouldExportMutatorHooks)
      ? {
          shouldExportMutatorHooks: globalOptions.shouldExportMutatorHooks,
        }
      : {}),
    ...(!isUndefined(queryOptions.shouldExportMutatorHooks)
      ? { shouldExportMutatorHooks: queryOptions.shouldExportMutatorHooks }
      : {}),
    ...(!isUndefined(globalOptions.signal)
      ? {
          signal: globalOptions.signal,
        }
      : {}),
    ...(!isUndefined(queryOptions.signal)
      ? { signal: queryOptions.signal }
      : {}),
    ...(!isUndefined(globalOptions.version)
      ? {
          version: globalOptions.version,
        }
      : {}),
    ...(!isUndefined(queryOptions.version)
      ? { version: queryOptions.version }
      : {}),
  };
};

export const getDefaultFilesHeader = ({
  title,
  description,
  version,
}: {
  title?: string;
  description?: string;
  version?: string;
} = {}) => [
  `Generated by ${pkg.name} v${pkg.version} 🍺`,
  `Do not edit manually.`,
  ...(title ? [title] : []),
  ...(description ? [description] : []),
  ...(version ? [`OpenAPI spec version: ${version}`] : []),
];
