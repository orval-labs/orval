import { Mutator } from '../../types';
import { GetterBody } from '../../types/getters';
import { getFileInfo } from '../../utils/file';
import { isString } from '../../utils/is';
import { resolvePath } from '../resolvers/path';

const getImport = (output: string, mutator: Mutator) => {
  const { pathWithoutExtension } = getFileInfo(
    resolvePath(output, isString(mutator) ? mutator : mutator.path),
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
