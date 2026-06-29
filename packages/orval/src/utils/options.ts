import { existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import nodePath from 'node:path';
import { styleText } from 'node:util';

import {
  type ConfigExternal,
  type EffectOptions,
  FormDataArrayHandling,
  type FakerMockOptions,
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
  logWarning,
  type McpOptions,
  type McpServerOptions,
  type Mutator,
  NamingConvention,
  type NormalizedEffectOptions,
  type NormalizedFactoryMethodsOptions,
  type NormalizedHonoOptions,
  type NormalizedHookOptions,
  type NormalizedJsDocOptions,
  type NormalizedMcpOptions,
  type NormalizedMcpServerOptions,
  type NormalizedMocksConfig,
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
  OutputMockType,
  OutputMode,
  type OverrideOutput,
  PropertySortOrder,
  type QueryOptions,
  RefComponentSuffix,
  type SchemaOptions,
} from '@orval/core';
import { getDefaultMockOptionsForType } from '@orval/mock';

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
  schemas: string | SchemaOptions | false | undefined,
  workspace: string,
): string | NormalizedSchemaOptions | undefined {
  if (!schemas) {
    return undefined;
  }

  if (isString(schemas)) {
    return normalizePath(schemas, workspace);
  }

  validatePackageSpecifier(schemas.importPath, 'schemas.importPath');

  return {
    path: normalizePath(schemas.path, workspace),
    type: schemas.type ?? 'typescript',
    importPath: schemas.importPath,
    splitByTags: schemas.splitByTags ?? false,
  };
}

/**
 * Validates that a config value is a valid package specifier (bare specifier
 * or sub-path import like `@acme/models` / `@acme/models/fakers`). Rejects
 * empty, whitespace-only, relative (`./`, `../`), and absolute paths with a
 * clear, actionable error message. No-op when the value is `undefined`.
 */
function validatePackageSpecifier(
  value: string | undefined,
  fieldName: string,
): void {
  if (value === undefined) {
    return;
  }

  if (!value) {
    throw new Error(
      `\`${fieldName}\` must be a non-empty package specifier (e.g. '@acme/models'). Received an empty string.`,
    );
  }

  if (value.trim() === '') {
    throw new Error(
      `\`${fieldName}\` must be a non-empty package specifier (e.g. '@acme/models'). Received a whitespace-only string.`,
    );
  }

  if (value.trim() !== value) {
    throw new Error(
      `\`${fieldName}\` must be a non-empty package specifier (e.g. '@acme/models'). Received a value with leading or trailing whitespace: "${value}"`,
    );
  }

  if (value.startsWith('.')) {
    throw new Error(
      `\`${fieldName}\` must be a package specifier (e.g. '@acme/models'), not a relative path. Received: "${value}"`,
    );
  }

  if (
    nodePath.isAbsolute(value) ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith('\\\\')
  ) {
    throw new Error(
      `\`${fieldName}\` must be a package specifier (e.g. '@acme/models'), not an absolute path. Received: "${value}"`,
    );
  }
}

function looksLikePackageSpecifier(value: string): boolean {
  return (
    !!value &&
    value.trim() === value &&
    !value.startsWith('.') &&
    !nodePath.isAbsolute(value) &&
    !/^[A-Za-z]:[\\/]/.test(value) &&
    !value.startsWith('\\\\')
  );
}

function resolvePackageSpecifier(
  workspace: string,
  value: string,
): string | undefined {
  try {
    return createRequire(nodePath.join(workspace, 'package.json')).resolve(
      value,
    );
  } catch {
    return;
  }
}

function isPackageSpecifierCandidate(
  workspace: string,
  value: string,
): boolean {
  if (!looksLikePackageSpecifier(value)) {
    return false;
  }

  if (existsSync(nodePath.resolve(workspace, value))) {
    return false;
  }

  if (value.startsWith('@')) {
    return true;
  }

  const [packageName] = value.split('/');

  if (!value.includes('/')) {
    return true;
  }

  for (let dir = workspace; ; ) {
    if (existsSync(nodePath.join(dir, 'node_modules', packageName))) {
      return true;
    }

    const parent = nodePath.dirname(dir);
    if (parent === dir) {
      return false;
    }

    dir = parent;
  }
}

function normalizeEffectOptions(
  effect?: EffectOptions,
): NormalizedEffectOptions {
  return {
    strict: {
      param: effect?.strict?.param ?? false,
      query: effect?.strict?.query ?? false,
      header: effect?.strict?.header ?? false,
      body: effect?.strict?.body ?? false,
      response: effect?.strict?.response ?? false,
    },
    generate: {
      param: effect?.generate?.param ?? true,
      query: effect?.generate?.query ?? true,
      header: effect?.generate?.header ?? true,
      body: effect?.generate?.body ?? true,
      response: effect?.generate?.response ?? true,
    },
    generateEachHttpStatus: effect?.generateEachHttpStatus ?? false,
    useBrandedTypes: effect?.useBrandedTypes ?? false,
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

  // Normalize the `mock` option into a canonical `NormalizedMocksConfig`
  // so the rest of the pipeline can iterate `generators` uniformly without
  // branching on the input shape (boolean shorthand, function form, or
  // object form).
  const mocksOption = outputOptions.mock ?? globalOptions.mock;
  let mocks: NormalizedMocksConfig = {
    indexMockFiles: false,
    generators: [],
  };
  if (isBoolean(mocksOption) && mocksOption) {
    // `mock: true` shorthand emits both an MSW handler file and a faker
    // factory file using default options for each.
    mocks = {
      indexMockFiles: false,
      generators: [
        getDefaultMockOptionsForType(OutputMockType.MSW),
        getDefaultMockOptionsForType(OutputMockType.FAKER),
      ],
    };
  } else if (isFunction(mocksOption)) {
    // Function form treats the entire mocks option as a single
    // ClientMockBuilder. Wrap it in the array so writers can still iterate.
    mocks = { indexMockFiles: false, generators: [mocksOption] };
  } else if (mocksOption && typeof mocksOption === 'object') {
    if (!Array.isArray(mocksOption.generators)) {
      throw new TypeError(
        'mock.generators must be an array of generator entries (e.g. [{ type: "msw" }]).',
      );
    }
    const sharedMockPath =
      mocksOption.path && isString(mocksOption.path)
        ? normalizePath(mocksOption.path, outputWorkspace)
        : undefined;
    mocks = {
      indexMockFiles: mocksOption.indexMockFiles ?? false,
      path: sharedMockPath,
      generators: mocksOption.generators.map((m) =>
        isFunction(m)
          ? m
          : ({
              ...getDefaultMockOptionsForType(m.type),
              ...m,
              path:
                m.path && isString(m.path)
                  ? normalizePath(m.path, outputWorkspace)
                  : sharedMockPath,
            } as GlobalMockOptions),
      ),
    };
  }

  const seenMockTypes = new Set<string>();
  for (const entry of mocks.generators) {
    if (isFunction(entry)) continue;
    if (seenMockTypes.has(entry.type)) {
      throw new Error(
        `Duplicate mock generator type "${entry.type}". Each type can only appear once in mock.generators.`,
      );
    }
    seenMockTypes.add(entry.type);

    if (entry.type === OutputMockType.FAKER) {
      validatePackageSpecifier(
        entry.schemasImportPath,
        'mock.generators[faker].schemasImportPath',
      );
    }
  }

  const defaultFileExtension = '.ts';

  // Reusable Zod schemas land in `*.zod.ts` files by default so they sit
  // alongside any existing TypeScript types without a name collision. We
  // expose this as a separate `schemaFileExtension` field (not by flipping
  // the global `fileExtension`) so that non-schema writers (mode writers,
  // mock writers, the workspace barrel) keep their own extensions and don't
  // start emitting `*.zod.ts` for unrelated artifacts. A user-set
  // `output.fileExtension` overrides this default at the call site.
  const isZodSchemasOutput =
    !!outputOptions.schemas &&
    ((!isString(outputOptions.schemas) &&
      outputOptions.schemas.type === 'zod') ||
      (isString(outputOptions.schemas) &&
        (outputOptions.client ?? client) === 'zod' &&
        outputOptions.override?.zod?.generateReusableSchemas === true));
  const defaultSchemaFileExtension = isZodSchemasOutput
    ? '.zod.ts'
    : defaultFileExtension;

  const factoryMethodsConfig = outputOptions.factoryMethods;
  let factoryMethods: NormalizedFactoryMethodsOptions | undefined = undefined;

  if (factoryMethodsConfig) {
    factoryMethods = {
      functionNamePrefix: factoryMethodsConfig.functionNamePrefix ?? 'create',
      mode: factoryMethodsConfig.mode ?? 'split',
      outputDirectory: factoryMethodsConfig.outputDirectory
        ? normalizePath(factoryMethodsConfig.outputDirectory, outputWorkspace)
        : outputOptions.schemas
          ? normalizePath(
              isString(outputOptions.schemas)
                ? outputOptions.schemas
                : outputOptions.schemas.path,
              outputWorkspace,
            )
          : normalizePath(outputWorkspace, outputWorkspace),
      includeOptionalProperty:
        factoryMethodsConfig.includeOptionalProperty ?? true,
    };
  }

  // `useQuery` / `useMutation` defaults are applied per-verb in
  // `query-generator.ts` so we can tell "unset" from "explicit true" (#2376).
  const globalQueryOptions: NormalizedQueryOptions = {
    signal: true,
    shouldExportMutatorHooks: true,
    shouldExportHttpClient: true,
    shouldExportQueryKey: true,
    shouldFilterQueryKey: false,
    shouldSplitQueryKey: false,
    ...normalizeQueryOptions(outputOptions.override?.query, outputWorkspace),
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
      unsafeDisableValidation: inputOptions.unsafeDisableValidation ?? false,
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
      schemaFileExtension:
        outputOptions.schemaFileExtension ??
        outputOptions.fileExtension ??
        defaultSchemaFileExtension,
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
      mock: mocks,
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
      factoryMethods,
      tagsSplitDeduplication: outputOptions.tagsSplitDeduplication ?? false,
      commonTypesFileName: outputOptions.commonTypesFileName ?? 'common-types',
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
          'operations',
        ),
        tags: normalizeOperationsAndTags(
          outputOptions.override?.tags ?? {},
          outputWorkspace,
          {
            query: globalQueryOptions,
          },
          'tags',
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
        paramsFilter: normalizeMutator(
          outputWorkspace,
          outputOptions.override?.paramsFilter,
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
        mcp: normalizeMcpOptions(outputOptions.override?.mcp, workspace),
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
                    outputWorkspace,
                    outputOptions.override.zod.preprocess.param,
                  ),
                }
              : {}),
            ...(outputOptions.override?.zod?.preprocess?.query
              ? {
                  query: normalizeMutator(
                    outputWorkspace,
                    outputOptions.override.zod.preprocess.query,
                  ),
                }
              : {}),
            ...(outputOptions.override?.zod?.preprocess?.header
              ? {
                  header: normalizeMutator(
                    outputWorkspace,
                    outputOptions.override.zod.preprocess.header,
                  ),
                }
              : {}),
            ...(outputOptions.override?.zod?.preprocess?.body
              ? {
                  body: normalizeMutator(
                    outputWorkspace,
                    outputOptions.override.zod.preprocess.body,
                  ),
                }
              : {}),
            ...(outputOptions.override?.zod?.preprocess?.response
              ? {
                  response: normalizeMutator(
                    outputWorkspace,
                    outputOptions.override.zod.preprocess.response,
                  ),
                }
              : {}),
          },
          ...(outputOptions.override?.zod?.params
            ? {
                params: normalizeMutator(
                  outputWorkspace,
                  outputOptions.override.zod.params,
                ),
              }
            : {}),
          variant: outputOptions.override?.zod?.variant ?? 'classic',
          version: outputOptions.override?.zod?.version ?? 'auto',
          generateEachHttpStatus:
            outputOptions.override?.zod?.generateEachHttpStatus ?? false,
          useBrandedTypes:
            outputOptions.override?.zod?.useBrandedTypes ?? false,
          generateReusableSchemas:
            outputOptions.override?.zod?.generateReusableSchemas ?? false,
          generateMeta: outputOptions.override?.zod?.generateMeta ?? false,
          dateTimeOptions: outputOptions.override?.zod?.dateTimeOptions ?? {
            offset: true,
          },
          timeOptions: outputOptions.override?.zod?.timeOptions ?? {},
        },
        effect: normalizeEffectOptions(outputOptions.override?.effect),
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
          useRuntimeFetcher:
            outputOptions.override?.fetch?.useRuntimeFetcher ?? false,
          ...(outputOptions.override?.fetch?.arrayFormat
            ? { arrayFormat: outputOptions.override.fetch.arrayFormat }
            : {}),
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
        splitByContentType: outputOptions.override?.splitByContentType ?? false,
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

  // The faker generator's `schemasImportPath` overrides where schema-level
  // faker factories are imported from. Those factories are only emitted when
  // `schemas: true`, and the override is only meaningful in package-import
  // mode (`schemas.importPath`). Require both so a standalone
  // `schemasImportPath` fails fast instead of silently doing nothing.
  const fakerWithSchemasImportPath =
    normalizedOptions.output.mock.generators.find(
      (g): g is FakerMockOptions =>
        !isFunction(g) &&
        g.type === OutputMockType.FAKER &&
        !!g.schemasImportPath,
    );
  if (fakerWithSchemasImportPath) {
    if (fakerWithSchemasImportPath.schemas !== true) {
      throw new Error(
        styleText(
          'red',
          `\`mock.generators[faker].schemasImportPath\` requires \`schemas: true\` on the same generator. Schema-level faker factories are only emitted when \`schemas: true\`.`,
        ),
      );
    }
    if (
      !(
        isObject(normalizedOptions.output.schemas) &&
        normalizedOptions.output.schemas.importPath
      )
    ) {
      throw new Error(
        styleText(
          'red',
          `\`mock.generators[faker].schemasImportPath\` requires \`schemas.importPath\` to also be set. It overrides the package specifier used for importing schema-level faker factories.`,
        ),
      );
    }
  }

  // `paramsFilter` is only consumed by the Angular generator. That runs for
  // the `angular` client (regardless of `httpClient`, which stays at its
  // `fetch` default there) and for `angular-query` when it resolves to the
  // Angular HttpClient. For any other client the mutator would be imported
  // but never called, so fail fast instead of emitting a dead import.
  const usesAngularGenerator =
    normalizedOptions.output.client === OutputClient.ANGULAR ||
    (normalizedOptions.output.client === OutputClient.ANGULAR_QUERY &&
      normalizedOptions.output.httpClient === OutputHttpClient.ANGULAR);
  if (normalizedOptions.output.override.paramsFilter && !usesAngularGenerator) {
    throw new Error(
      styleText(
        'red',
        `\`override.paramsFilter\` is only supported by the Angular generator (the \`angular\` client, or \`angular-query\` with \`httpClient: 'angular'\`). It has no effect for other clients — use \`override.paramsSerializer\` instead.`,
      ),
    );
  }
  if (!usesAngularGenerator) {
    const offendingOperation = Object.entries(
      normalizedOptions.output.override.operations,
    ).find(([, opOverride]) => opOverride?.paramsFilter)?.[0];
    if (offendingOperation) {
      throw new Error(
        styleText(
          'red',
          `\`override.operations["${offendingOperation}"].paramsFilter\` is only supported by the Angular generator (the \`angular\` client, or \`angular-query\` with \`httpClient: 'angular'\`). It has no effect for other clients — use \`override.paramsSerializer\` instead.`,
        ),
      );
    }
    const offendingTag = Object.entries(
      normalizedOptions.output.override.tags,
    ).find(([, tagOverride]) => tagOverride?.paramsFilter)?.[0];
    if (offendingTag) {
      throw new Error(
        styleText(
          'red',
          `\`override.tags["${offendingTag}"].paramsFilter\` is only supported by the Angular generator (the \`angular\` client, or \`angular-query\` with \`httpClient: 'angular'\`). It has no effect for other clients — use \`override.paramsSerializer\` instead.`,
        ),
      );
    }
  }

  if (
    normalizedOptions.output.httpClient === OutputHttpClient.FETCH &&
    normalizedOptions.output.optionsParamRequired &&
    normalizedOptions.output.override.requestOptions !== false
  ) {
    logWarning(
      `⚠️  With \`httpClient: 'fetch'\`, \`optionsParamRequired: true\` cannot make the generated \`options\` parameter required. The fetch \`options\` parameter remains optional with type \`RequestInit\` (\`optionsParamRequired\` may still affect other generated parameters). Set \`httpClient: 'axios'\` to make the \`options\` parameter required.`,
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

    const resolvedPath = looksLikePackageSpecifier(m.path)
      ? resolvePackageSpecifier(workspace, m.path)
      : undefined;
    const isPackageSpecifier =
      !!resolvedPath || isPackageSpecifierCandidate(workspace, m.path);

    return {
      path: isPackageSpecifier ? m.path : nodePath.resolve(workspace, m.path),
      ...(resolvedPath ? { resolvedPath } : {}),
      name: m.name,
      default: m.default ?? !m.name,
      alias: m.alias,
      external: m.external,
      extension: m.extension,
    };
  }

  if (isString(mutator)) {
    const resolvedPath = looksLikePackageSpecifier(mutator)
      ? resolvePackageSpecifier(workspace, mutator)
      : undefined;
    const isPackageSpecifier =
      !!resolvedPath || isPackageSpecifierCandidate(workspace, mutator);

    return {
      path: isPackageSpecifier ? mutator : nodePath.resolve(workspace, mutator),
      ...(resolvedPath ? { resolvedPath } : {}),
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
  source: 'operations' | 'tags',
): Record<string, NormalizedOperationOptions> {
  const unsupportedZodKeys = [
    'version',
    'variant',
    'dateTimeOptions',
    'timeOptions',
    'generateEachHttpStatus',
    'generateReusableSchemas',
    'generateMeta',
  ] as const;

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
          paramsFilter,
          query,
          angular,
          zod,
          effect,
          ...rest
        },
      ]) => {
        const unsupportedOperationZodKeys =
          zod &&
          unsupportedZodKeys.filter(
            (unsupportedKey) =>
              (zod as Record<string, unknown>)[unsupportedKey] !== undefined,
          );

        if (unsupportedOperationZodKeys && unsupportedOperationZodKeys.length) {
          const fieldLabel =
            unsupportedOperationZodKeys.length === 1 ? 'field' : 'fields';
          const unsupportedFields = unsupportedOperationZodKeys
            .map((unsupportedKey) => `zod.${unsupportedKey}`)
            .join(', ');

          logWarning(
            `⚠️  override.${source}.${key}.zod only supports strict, generate, coerce, preprocess, params, and useBrandedTypes. Ignoring unsupported ${fieldLabel}: ${unsupportedFields}.`,
          );
        }

        // Only emit a normalized zod object when the entry actually carries a
        // supported operation-level field. Otherwise an unsupported-only entry
        // (e.g. `{ version: 3 }`) would inject default strict/generate/coerce
        // values that override global `override.zod.*` during downstream merges,
        // contradicting the "ignored" warning above.
        const hasSupportedOperationZodConfig =
          !!zod &&
          (zod.strict !== undefined ||
            zod.generate !== undefined ||
            zod.coerce !== undefined ||
            zod.preprocess !== undefined ||
            zod.params !== undefined ||
            zod.useBrandedTypes !== undefined);

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
            ...(hasSupportedOperationZodConfig && zod
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
                    ...(zod.params
                      ? {
                          params: normalizeMutator(workspace, zod.params),
                        }
                      : {}),
                    useBrandedTypes: zod.useBrandedTypes ?? false,
                  },
                }
              : {}),
            ...(effect ? { effect: normalizeEffectOptions(effect) } : {}),
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
            ...(paramsFilter
              ? {
                  paramsFilter: normalizeMutator(workspace, paramsFilter),
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
    logWarning(`⚠️  Unknown provided mode => ${mode}`);
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
    handlerGenerationStrategy: hono.handlerGenerationStrategy ?? 'smart',
    compositeRoute: hono.compositeRoute
      ? nodePath.resolve(workspace, hono.compositeRoute)
      : '',
    validator: hono.validator ?? true,
    validatorOutputPath: hono.validatorOutputPath
      ? nodePath.resolve(workspace, hono.validatorOutputPath)
      : '',
  };
}

function normalizeMcpServerOptions(
  server: McpServerOptions,
  workspace: string,
): NormalizedMcpServerOptions {
  return {
    path: nodePath.resolve(workspace, server.path),
    name: server.name,
    default: server.default ?? !server.name,
  };
}

function normalizeMcpOptions(
  mcp: McpOptions = {},
  workspace: string,
): NormalizedMcpOptions {
  return mcp.server
    ? { server: normalizeMcpServerOptions(mcp.server, workspace) }
    : {};
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
    logWarning(
      '⚠️  Using query options is deprecated and will be removed in a future major release. Please use queryOptions or mutationOptions instead.',
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
    ...(isNullish(queryOptions.useGetQueryData)
      ? {}
      : { useGetQueryData: queryOptions.useGetQueryData }),
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
    ...(isNullish(globalOptions.shouldFilterQueryKey)
      ? {}
      : {
          shouldFilterQueryKey: globalOptions.shouldFilterQueryKey,
        }),
    ...(isNullish(queryOptions.shouldFilterQueryKey)
      ? {}
      : { shouldFilterQueryKey: queryOptions.shouldFilterQueryKey }),
    ...(isNullish(globalOptions.queryKeyFilter)
      ? {}
      : {
          queryKeyFilter: globalOptions.queryKeyFilter,
        }),
    ...(isNullish(queryOptions.queryKeyFilter)
      ? {}
      : { queryKeyFilter: queryOptions.queryKeyFilter }),
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

function getDefaultFilesHeader({
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
