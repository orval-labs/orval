import { transformSync } from 'esbuild';
import { readFile, unlink, writeFile } from 'fs-extra';
import { join, trimExt } from 'upath';
import { Mutator, MutatorObject } from '../../types';
import { getFileInfo } from '../../utils/file';
import { dynamicImport } from '../../utils/imports';
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

  const { code } = await readFile(importPath).then((value) =>
    transformSync(value.toString('utf8'), { format: 'cjs', loader: 'ts' }),
  );

  const tempFilePath = trimExt(importPath) + '-tmp.js';

  await writeFile(tempFilePath, code);

  const config = await dynamicImport(tempFilePath, process.cwd(), false);

  await unlink(tempFilePath);

  const hasSecondArgument =
    config[isDefault ? 'default' : (mutator as MutatorObject).name]?.length > 1;

  console.log(hasSecondArgument);

  const path = getImport(output, mutator, workspace);

  return { name: importName, path, default: isDefault };
};
