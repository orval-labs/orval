import { Mutator } from '../../types';
import { GetterBody } from '../../types/getters';
import { getFileInfo } from '../../utils/file';
import { isString } from '../../utils/is';
import { resolvePath } from '../resolvers/path';

const getImport = (workspace: string, mutator: Mutator) => {
  const { pathWithoutExtension } = getFileInfo(
    resolvePath(workspace, isString(mutator) ? mutator : mutator.path),
  );

  return pathWithoutExtension;
};

export const generateMutator = ({
  workspace,
  body,
  mutator,
  name,
}: {
  workspace: string;
  body: GetterBody;
  mutator?: Mutator;
  name: string;
}) => {
  if (!mutator) {
    return;
  }
  const isDefault = isString(mutator) ? true : mutator.default || false;
  const importName = isString(mutator) ? `${name}Mutator` : mutator.name;
  const path = getImport(workspace, mutator);

  return { name: importName, path, default: isDefault };
};
