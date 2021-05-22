import { join } from 'upath';
import { Mutator } from '../../types';
import { getFileInfo } from '../../utils/file';
import { isString } from '../../utils/is';
import { relativeSafe } from '../../utils/path';

const getImport = (output: string, mutator: Mutator, workspace: string) => {
  const outputFileInfo = getFileInfo(join(workspace, output));
  const mutatorFileInfo = getFileInfo(
    join(workspace, isString(mutator) ? mutator : mutator.path),
  );
  const { pathWithoutExtension } = getFileInfo(
    relativeSafe(outputFileInfo.dirname, mutatorFileInfo.path),
  );

  return pathWithoutExtension;
};

export const generateMutator = ({
  output,
  mutator,
  name,
  workspace,
}: {
  output?: string;
  mutator?: Mutator;
  name: string;
  workspace: string;
}) => {
  if (!mutator || !output) {
    return;
  }
  const isDefault = isString(mutator) ? true : mutator.default || false;
  const importName = isString(mutator) ? `${name}Mutator` : mutator.name;
  const path = getImport(output, mutator, workspace);

  return { name: importName, path, default: isDefault };
};
