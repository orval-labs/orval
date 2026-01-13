import path from 'node:path';

import chalk from 'chalk';
import fs from 'fs-extra';

import type { GeneratorMutator, NormalizedMutator, Tsconfig } from '../types';
import { getFileInfo, pascal, upath } from '../utils';
import { getMutatorInfo } from './mutator-info';

export const BODY_TYPE_NAME = 'BodyType';

const getImport = (output: string, mutator: NormalizedMutator) => {
  const outputFileInfo = getFileInfo(output);
  const mutatorFileInfo = getFileInfo(mutator.path);
  const { pathWithoutExtension } = getFileInfo(
    upath.relativeSafe(outputFileInfo.dirname, mutatorFileInfo.path),
  );

  return `${pathWithoutExtension}${mutator.extension ?? ''}`;
};

interface GenerateMutatorOptions {
  output?: string;
  mutator?: NormalizedMutator;
  name: string;
  workspace: string;
  tsconfig?: Tsconfig;
}

export async function generateMutator({
  output,
  mutator,
  name,
  workspace,
  tsconfig,
}: GenerateMutatorOptions): Promise<GeneratorMutator | undefined> {
  if (!mutator || !output) {
    return;
  }
  const isDefault = mutator.default;
  const importName = mutator.name ?? `${name}Mutator`;
  const importPath = mutator.path;
  const mutatorInfoName = isDefault ? 'default' : mutator.name;

  if (mutatorInfoName === undefined) {
    throw new Error(
      chalk.red(`Mutator ${importPath} must have a named or default export.`),
    );
  }

  let rawFile = await fs.readFile(importPath, 'utf8');
  rawFile = removeComments(rawFile);

  const hasErrorType =
    rawFile.includes('export type ErrorType') ||
    rawFile.includes('export interface ErrorType');

  const hasBodyType =
    rawFile.includes(`export type ${BODY_TYPE_NAME}`) ||
    rawFile.includes(`export interface ${BODY_TYPE_NAME}`);

  const errorTypeName = mutator.default
    ? `${pascal(name)}ErrorType`
    : 'ErrorType';

  const bodyTypeName = mutator.default
    ? `${pascal(name)}${BODY_TYPE_NAME}`
    : BODY_TYPE_NAME;

  const mutatorInfo = await getMutatorInfo(importPath, {
    root: path.resolve(workspace),
    namedExport: mutatorInfoName,
    alias: mutator.alias,
    external: mutator.external,
    tsconfig,
  });

  if (!mutatorInfo) {
    throw new Error(
      chalk.red(
        `Your mutator file doesn't have the ${mutatorInfoName} exported function`,
      ),
    );
  }

  const importStatementPath = getImport(output, mutator);

  const isHook = mutator.name
    ? mutator.name.startsWith('use') && !mutatorInfo.numberOfParams
    : !mutatorInfo.numberOfParams;

  return {
    name: mutator.name || !isHook ? importName : `use${pascal(importName)}`,
    path: importStatementPath,
    default: isDefault,
    hasErrorType,
    errorTypeName,
    hasSecondArg: isHook
      ? (mutatorInfo.returnNumberOfParams ?? 0) > 1
      : mutatorInfo.numberOfParams > 1,
    hasThirdArg: mutatorInfo.numberOfParams > 2,
    isHook,
    ...(hasBodyType ? { bodyTypeName } : {}),
  };
}

function removeComments(file: string) {
  // Regular expression to match single-line and multi-line comments
  const commentRegex = /\/\/.*|\/\*[\s\S]*?\*\//g;

  // Remove comments from the rawFile string
  const cleanedFile = file.replaceAll(commentRegex, '');

  return cleanedFile;
}
