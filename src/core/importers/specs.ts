import { resolve } from 'path';
import { Options } from '../../types';
import { WriteSpecsProps } from '../../types/writers';
import { ActionType, useContext } from '../../utils/context';
import { isObject, isString } from '../../utils/is';
import { isUrl } from '../../utils/url';
import { getSpecData } from './data';
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

  const [, dispatch] = useContext();

  const isPathUrl = isUrl(targetPath);
  const path = isPathUrl ? targetPath : resolve(workspace, targetPath);

  const { data, format } = await getSpecData(path);

  dispatch({
    type: ActionType.SET_ROOT_SPEC,
    rootSpec: path,
  });

  return importOpenApi({
    data,
    format,
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
