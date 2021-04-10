import { relative } from 'upath';
import { Mutator } from '../../types';
import { GetterBody } from '../../types/getters';
import { getFileInfo } from '../../utils/file';
import { isString } from '../../utils/is';

const getImport = (output: string, mutator: Mutator) => {
  const outputFileInfo = getFileInfo(output);
  const mutatorFileInfo = getFileInfo(
    isString(mutator) ? mutator : mutator.path,
  );
  const { pathWithoutExtension } = getFileInfo(
    relative(outputFileInfo.dirname, mutatorFileInfo.path),
  );
  return pathWithoutExtension;
};

export const generateMutator = ({
  output,
  body,
  mutator,
  name,
}: {
  output?: string;
  body: GetterBody;
  mutator?: Mutator;
  name: string;
}) => {
  if (!mutator || !output) {
    return;
  }
  const isDefault = isString(mutator) ? true : mutator.default || false;
  const importName = isString(mutator) ? `${name}Mutator` : mutator.name;
  const path = getImport(output, mutator);

  return { name: importName, path, default: isDefault };
};
