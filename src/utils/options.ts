import SwaggerParser from '@apidevtools/swagger-parser';
import chalk from 'chalk';
import { RefComponentSuffix } from '../core/getters/ref';
import {
  ConfigExternal,
  NormalizedOptions,
  OptionsExport,
  OutputClient,
} from '../types';
import { githubResolver } from './github';
import { isFunction, isString } from './is';
import { mergeDeep } from './mergeDeep';
import { createLogger } from './messages/logs';

/**
 * Type helper to make it easier to use orval.config.ts
 * accepts a direct {@link ConfigExternal} object.
 */
export function defineConfig(options: ConfigExternal): ConfigExternal {
  return options;
}

export const normalizeOptions = async (optionsExport: OptionsExport) => {
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

  const normalizedOptions: NormalizedOptions = {
    input: {
      target: inputOptions.target,
      validation: inputOptions.validation || false,
      override: inputOptions.override || { transformer: undefined },
      converterOptions: inputOptions.converterOptions || {},
      parserOptions: mergeDeep(
        parserDefaultOptions,
        inputOptions.parserOptions || {},
      ),
    },
    output: {
      target: outputOptions.target,
      schemas: outputOptions.schemas,
      client: outputOptions.client ?? OutputClient.AXIOS,
      mode: outputOptions.mode ?? 'single',
      mock: outputOptions.mock ?? false,
      override: {
        ...outputOptions.override,
        formData: outputOptions.override?.formData ?? true,
        requestOptions: outputOptions.override?.requestOptions ?? true,
        components: {
          schemas: {
            suffix: RefComponentSuffix.schemas,
            ...(outputOptions.override?.components?.schemas || {}),
          },
          responses: {
            suffix: RefComponentSuffix.responses,
            ...(outputOptions.override?.components?.responses || {}),
          },
          parameters: {
            suffix: RefComponentSuffix.parameters,
            ...(outputOptions.override?.components?.parameters || {}),
          },
          requestBodies: {
            suffix: RefComponentSuffix.requestBodies,
            ...(outputOptions.override?.components?.requestBodies || {}),
          },
        },
        query: {
          useQuery: true,
          ...(outputOptions.override?.query || {}),
        },
        angular: {
          provideInRoot: outputOptions.override?.angular?.provideInRoot ?? true,
        },
      },
    },
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
  resolve: { github: githubResolver },
} as SwaggerParser.Options;
