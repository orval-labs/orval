import SwaggerParser from '@apidevtools/swagger-parser';
import { resolve } from 'upath';
import { Options } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { githubResolver } from '../../utils/github';
import { isObject, isString } from '../../utils/is';
import { mergeDeep } from '../../utils/mergeDeep';
import isUrl  from 'validator/lib/isURL';
import { importOpenApi } from './openApi';

const resolveSpecs = async (
  path: string,
  parserOptions: SwaggerParser.Options,
  isUrl: boolean,
) => {
  const data = (await SwaggerParser.resolve(path, parserOptions)).values();

  if (isUrl) {
    return data;
  }

  // normalizing slashes after SwaggerParser
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [resolve(key), value]),
  );
};

const parserDefaultOptions = {
  resolve: { github: githubResolver },
} as SwaggerParser.Options;

export const importSpecs = async (
  workspace: string,
  options: Options,
): Promise<WriteSpecsProps> => {
  const { input, output } = options;

  const targetPath = isString(input) ? input : input?.target;

  if (!targetPath) {
    throw new Error('You need to provide an input');
  }

  if (!output) {
    throw new Error('You need to provide an output');
  }

  const isPathUrl = isUrl(targetPath);
  const path = isPathUrl ? targetPath : resolve(workspace, targetPath);

  const parserOptions = isObject(options.input)
    ? mergeDeep(parserDefaultOptions, options.input.parserOptions || {})
    : parserDefaultOptions;

  const data = await resolveSpecs(path, parserOptions, isPathUrl);

  return importOpenApi({
    data,
    ...(isObject(input) && {
      input,
    }),
    ...(isObject(output) && {
      output,
    }),
    path,
    workspace,
  });
};
