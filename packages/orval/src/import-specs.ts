import SwaggerParser from '@apidevtools/swagger-parser';
import {
  isObject,
  isUrl,
  log,
  NormalizedOptions,
  upath,
  SwaggerParserOptions,
  WriteSpecsBuilder,
} from '@orval/core';
import chalk from 'chalk';
import yaml from 'js-yaml';
import fs from 'fs-extra';

import { importOpenApi } from './import-open-api';

const resolveSpecs = async (
  path: string,
  { validate, ...options }: SwaggerParserOptions,
  isUrl: boolean,
  isOnlySchema: boolean,
) => {
  try {
    if (validate) {
      try {
        await SwaggerParser.validate(path, options);
      } catch (e: any) {
        if (e?.name === 'ParserError') {
          throw e;
        }

        if (!isOnlySchema) {
          log(`⚠️  ${chalk.yellow(e)}`);
        }
      }
    }

    const data = await SwaggerParser.dereference(path, options);
    return { [path]: data };
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

  if (isObject(input.target)) {
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
