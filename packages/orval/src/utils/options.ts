import {
  ConfigExternal,
  createLogger,
  GlobalOptions,
  Hook,
  HookFunction,
  HooksOptions,
  isBoolean,
  isFunction,
  isObject,
  isString,
  isUrl,
  mergeDeep,
  Mutator,
  NormalizedHookOptions,
  NormalizedMutator,
  NormalizedOperationOptions,
  NormalizedOptions,
  OperationOptions,
  OptionsExport,
  OutputClient,
  OutputMode,
  RefComponentSuffix,
  SwaggerParserOptions,
} from '@orval/core';
import chalk from 'chalk';
import { InfoObject } from 'openapi3-ts';
import { resolve } from 'upath';
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

  const { clean, prettier, client, mode, mock, tslint } = globalOptions;

  const tsconfig = await loadTsconfig(
    outputOptions.tsconfig || globalOptions.tsconfig,
    workspace,
  );

  const packageJson = await loadPackageJson(
    outputOptions.packageJson || globalOptions.packageJson,
    workspace,
  );

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
    },
    output: {
      target: globalOptions.output
        ? normalizePath(globalOptions.output, process.cwd())
        : normalizePath(outputOptions.target, outputWorkspace),
      schemas: normalizePath(outputOptions.schemas, outputWorkspace),
      workspace: outputOptions.workspace ? outputWorkspace : undefined,
      client: outputOptions.client ?? client ?? OutputClient.AXIOS_FUNCTIONS,
      mode: normalizeOutputMode(outputOptions.mode ?? mode),
      mock: outputOptions.mock ?? mock ?? false,
      clean: outputOptions.clean ?? clean ?? false,
      prettier: outputOptions.prettier ?? prettier ?? false,
      tslint: outputOptions.tslint ?? tslint ?? false,
      tsconfig,
      packageJson,
      headers: outputOptions.headers ?? false,
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
        ),
        tags: normalizeOperationsAndTags(
          outputOptions.override?.tags ?? {},
          outputWorkspace,
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
        query: {
          useQuery: true,
          signal: true,
          ...(outputOptions.override?.query ?? {}),
        },
        swr: {
          ...(outputOptions.override?.swr ?? {}),
        },
        angular: {
          provideIn: outputOptions.override?.angular?.provideIn ?? 'root',
        },
        useDates: outputOptions.override?.useDates || false,
        useDeprecatedOperations:
          outputOptions.override?.useDeprecatedOperations ?? true,
      },
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
      path: resolve(workspace, mutator.path),
      default: (mutator.default || !mutator.name) ?? false,
    };
  }

  if (isString(mutator)) {
    return {
      path: resolve(workspace, mutator),
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
  return resolve(workspace, path);
};

const normalizeOperationsAndTags = (
  operationsOrTags: {
    [key: string]: OperationOptions;
  },
  workspace: string,
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
          requestOptions,
          ...rest
        },
      ]) => {
        return [
          key,
          {
            ...rest,
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
    }

    return acc;
  }, {} as NormalizedHookOptions);
};

export const getDefaultFilesHeader = ({
  title,
  description,
  version,
}: InfoObject) => [
  `Generated by ${pkg.name} v${pkg.version} 🍺`,
  `Do not edit manually.`,
  ...(title ? [title] : []),
  ...(description ? [description] : []),
  ...(version ? [`OpenAPI spec version: ${version}`] : []),
];
