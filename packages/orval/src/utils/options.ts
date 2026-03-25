import { access } from 'node:fs/promises';
import nodePath from 'node:path';
import { styleText } from 'node:util';

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
  type InputOptions,
  type InputTransformerFn,
  isBoolean,
  isFunction,
  isNullish,
  isObject,
  isString,
  isUrl,
  type JsDocOptions,
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
  type NormalizedSchemaOptions,
  type OperationOptions,
  type OptionsExport,
  OutputClient,
  OutputHttpClient,
  OutputMode,
  type OverrideOutput,
  PropertySortOrder,
  type QueryOptions,
  RefComponentSuffix,
  type SchemaOptions,
} from '@orval/core';
import { DEFAULT_MOCK_OPTIONS } from '@orval/mock';

import pkg from '../../package.json';
import { loadPackageJson } from './package-json';
import { loadTsconfig } from './tsconfig';

const INPUT_TARGET_FETCH_TIMEOUT_MS = 10_000;
/**
 * Type helper to make it easier to use orval.config.ts
 * accepts a direct {@link ConfigExternal} object.
 */
export function defineConfig(options: ConfigExternal): ConfigExternal {
  return options;
}

/**
 * Type helper to make it easier to write input transformers.
 * accepts a direct {@link InputTransformerFn} function.
 */
export function defineTransformer(
  transformer: InputTransformerFn,
): InputTransformerFn {
  return transformer;
}

function createFormData(
  workspace: string,
  formData: OverrideOutput['formData'],
): NormalizedOverrideOutput['formData'] {
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
}

function normalizeSchemasOption(
  schemas: string | SchemaOptions | undefined,
  workspace: string,
): string | NormalizedSchemaOptions | undefined {
  if (!schemas) {
    return undefined;
  }

  if (isString(schemas)) {
    return normalizePath(schemas, workspace);
  }

  return {
    path: normalizePath(schemas.path, workspace),
    type: schemas.type,
  };
}

export async function normalizeOptions(
  optionsExport: OptionsExport,
  workspace = process.cwd(),
  globalOptions: GlobalOptions = {},
): Promise<NormalizedOptions> {
  const options = await (isFunction(optionsExport)
    ? optionsExport()
    : optionsExport);

  if (!options.input) {
    throw new Error(styleText('red', `Config requires an input.`));
  }

  if (!options.output) {
    throw new Error(styleText('red', `Config requires an output.`));
  }

  const inputOptions: InputOptions =
    isString(options.input) || Array.isArray(options.input)
      ? { target: options.input }
      : options.input;

  const outputOptions = isString(options.output)
    ? { target: options.output }
    : options.output;

  const outputWorkspace = normalizePath(
    outputOptions.workspace ?? '',
    workspace,
  );

  const { clean, client, httpClient, mode } = globalOptions;

  const tsconfig = await loadTsconfig(
    outputOptions.tsconfig ?? globalOptions.tsconfig,
    workspace,
  );

  const packageJson = await loadPackageJson(
    outputOptions.packageJson ?? globalOptions.packageJson,
    workspace,
  );

  const mockOption = outputOptions.mock ?? globalOptions.mock;
  let mock: GlobalMockOptions | ClientMockBuilder | undefined;
  if (isBoolean(mockOption) && mockOption) {
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
        ? Array.isArray(globalOptions.input)
          ? await resolveFirstValidTarget(
              globalOptions.input,
              process.cwd(),
              inputOptions.parserOptions,
            )
          : normalizePathOrUrl(globalOptions.input, process.cwd())
        : Array.isArray(inputOptions.target)
          ? await resolveFirstValidTarget(
              inputOptions.target,
              workspace,
              inputOptions.parserOptions,
            )
          : normalizePathOrUrl(inputOptions.target, workspace),
      override: {
        transformer: normalizePath(
          inputOptions.override?.transformer,
          workspace,
        ),
      },
      filters: inputOptions.filters,
      parserOptions: inputOptions.parserOptions,
    },
    output: {
      target: globalOptions.output
        ? normalizePath(globalOptions.output, process.cwd())
        : normalizePath(outputOptions.target, outputWorkspace),
      schemas: normalizeSchemasOption(outputOptions.schemas, outputWorkspace),
      operationSchemas: outputOptions.operationSchemas
        ? normalizePath(outputOptions.operationSchemas, outputWorkspace)
        : undefined,
      namingConvention:
        outputOptions.namingConvention ?? NamingConvention.CAMEL_CASE,
      fileExtension: outputOptions.fileExtension ?? defaultFileExtension,
      workspace: outputOptions.workspace ? outputWorkspace : undefined,
      client: outputOptions.client ?? client ?? OutputClient.AXIOS_FUNCTIONS,
      httpClient:
        outputOptions.httpClient ??
        httpClient ??
        // Auto-detect: use Angular HttpClient for angular-query by default
        ((outputOptions.client ?? client) === OutputClient.ANGULAR_QUERY
          ? OutputHttpClient.ANGULAR
          : OutputHttpClient.FETCH),
      mode: normalizeOutputMode(outputOptions.mode ?? mode),
      mock,
      clean: outputOptions.clean ?? clean ?? false,
      docs: outputOptions.docs ?? false,
      formatter: outputOptions.formatter ?? globalOptions.formatter,
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
            ? outputOptions.override.formUrlEncoded
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
              ? outputOptions.override.header
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
          generateErrorTypes: false,
          ...outputOptions.override?.swr,
        },
        angular: {
          provideIn: outputOptions.override?.angular?.provideIn ?? 'root',
          client:
            outputOptions.override?.angular?.retrievalClient ??
            outputOptions.override?.angular?.client ??
            'httpClient',
          runtimeValidation:
            outputOptions.override?.angular?.runtimeValidation ?? false,
          ...(outputOptions.override?.angular?.httpResource
            ? { httpResource: outputOptions.override.angular.httpResource }
            : {}),
        },
        fetch: {
          includeHttpResponseReturnType:
            outputOptions.override?.fetch?.includeHttpResponseReturnType ??
            true,
          forceSuccessResponse:
            outputOptions.override?.fetch?.forceSuccessResponse ?? false,
          runtimeValidation:
            outputOptions.override?.fetch?.runtimeValidation ?? false,
          ...outputOptions.override?.fetch,
          ...(outputOptions.override?.fetch?.jsonReviver
            ? {
                jsonReviver: normalizeMutator(
                  outputWorkspace,
                  outputOptions.override.fetch.jsonReviver,
                ),
              }
            : {}),
        },
        useDates: outputOptions.override?.useDates ?? false,
        useDeprecatedOperations:
          outputOptions.override?.useDeprecatedOperations ?? true,
        enumGenerationType:
          outputOptions.override?.enumGenerationType ?? 'const',
        suppressReadonlyModifier:
          outputOptions.override?.suppressReadonlyModifier ?? false,
        preserveReadonlyRequestBodies:
          outputOptions.override?.preserveReadonlyRequestBodies ?? 'strip',
        aliasCombinedTypes: outputOptions.override?.aliasCombinedTypes ?? false,
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
    throw new Error(styleText('red', `Config requires an input target.`));
  }

  if (!normalizedOptions.output.target && !normalizedOptions.output.schemas) {
    throw new Error(
      styleText('red', `Config requires an output target or schemas.`),
    );
  }

  return normalizedOptions;
}

function normalizeMutator(
  workspace: string,
  mutator?: Mutator,
): NormalizedMutator | undefined {
  if (isObject(mutator)) {
    const m = mutator as Exclude<Mutator, string>;
    if (!m.path) {
      throw new Error(styleText('red', `Mutator requires a path.`));
    }

    return {
      path: nodePath.resolve(workspace, m.path),
      name: m.name,
      default: m.default ?? !m.name,
      alias: m.alias,
      external: m.external,
      extension: m.extension,
    };
  }

  if (isString(mutator)) {
    return {
      path: nodePath.resolve(workspace, mutator),
      default: true,
    };
  }

  return undefined;
}

async function resolveFirstValidTarget(
  targets: string[],
  workspace: string,
  parserOptions?: InputOptions['parserOptions'],
): Promise<string> {
  for (const target of targets) {
    if (isUrl(target)) {
      try {
        const headers = getHeadersForUrl(target, parserOptions?.headers);
        const headResponse = await fetchWithTimeout(target, {
          method: 'HEAD',
          headers,
        });

        if (headResponse.ok) {
          return target;
        }

        if (headResponse.status === 405 || headResponse.status === 501) {
          const getResponse = await fetchWithTimeout(target, {
            method: 'GET',
            headers,
          });

          if (getResponse.ok) {
            return target;
          }
        }
      } catch {
        continue;
      }

      continue;
    }

    const resolvedTarget = normalizePath(target, workspace);

    try {
      await access(resolvedTarget);
      return resolvedTarget;
    } catch {
      continue;
    }
  }

  throw new Error(
    styleText(
      'red',
      `None of the input targets could be resolved:\n${targets.map((target) => `  - ${target}`).join('\n')}`,
    ),
  );
}

function getHeadersForUrl(
  url: string,
  headersConfig?: NonNullable<InputOptions['parserOptions']>['headers'],
): Record<string, string> {
  if (!headersConfig) return {};

  const { hostname } = new URL(url);
  const matchedHeaders: Record<string, string> = {};

  for (const headerEntry of headersConfig) {
    if (
      headerEntry.domains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      )
    ) {
      Object.assign(matchedHeaders, headerEntry.headers);
    }
  }

  return matchedHeaders;
}

async function fetchWithTimeout(
  target: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, INPUT_TARGET_FETCH_TIMEOUT_MS);

  try {
    return await fetch(target, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizePathOrUrl<T>(path: T, workspace: string) {
  if (isString(path) && !isUrl(path)) {
    return normalizePath(path, workspace);
  }

  return path;
}

export function normalizePath<T>(path: T, workspace: string) {
  if (!isString(path)) {
    return path;
  }
  return nodePath.resolve(workspace, path);
}

function normalizeOperationsAndTags(
  operationsOrTags: Record<string, OperationOptions>,
  workspace: string,
  global: {
    query: NormalizedQueryOptions;
  },
): Record<string, NormalizedOperationOptions> {
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
          angular,
          zod,
          ...rest
        },
      ]) => {
        return [
          key,
          {
            ...rest,
            ...(angular
              ? {
                  angular: {
                    provideIn: angular.provideIn ?? 'root',
                    client:
                      angular.retrievalClient ?? angular.client ?? 'httpClient',
                    runtimeValidation: angular.runtimeValidation ?? false,
                    ...(angular.httpResource
                      ? { httpResource: angular.httpResource }
                      : {}),
                  },
                }
              : {}),
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
                    generateEachHttpStatus: zod.generateEachHttpStatus ?? false,
                    dateTimeOptions: zod.dateTimeOptions ?? {},
                    timeOptions: zod.timeOptions ?? {},
                  },
                }
              : {}),
            ...(transformer
              ? { transformer: normalizePath(transformer, workspace) }
              : {}),
            ...(mutator
              ? { mutator: normalizeMutator(workspace, mutator) }
              : {}),
            ...(formData === undefined
              ? {}
              : { formData: createFormData(workspace, formData) }),
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
}

function normalizeOutputMode(mode?: OutputMode): OutputMode {
  if (!mode) {
    return OutputMode.SINGLE;
  }

  if (!Object.values(OutputMode).includes(mode)) {
    createLogger().warn(
      styleText('yellow', `Unknown provided mode => ${mode}`),
    );
    return OutputMode.SINGLE;
  }

  return mode;
}

function normalizeHooks(hooks: HooksOptions): NormalizedHookOptions {
  const keys = Object.keys(hooks) as unknown as Hook[];

  const result: NormalizedHookOptions = {};
  for (const key of keys) {
    if (isString(hooks[key])) {
      result[key] = [hooks[key]] as string[];
    } else if (Array.isArray(hooks[key])) {
      result[key] = hooks[key] as string[];
    } else if (isFunction(hooks[key])) {
      result[key] = [hooks[key]] as HookFunction[];
    } else if (isObject(hooks[key])) {
      result[key] = [hooks[key]] as HookOption[];
    }
  }
  return result;
}

function normalizeHonoOptions(
  hono: HonoOptions = {},
  workspace: string,
): NormalizedHonoOptions {
  return {
    ...(hono.handlers
      ? { handlers: nodePath.resolve(workspace, hono.handlers) }
      : {}),
    compositeRoute: hono.compositeRoute
      ? nodePath.resolve(workspace, hono.compositeRoute)
      : '',
    validator: hono.validator ?? true,
    validatorOutputPath: hono.validatorOutputPath
      ? nodePath.resolve(workspace, hono.validatorOutputPath)
      : '',
  };
}

function normalizeJSDocOptions(
  jsdoc: JsDocOptions = {},
): NormalizedJsDocOptions {
  return {
    ...jsdoc,
  };
}

function normalizeQueryOptions(
  queryOptions: QueryOptions = {},
  outputWorkspace: string,
  globalOptions: NormalizedQueryOptions = {},
): NormalizedQueryOptions {
  if (queryOptions.options) {
    console.warn(
      '[WARN] Using query options is deprecated and will be removed in a future major release. Please use queryOptions or mutationOptions instead.',
    );
  }

  return {
    ...(isNullish(queryOptions.usePrefetch)
      ? {}
      : { usePrefetch: queryOptions.usePrefetch }),
    ...(isNullish(queryOptions.useInvalidate)
      ? {}
      : { useInvalidate: queryOptions.useInvalidate }),
    ...(isNullish(queryOptions.useSetQueryData)
      ? {}
      : { useSetQueryData: queryOptions.useSetQueryData }),
    ...(isNullish(queryOptions.useQuery)
      ? {}
      : { useQuery: queryOptions.useQuery }),
    ...(isNullish(queryOptions.useSuspenseQuery)
      ? {}
      : { useSuspenseQuery: queryOptions.useSuspenseQuery }),
    ...(isNullish(queryOptions.useMutation)
      ? {}
      : { useMutation: queryOptions.useMutation }),
    ...(isNullish(queryOptions.useInfinite)
      ? {}
      : { useInfinite: queryOptions.useInfinite }),
    ...(isNullish(queryOptions.useSuspenseInfiniteQuery)
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
    ...(queryOptions.queryKey
      ? {
          queryKey: normalizeMutator(outputWorkspace, queryOptions.queryKey),
        }
      : {}),
    ...(globalOptions.queryOptions
      ? {
          queryOptions: globalOptions.queryOptions,
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
    ...(globalOptions.mutationOptions
      ? {
          mutationOptions: globalOptions.mutationOptions,
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
    ...(isNullish(globalOptions.shouldExportQueryKey)
      ? {}
      : {
          shouldExportQueryKey: globalOptions.shouldExportQueryKey,
        }),
    ...(isNullish(queryOptions.shouldExportQueryKey)
      ? {}
      : { shouldExportQueryKey: queryOptions.shouldExportQueryKey }),
    ...(isNullish(globalOptions.shouldExportHttpClient)
      ? {}
      : {
          shouldExportHttpClient: globalOptions.shouldExportHttpClient,
        }),
    ...(isNullish(queryOptions.shouldExportHttpClient)
      ? {}
      : { shouldExportHttpClient: queryOptions.shouldExportHttpClient }),
    ...(isNullish(globalOptions.shouldExportMutatorHooks)
      ? {}
      : {
          shouldExportMutatorHooks: globalOptions.shouldExportMutatorHooks,
        }),
    ...(isNullish(queryOptions.shouldExportMutatorHooks)
      ? {}
      : { shouldExportMutatorHooks: queryOptions.shouldExportMutatorHooks }),
    ...(isNullish(globalOptions.shouldSplitQueryKey)
      ? {}
      : {
          shouldSplitQueryKey: globalOptions.shouldSplitQueryKey,
        }),
    ...(isNullish(queryOptions.shouldSplitQueryKey)
      ? {}
      : { shouldSplitQueryKey: queryOptions.shouldSplitQueryKey }),
    ...(isNullish(globalOptions.signal)
      ? {}
      : {
          signal: globalOptions.signal,
        }),
    ...(isNullish(globalOptions.useOperationIdAsQueryKey)
      ? {}
      : {
          useOperationIdAsQueryKey: globalOptions.useOperationIdAsQueryKey,
        }),
    ...(isNullish(queryOptions.useOperationIdAsQueryKey)
      ? {}
      : { useOperationIdAsQueryKey: queryOptions.useOperationIdAsQueryKey }),
    ...(isNullish(globalOptions.signal)
      ? {}
      : {
          signal: globalOptions.signal,
        }),
    ...(isNullish(queryOptions.signal) ? {} : { signal: queryOptions.signal }),
    ...(isNullish(globalOptions.version)
      ? {}
      : {
          version: globalOptions.version,
        }),
    ...(isNullish(queryOptions.version)
      ? {}
      : { version: queryOptions.version }),
    ...(queryOptions.mutationInvalidates
      ? { mutationInvalidates: queryOptions.mutationInvalidates }
      : {}),
    ...(isNullish(globalOptions.runtimeValidation)
      ? {}
      : {
          runtimeValidation: globalOptions.runtimeValidation,
        }),
    ...(isNullish(queryOptions.runtimeValidation)
      ? {}
      : { runtimeValidation: queryOptions.runtimeValidation }),
  };
}

export function getDefaultFilesHeader({
  title,
  description,
  version,
}: {
  title?: string;
  description?: string;
  version?: string;
} = {}) {
  return [
    `Generated by ${pkg.name} v${pkg.version} 🍺`,
    `Do not edit manually.`,
    ...(title ? [title] : []),
    ...(description ? [description] : []),
    ...(version ? [`OpenAPI spec version: ${version}`] : []),
  ];
}
