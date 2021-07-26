import SwaggerParser from '@apidevtools/swagger-parser';
import chalk from 'chalk';
import { NormalizedOptions, Options, OutputClient } from '../types';
import { githubResolver } from './github';
import { isString } from './is';
import { mergeDeep } from './mergeDeep';
import { createLogger } from './messages/logs';

export const normalizeOptions = (options: Options) => {
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
      target: inputOptions.target as string,
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
      client: outputOptions.client || OutputClient.AXIOS,
      mode: outputOptions.mode || 'single',
      mock: outputOptions.mock || false,
      override: {
        ...outputOptions.override,
        formData: outputOptions.override?.formData || true,
        requestOptions: outputOptions.override?.requestOptions || true,
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
