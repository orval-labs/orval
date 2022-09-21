import SwaggerParser from '@apidevtools/swagger-parser';
import chalk from 'chalk';
import { log } from 'console';
import { NormalizedOptions, SwaggerParserOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { isObject } from '../../utils/is';
import { importOpenApi } from './openApi';

const resolveSpecs = async (
  path: string,
  { validate, ...options }: SwaggerParserOptions,
) => {
  if (validate) {
    try {
      await SwaggerParser.validate(path);
    } catch (e: any) {
      if (e?.name === 'ParserError') {
        throw e;
      }
      log(`⚠️  ${chalk.yellow(e)}`);
    }
  }

  const data = await SwaggerParser.bundle(path, options);

  return { [path]: data };
};

export const importSpecs = async (
  workspace: string,
  options: NormalizedOptions,
): Promise<WriteSpecsProps> => {
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

  const data = await resolveSpecs(input.target, input.parserOptions);

  return importOpenApi({
    data,
    input,
    output,
    target: input.target,
    workspace,
  });
};
