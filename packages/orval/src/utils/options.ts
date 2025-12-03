import {
  type ClientMockBuilder,
  type ConfigExternal,
  createLogger,
  FormDataArrayHandling,
  type GlobalMockOptions,
  type GlobalOptions,
  type HonoOptions,
  type Hook,
  type HookFunction,
  type HookOption,
  type HooksOptions,
  isBoolean,
  isFunction,
  isObject,
  isString,
  isUndefined,
  isUrl,
  type JsDocOptions,
  mergeDeep,
  type Mutator,
  NamingConvention,
  type NormalizedHonoOptions,
  type NormalizedHookOptions,
  type NormalizedJsDocOptions,
  type NormalizedMutator,
  type NormalizedOperationOptions,
  type NormalizedOptions,
  type NormalizedOverrideOutput,
  type NormalizedQueryOptions,
  type OperationOptions,
  type OptionsExport,
  OutputClient,
  OutputHttpClient,
  OutputMode,
  type OverrideOutput,
  PropertySortOrder,
  type QueryOptions,
  RefComponentSuffix,
  type SwaggerParserOptions,
  upath,
} from '@orval/core';
import { DEFAULT_MOCK_OPTIONS } from '@orval/mock';
import chalk from 'chalk';

import pkg from '../../package.json';
import { githubResolver } from './github';
import { httpResolver } from './http-resolver';
import { loadPackageJson } from './package-json';
import { loadTsconfig } from './tsconfig';

/**
 * Type helper to make it easier to use orval.config.ts
 * accepts a direct {@link ConfigExternal} object.
 */
export function defineConfig(options: ConfigExternal): ConfigExternal {
  return options;
}

const createFormData = (
  workspace: string,
  formData: OverrideOutput['formData'],
): NormalizedOverrideOutput['formData'] => {
  const defaultArrayHandling = FormDataArrayHandling.SERIALIZE;
  if (formData === undefined)
    return { disabled: false, arrayHandling: defaultArrayHandling };
  if (isBoolean(formData))
    return { disabled: !formData, arrayHandling: defaultArrayHandling };
  if (isString(formData))
    return {
      disabled: false,
      mutator: normalizeMutator(workspace, formData),
      arrayHandling: defaultArrayHandling,
    };
  if ('mutator' in formData || 'arrayHandling' in formData)
    return {
      disabled: false,
      mutator: normalizeMutator(workspace, formData.mutator),
      arrayHandling: formData.arrayHandling ?? defaultArrayHandling,
    };
  return {
    disabled: false,
    mutator: normalizeMutator(workspace, formData),
    arrayHandling: defaultArrayHandling,
  };
};

export const normalizeOptions = async (
  optionsExport: OptionsExport,
  workspace = process.cwd(),
  globalOptions: GlobalOptions = {},
) => {
  const options = await (isFunction(optionsExport)
    ? optionsExport()
    : optionsExport);

  if (!options.input) {
    throw new Error(chalk.red(`Config require an input`));
  }

  if (!options.output) {
    throw new Error(chalk.red(`Config require an output`));
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

  const { clean, prettier, client, httpClient, mode, biome } = globalOptions;

  const tsconfig = await loadTsconfig(
    outputOptions.tsconfig || globalOptions.tsconfig,
    workspace,
  );

  const packageJson = await loadPackageJson(
    outputOptions.packageJson || globalOptions.packageJson,
    workspace,
  );

  const mockOption = outputOptions.mock ?? globalOptions.mock;
  let mock: GlobalMockOptions | ClientMockBuilder | undefined;
  if (typeof mockOption === 'boolean' && mockOption) {
    mock = DEFAULT_MOCK_OPTIONS;
  } else if (isFunction(mockOption)) {
    mock = mockOption;
  } else if (mockOption) {
    mock = {
      ...DEFAULT_MOCK_OPTIONS,
      ...mockOption,
    };
  } else {
    mock = undefined;
  }

  const defaultFileExtension = '.ts';

  const globalQueryOptions: NormalizedQueryOptions = {
    useQuery: true,
    useMutation: true,
    signal: true,
    shouldExportMutatorHooks: true,
    shouldExportHttpClient: true,
    shouldExportQueryKey: true,
    shouldSplitQueryKey: false,
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
      namingConvention:
        outputOptions.namingConvention || NamingConvention.CAMEL_CASE,
      fileExtension: outputOptions.fileExtension || defaultFileExtension,
      workspace: outputOptions.workspace ? outputWorkspace : undefined,
      client: outputOptions.client ?? client ?? OutputClient.AXIOS_FUNCTIONS,
      httpClient:
        outputOptions.httpClient ?? httpClient ?? OutputHttpClient.FETCH,
      mode: normalizeOutputMode(outputOptions.mode ?? mode),
      mock,
      clean: outputOptions.clean ?? clean ?? false,
      docs: outputOptions.docs ?? false,
      prettier: outputOptions.prettier ?? prettier ?? false,
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
          stringMin: outputOptions.override?.mock?.stringMin ?? 10,
          stringMax: outputOptions.override?.mock?.stringMax ?? 20,
          fractionDigits: outputOptions.override?.mock?.fractionDigits ?? 2,
          ...outputOptions.override?.mock,
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
        formData: createFormData(
          outputWorkspace,
          outputOptions.override?.formData,
        ),
        formUrlEncoded:
          (isBoolean(outputOptions.override?.formUrlEncoded)
            ? outputOptions.override?.formUrlEncoded
            : normalizeMutator(
                outputWorkspace,
                outputOptions.override?.formUrlEncoded,
              )) ?? true,
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
        namingConvention: outputOptions.override?.namingConvention ?? {},
        components: {
          schemas: {
            suffix: RefComponentSuffix.schemas,
            itemSuffix:
              outputOptions.override?.components?.schemas?.itemSuffix ?? 'Item',
            ...outputOptions.override?.components?.schemas,
          },
          responses: {
            suffix: RefComponentSuffix.responses,
            ...outputOptions.override?.components?.responses,
          },
          parameters: {
            suffix: RefComponentSuffix.parameters,
            ...outputOptions.override?.components?.parameters,
          },
          requestBodies: {
            suffix: RefComponentSuffix.requestBodies,
            ...outputOptions.override?.components?.requestBodies,
          },
        },
        hono: normalizeHonoOptions(outputOptions.override?.hono, workspace),
        jsDoc: normalizeJSDocOptions(outputOptions.override?.jsDoc),
        query: globalQueryOptions,
        mcp: {
          transport: outputOptions.override?.mcp?.transport ?? 'stdio',
        },
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
          dateTimeOptions: outputOptions.override?.zod?.dateTimeOptions ?? {},
          timeOptions: outputOptions.override?.zod?.timeOptions ?? {},
        },
        swr: {
          ...outputOptions.override?.swr,
        },
        angular: {
          provideIn: outputOptions.override?.angular?.provideIn ?? 'root',
        },
        fetch: {
          includeHttpResponseReturnType:
            outputOptions.override?.fetch?.includeHttpResponseReturnType ??
            true,
          forceSuccessResponse:
            outputOptions.override?.fetch?.forceSuccessResponse ?? false,
          ...outputOptions.override?.fetch,
        },
        useDates: outputOptions.override?.useDates || false,
        useDeprecatedOperations:
          outputOptions.override?.useDeprecatedOperations ?? true,
        enumGenerationType:
          outputOptions.override?.enumGenerationType ?? 'const',
        suppressReadonlyModifier:
          outputOptions.override?.suppressReadonlyModifier || false,
      },
      allParamsOptional: outputOptions.allParamsOptional ?? false,
      urlEncodeParameters: outputOptions.urlEncodeParameters ?? false,
      optionsParamRequired: outputOptions.optionsParamRequired ?? false,
      propertySortOrder:
        outputOptions.propertySortOrder ?? PropertySortOrder.SPECIFICATION,
    },
    hooks: options.hooks ? normalizeHooks(options.hooks) : {},
  };

  if (!normalizedOptions.input.target) {
    throw new Error(chalk.red(`Config require an input target`));
  }

  if (!normalizedOptions.output.target && !normalizedOptions.output.schemas) {
    throw new Error(chalk.red(`Config require an output target or schemas`));
  }

  return normalizedOptions;
};

const parserDefaultOptions = {
  validate: true,
  resolve: { github: githubResolver, http: httpResolver },
} as SwaggerParserOptions;

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
  operationsOrTags: Record<string, OperationOptions>,
  workspace: string,
  global: {
    query: NormalizedQueryOptions;
  },
): Record<string, NormalizedOperationOptions> => {
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
                    dateTimeOptions: zod?.dateTimeOptions ?? {},
                    timeOptions: zod?.timeOptions ?? {},
                  },
                }
              : {}),
            ...(transformer
              ? { transformer: normalizePath(transformer, workspace) }
              : {}),
            ...(mutator
              ? { mutator: normalizeMutator(workspace, mutator) }
              : {}),
            ...createFormData(workspace, formData),
            ...(formUrlEncoded
              ? {
                  formUrlEncoded: isBoolean(formUrlEncoded)
                    ? formUrlEncoded
                    : normalizeMutator(workspace, formUrlEncoded),
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

  return keys.reduce<NormalizedHookOptions>((acc, key: Hook) => {
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
  }, {});
};

const normalizeHonoOptions = (
  hono: HonoOptions = {},
  workspace: string,
): NormalizedHonoOptions => {
  return {
    ...(hono.handlers
      ? { handlers: upath.resolve(workspace, hono.handlers) }
      : {}),
    compositeRoute: hono.compositeRoute ?? '',
    validator: hono.validator ?? true,
    validatorOutputPath: hono.validatorOutputPath
      ? upath.resolve(workspace, hono.validatorOutputPath)
      : '',
  };
};

const normalizeJSDocOptions = (
  jsdoc: JsDocOptions = {},
): NormalizedJsDocOptions => {
  return {
    ...jsdoc,
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
    ...(isUndefined(queryOptions.usePrefetch)
      ? {}
      : { usePrefetch: queryOptions.usePrefetch }),
    ...(isUndefined(queryOptions.useInvalidate)
      ? {}
      : { useInvalidate: queryOptions.useInvalidate }),
    ...(isUndefined(queryOptions.useQuery)
      ? {}
      : { useQuery: queryOptions.useQuery }),
    ...(isUndefined(queryOptions.useSuspenseQuery)
      ? {}
      : { useSuspenseQuery: queryOptions.useSuspenseQuery }),
    ...(isUndefined(queryOptions.useMutation)
      ? {}
      : { useMutation: queryOptions.useMutation }),
    ...(isUndefined(queryOptions.useInfinite)
      ? {}
      : { useInfinite: queryOptions.useInfinite }),
    ...(isUndefined(queryOptions.useSuspenseInfiniteQuery)
      ? {}
      : { useSuspenseInfiniteQuery: queryOptions.useSuspenseInfiniteQuery }),
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
    ...(isUndefined(globalOptions.shouldExportQueryKey)
      ? {}
      : {
          shouldExportQueryKey: globalOptions.shouldExportQueryKey,
        }),
    ...(isUndefined(queryOptions.shouldExportQueryKey)
      ? {}
      : { shouldExportQueryKey: queryOptions.shouldExportQueryKey }),
    ...(isUndefined(globalOptions.shouldExportHttpClient)
      ? {}
      : {
          shouldExportHttpClient: globalOptions.shouldExportHttpClient,
        }),
    ...(isUndefined(queryOptions.shouldExportHttpClient)
      ? {}
      : { shouldExportHttpClient: queryOptions.shouldExportHttpClient }),
    ...(isUndefined(globalOptions.shouldExportMutatorHooks)
      ? {}
      : {
          shouldExportMutatorHooks: globalOptions.shouldExportMutatorHooks,
        }),
    ...(isUndefined(queryOptions.shouldExportMutatorHooks)
      ? {}
      : { shouldExportMutatorHooks: queryOptions.shouldExportMutatorHooks }),
    ...(isUndefined(globalOptions.shouldSplitQueryKey)
      ? {}
      : {
          shouldSplitQueryKey: globalOptions.shouldSplitQueryKey,
        }),
    ...(isUndefined(queryOptions.shouldSplitQueryKey)
      ? {}
      : { shouldSplitQueryKey: queryOptions.shouldSplitQueryKey }),
    ...(isUndefined(globalOptions.signal)
      ? {}
      : {
          signal: globalOptions.signal,
        }),
    ...(isUndefined(globalOptions.useOperationIdAsQueryKey)
      ? {}
      : {
          useOperationIdAsQueryKey: globalOptions.useOperationIdAsQueryKey,
        }),
    ...(isUndefined(queryOptions.useOperationIdAsQueryKey)
      ? {}
      : { useOperationIdAsQueryKey: queryOptions.useOperationIdAsQueryKey }),
    ...(isUndefined(globalOptions.signal)
      ? {}
      : {
          signal: globalOptions.signal,
        }),
    ...(isUndefined(queryOptions.signal)
      ? {}
      : { signal: queryOptions.signal }),
    ...(isUndefined(globalOptions.version)
      ? {}
      : {
          version: globalOptions.version,
        }),
    ...(isUndefined(queryOptions.version)
      ? {}
      : { version: queryOptions.version }),
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
