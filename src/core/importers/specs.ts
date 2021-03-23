import axios from 'axios';
import { URL_REGEX } from '../../constants';
import { Options } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { getExtension } from '../../utils/extension';
import { getGithubOpenApi } from '../../utils/github';
import { isObject, isString } from '../../utils/is';
import { dynamicReader } from '../../utils/reader';
import { importOpenApi } from './openApi';
import { ImportOpenApi } from '../../types';

export const importSpecs = async (
  workspace: string,
  options: Options,
): Promise<WriteSpecsProps> => {
  const { input, output } = options;

  const path = isString(input) ? input : input?.target;

  if (!path) {
    throw new Error('You need to provide an input');
  }

  if (!output) {
    throw new Error('You need to provide an output');
  }

  let format: ImportOpenApi['format'] = getExtension(path);

  let data: string | object;

  if (URL_REGEX.test(path)) {
    if (path.includes('github.com')) {
      data = await getGithubOpenApi(path);
    } else {
      try {
        const { headers, data: specification } = await axios.get(path);
        const isContentTypeYaml = headers['content-type'].includes('text/yaml');
        const isContentTypeTextPlain = headers['content-type'].includes(
          'text/plain',
        );
        const isContentTypeJson = headers['content-type'].includes(
          'application/json',
        );

        if (isContentTypeJson || isContentTypeYaml || isContentTypeTextPlain) {
          data = specification;
          if (isContentTypeJson) {
            format = 'json';
          }
          if (isContentTypeYaml) {
            format = 'yaml';
          }
          if (isContentTypeTextPlain && typeof data === 'string') {
            format = data.startsWith('{') ? 'json' : 'yaml';
          }
        } else {
          throw 'Oups... 🍻. Unsupported content type';
        }
      } catch (error) {
        throw isString(error) ? error : 'Oups... 🍻';
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
  });
};
