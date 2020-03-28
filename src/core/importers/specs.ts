import {URL_REGEX} from '../../constants';
import {Options} from '../../types';
import {WriteSpecsProps} from '../../types/writers';
import {getExtension} from '../../utils/extension';
import {getGithubOpenApi} from '../../utils/github';
import {dynamicReader} from '../../utils/reader';
import {importOpenApi} from './openApi';

export const importSpecs = async (
  options: Options
): Promise<WriteSpecsProps> => {
  const {input, output} = options;

  const path = typeof input === 'string' ? input : input?.target;

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
    ...(typeof input === 'object' && {
      input
    }),
    ...(typeof output === 'object' && {
      output
    })
  });
};
