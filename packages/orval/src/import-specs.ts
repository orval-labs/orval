import SwaggerParser from '@apidevtools/swagger-parser';
import {
  isString,
  isUrl,
  log,
  type NormalizedOptions,
  type SwaggerParserOptions,
  upath,
  type WriteSpecsBuilder,
} from '@orval/core';
import chalk from 'chalk';
import fs from 'fs-extra';
import yaml from 'js-yaml';

import { importOpenApi } from './import-open-api';

const resolveSpecs = async (
  path: string,
  { validate, ...options }: SwaggerParserOptions,
  _isUrl: boolean,
  isOnlySchema: boolean,
) => {
  try {
    if (validate) {
      try {
        await SwaggerParser.validate(path, options);
      } catch (error) {
        if (error instanceof Error && error.name === 'ParserError') {
          throw error;
        }

        if (!isOnlySchema) {
          log(`⚠️  ${chalk.yellow(error)}`);
        }
      }
    }

    const data = (await SwaggerParser.resolve(path, options)).values();

    if (_isUrl) {
      return data;
    }

    // normalizing slashes after SwaggerParser
    return Object.fromEntries(
      Object.entries(data)
        .sort()
        .map(([key, value]) => [isUrl(key) ? key : upath.resolve(key), value]),
    );
  } catch {
    const file = await fs.readFile(path, 'utf8');

    return {
      [path]: yaml.load(file),
    };
  }
};

export const importSpecs = async (
  workspace: string,
  options: NormalizedOptions,
): Promise<WriteSpecsBuilder> => {
  const { input, output } = options;

  if (!isString(input.target)) {
    return importOpenApi({
      data: { [workspace]: input.target },
      input,
      output,
      target: workspace,
      workspace,
    });
  }

  const isPathUrl = isUrl(input.target);

  const data = await resolveSpecs(
    input.target,
    input.parserOptions,
    isPathUrl,
    !output.target,
  );

  return importOpenApi({
    data,
    input,
    output,
    target: input.target,
    workspace,
  });
};
