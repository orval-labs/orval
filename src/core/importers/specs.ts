import SwaggerParser from '@apidevtools/swagger-parser';
import { resolve } from 'path';
import { Options } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { githubResolver } from '../../utils/github';
import { isObject, isString } from '../../utils/is';
import { isUrl } from '../../utils/url';
import { importOpenApi } from './openApi';

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

  const data = (
    await SwaggerParser.resolve(path, {
      resolve: { github: githubResolver },
    } as SwaggerParser.Options)
  ).values();

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
