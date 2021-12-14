import chalk from 'chalk';
import { readFile } from 'fs-extra';
import { GeneratorMutator } from '../..';
import { NormalizedMutator, Tsconfig } from '../../types';
import { pascal } from '../../utils/case';
import { getFileInfo, loadFile } from '../../utils/file';
import { createLogger } from '../../utils/messages/logs';
import { relativeSafe } from '../../utils/path';

const getImport = (output: string, mutator: NormalizedMutator) => {
  const outputFileInfo = getFileInfo(output);
  const mutatorFileInfo = getFileInfo(mutator.path);
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
  tsconfig,
}: {
  output?: string;
  mutator?: NormalizedMutator;
  name: string;
  workspace: string;
  tsconfig?: Tsconfig;
}): Promise<GeneratorMutator | undefined> => {
  if (!mutator || !output) {
    return;
  }
  const isDefault = mutator.default;
  const importName = mutator.name ? mutator.name : `${name}Mutator`;
  const importPath = mutator.path;

  const rawFile = await readFile(importPath, 'utf8');

  const hasErrorType =
    rawFile.includes('export type ErrorType') ||
    rawFile.includes('export interface ErrorType');

  const errorTypeName = !mutator.default
    ? 'ErrorType'
    : `${pascal(name)}ErrorType`;

  const { file, cached } = await loadFile<Record<string, Function>>(
    importPath,
    {
      isDefault: false,
      root: workspace,
      alias: mutator.alias,
      tsconfig,
    },
  );

  if (file) {
    const mutatorFn =
      file[mutator.default || !mutator.name ? 'default' : mutator.name];

    if (!mutatorFn) {
      createLogger().error(
        chalk.red(
          `Your mutator file doesn't have the ${
            mutator.default ? 'default' : mutator.name
          } exported function`,
        ),
      );
      process.exit(1);
    }

    const path = getImport(output, mutator);

    return {
      name: importName,
      path,
      default: isDefault,
      mutatorFn,
      hasErrorType,
      errorTypeName,
    };
  } else {
    const path = getImport(output, mutator);

    if (!cached) {
      createLogger().warn(
        chalk.yellow(
          `Your mutator cannot be loaded so default setup has been applied => ${importPath}`,
        ),
      );
    }

    return {
      name: importName,
      path,
      default: isDefault,
      mutatorFn: () => undefined,
      hasErrorType,
      errorTypeName,
    };
  }
};
