import SwaggerParser from '@apidevtools/swagger-parser';
import { resolve } from 'upath';
import isUrl from 'validator/lib/isURL';
import { NormalizedOptions, SwaggerParserOptions } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { isObject } from '../../utils/is';
import { importOpenApi } from './openApi';

const resolveSpecs = async (
  path: string,
  { validate, ...options }: SwaggerParserOptions,
  isUrl: boolean,
) => {
  if (validate) {
    await SwaggerParser.validate(path);
  }
  const data = (await SwaggerParser.resolve(path, options)).values();

  if (isUrl) {
    return data;
  }

  // normalizing slashes after SwaggerParser
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [resolve(key), value]),
  );
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
      path: workspace,
      workspace,
    });
  }

  const isPathUrl = isUrl(input.target);

  const data = await resolveSpecs(input.target, input.parserOptions, isPathUrl);

  return importOpenApi({
    data,
    input,
    output,
    path: input.target,
    workspace,
  });
};
