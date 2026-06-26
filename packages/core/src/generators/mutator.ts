import path from 'node:path';
import { styleText } from 'node:util';

import fs from 'fs-extra';

import type { GeneratorMutator, NormalizedMutator, Tsconfig } from '../types';
import { getFileInfo, getImportExtension, pascal, upath } from '../utils';
import { getMutatorInfo } from './mutator-info';

export const BODY_TYPE_NAME = 'BodyType';

const getImport = (
  output: string,
  mutator: NormalizedMutator,
  tsconfig?: Tsconfig,
) => {
  if (mutator.resolvedPath || !path.isAbsolute(mutator.path)) {
    return mutator.path;
  }

  const outputFile = getFileInfo(output).path;
  // When the user hasn't pinned `mutator.extension`, derive it from the
  // mutator file's own extension so NodeNext / Node16 projects get the
  // required `.js` (`.mjs`/`.cjs`/`.jsx`) suffix on the relative import.
  // `path.extname` reads the real extension; `getFileInfo().extension` only
  // echoes its (`.ts`-defaulting) input parameter.
  const ext =
    mutator.extension ??
    getImportExtension(path.extname(mutator.path), tsconfig);
  return `${upath.getRelativeImportPath(outputFile, mutator.path)}${ext}`;
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
  const inspectionPath = mutator.resolvedPath ?? mutator.path;
  const mutatorInfoName = isDefault ? 'default' : mutator.name;

  if (mutatorInfoName === undefined) {
    throw new Error(
      styleText(
        'red',
        `Mutator ${importPath} must have a named or default export.`,
      ),
    );
  }

  let rawFile = path.isAbsolute(inspectionPath)
    ? await fs.readFile(inspectionPath, 'utf8')
    : '';
  rawFile = removeComments(rawFile);

  const hasErrorType =
    !!rawFile &&
    (rawFile.includes('export type ErrorType') ||
      rawFile.includes('export interface ErrorType'));

  const hasBodyType =
    !!rawFile &&
    (rawFile.includes(`export type ${BODY_TYPE_NAME}`) ||
      rawFile.includes(`export interface ${BODY_TYPE_NAME}`));

  const errorTypeName = mutator.default
    ? `${pascal(name)}ErrorType`
    : 'ErrorType';

  const bodyTypeName = mutator.default
    ? `${pascal(name)}${BODY_TYPE_NAME}`
    : BODY_TYPE_NAME;

  const mutatorInfo = await getMutatorInfo(inspectionPath, {
    root: workspace,
    namedExport: mutatorInfoName,
    alias: mutator.alias,
    external: mutator.external,
    tsconfig,
  });

  if (!mutatorInfo) {
    throw new Error(
      styleText(
        'red',
        `Your mutator file doesn't have the ${mutatorInfoName} exported function`,
      ),
    );
  }

  const importStatementPath = getImport(output, mutator, tsconfig);

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
