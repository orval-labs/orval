import chalk from 'chalk';
import { join } from 'upath';
import { Mutator, MutatorObject } from '../../types';
import { getFileInfo, loadFile } from '../../utils/file';
import { isString } from '../../utils/is';
import { createLogger } from '../../utils/messages/logs';
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

export const generateMutator = async ({
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
  const importPath = join(
    workspace,
    isString(mutator) ? mutator : mutator.path,
  );

  const { file } = await loadFile<Record<string, Function>>(importPath, {
    isDefault: false,
  });

  const mutatorFn =
    file[isDefault ? 'default' : (mutator as MutatorObject).name];

  if (!mutatorFn) {
    createLogger().error(
      chalk.red(
        `Your mutator file doesn't have the ${
          isDefault ? 'default' : (mutator as MutatorObject).name
        } exported function`,
      ),
    );
    process.exit(1);
  }

  const path = getImport(output, mutator, workspace);

  return { name: importName, path, default: isDefault, mutatorFn };
};
