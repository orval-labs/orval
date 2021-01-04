import axios from 'axios';
import { URL_REGEX } from '../../constants';
import { Options } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { getExtension } from '../../utils/extension';
import { getGithubOpenApi } from '../../utils/github';
import { isObject, isString } from '../../utils/is';
import { dynamicReader } from '../../utils/reader';
import { importOpenApi } from './openApi';

export const importSpecs = async (
  workspace: string,
  options: Options,
): Promise<WriteSpecsProps> => {
  const { input, output, converterOptions } = options;

  const path = isString(input) ? input : input?.target;

  if (!path) {
    throw new Error('You need to provide an input');
  }

  if (!output) {
    throw new Error('You need to provide an output');
  }

  const format = getExtension(path);

  let data: string | object;

  if (URL_REGEX.test(path)) {
    if (path.includes('github.com')) {
      data = await getGithubOpenApi(path);
    } else {
      try {
        const call = await axios.get(path);
        if (call.headers['content-type'] !== 'application/json') {
          throw 'Oups... 🍻';
        }
        data = call.data;
      } catch (e) {
        throw 'Oups... 🍻';
      }
    }
  } else {
    data = dynamicReader(path, workspace);
  }

  return importOpenApi({
    workspace,
    data,
    format,
    ...(isObject(input) && {
      input,
    }),
    ...(isObject(output) && {
      output,
    }),
    converterOptions,
  });
};
