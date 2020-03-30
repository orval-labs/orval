import {URL_REGEX} from '../../constants';
import {Options} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
import {getExtension} from '../../utils/extension';
import {getGithubOpenApi} from '../../utils/github';
import {isObject, isString} from '../../utils/is';
import {dynamicReader} from '../../utils/reader';
import {importOpenApi} from './openApi';

export const importSpecs = async (
  options: Options
): Promise<WriteSpecsProps> => {
  const {input, output} = options;

  const path = isString(input) ? input : input?.target;

  if (!path) {
    throw new Error('You need to provide an input');
  }

  if (!output) {
    throw new Error('You need to provide an output');
  }

  const format = getExtension(path);

  const data = URL_REGEX.test(path)
    ? await getGithubOpenApi(path)
    : dynamicReader(path);

  return importOpenApi({
    data,
    format,
    ...(isObject(input) && {
      input
    }),
    ...(isObject(output) && {
      output
    })
  });
};
