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

import { importOpenApi } from './import-open-api';

const resolveSpecs = async (
  path: string,
  { validate, ...options }: SwaggerParserOptions,
  isUrl: boolean,
) => {
  if (validate) {
    try {
      await SwaggerParser.validate(path, options);
    } catch (e: any) {
      if (e?.name === 'ParserError') {
        throw e;
      }
      log(`⚠️  ${chalk.yellow(e)}`);
    }
  }

  const data = (await SwaggerParser.resolve(path, options)).values();

  if (isUrl) {
    return data;
  }

  // normalizing slashes after SwaggerParser
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [upath.resolve(key), value]),
  );
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

  const data = await resolveSpecs(input.target, input.parserOptions, isPathUrl);

  return importOpenApi({
    data,
    input,
    output,
    target: input.target,
    workspace,
  });
};
