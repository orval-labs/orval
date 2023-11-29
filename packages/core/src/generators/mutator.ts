import acorn, { Parser } from 'acorn';
import chalk from 'chalk';
import fs from 'fs-extra';
import {
  GeneratorMutator,
  GeneratorMutatorParsingInfo,
  NormalizedMutator,
  Tsconfig,
  TsConfigTarget,
} from '../types';
import { createLogger, getFileInfo, loadFile, pascal, upath } from '../utils';

export const BODY_TYPE_NAME = 'BodyType';

const getImport = (output: string, mutator: NormalizedMutator) => {
  const outputFileInfo = getFileInfo(output);
  const mutatorFileInfo = getFileInfo(mutator.path);
  const { pathWithoutExtension } = getFileInfo(
    upath.relativeSafe(outputFileInfo.dirname, mutatorFileInfo.path),
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

  let rawFile = await fs.readFile(importPath, 'utf8');

  rawFile = removeComments(rawFile);

  const hasErrorType =
    rawFile.includes('export type ErrorType') ||
    rawFile.includes('export interface ErrorType');

  const hasBodyType =
    rawFile.includes(`export type ${BODY_TYPE_NAME}`) ||
    rawFile.includes(`export interface ${BODY_TYPE_NAME}`);

  const errorTypeName = !mutator.default
    ? 'ErrorType'
    : `${pascal(name)}ErrorType`;

  const bodyTypeName = !mutator.default
    ? BODY_TYPE_NAME
    : `${pascal(name)}${BODY_TYPE_NAME}`;

  const { file, cached } = await loadFile<string>(importPath, {
    isDefault: false,
    root: workspace,
    alias: mutator.alias,
    tsconfig,
    load: false,
  });

  if (file) {
    const mutatorInfoName = isDefault ? 'default' : mutator.name!;

    const mutatorInfo = parseFile(
      file,
      mutatorInfoName,
      getEcmaVersion(tsconfig?.compilerOptions?.target),
    );

    if (!mutatorInfo) {
      createLogger().error(
        chalk.red(
          `Your mutator file doesn't have the ${mutatorInfoName} exported function`,
        ),
      );
      process.exit(1);
    }

    const path = getImport(output, mutator);

    const isHook = mutator.name
      ? !!mutator.name.startsWith('use') && !mutatorInfo.numberOfParams
      : !mutatorInfo.numberOfParams;

    return {
      name: mutator.name || !isHook ? importName : `use${pascal(importName)}`,
      path,
      default: isDefault,
      hasErrorType,
      errorTypeName,
      hasSecondArg: !isHook
        ? mutatorInfo.numberOfParams > 1
        : mutatorInfo.returnNumberOfParams! > 1,
      hasThirdArg: mutatorInfo.numberOfParams > 2,
      isHook,
      ...(hasBodyType ? { bodyTypeName } : {}),
    };
  } else {
    const path = getImport(output, mutator);

    if (!cached) {
      createLogger().warn(
        chalk.yellow(`Failed to parse provided mutator function`),
      );
    }

    return {
      name: importName,
      path,
      default: isDefault,
      hasSecondArg: false,
      hasThirdArg: false,
      isHook: false,
      hasErrorType,
      errorTypeName,
      ...(hasBodyType ? { bodyTypeName } : {}),
    };
  }
};

const getEcmaVersion = (
  target?: TsConfigTarget,
): acorn.ecmaVersion | undefined => {
  if (!target) {
    return;
  }

  if (target.toLowerCase() === 'esnext') {
    return 'latest';
  }

  try {
    return Number(target.toLowerCase().replace('es', '')) as acorn.ecmaVersion;
  } catch {
    return;
  }
};

const removeComments = (file: string) => {
  // Regular expression to match single-line and multi-line comments
  const commentRegex = /\/\/.*|\/\*[\s\S]*?\*\//g;

  // Remove comments from the rawFile string
  const cleanedFile = file.replace(commentRegex, '');

  return cleanedFile;
};

const parseFile = (
  file: string,
  name: string,
  ecmaVersion: acorn.ecmaVersion = 6,
): GeneratorMutatorParsingInfo | undefined => {
  try {
    const ast = Parser.parse(file, { ecmaVersion }) as any;

    const node = ast?.body?.find((childNode: any) => {
      if (childNode.type === 'ExpressionStatement') {
        if (
          childNode.expression.arguments?.[1]?.properties?.some(
            (p: any) => p.key?.name === name,
          )
        ) {
          return true;
        }

        if (childNode.expression.left?.property?.name === name) {
          return true;
        }

        return childNode.expression.right?.properties?.some(
          (p: any) => p.key.name === name,
        );
      }
    });

    if (!node) {
      return;
    }

    if (node.expression.type === 'AssignmentExpression') {
      if (
        node.expression.right.type === 'FunctionExpression' ||
        node.expression.right.type === 'ArrowFunctionExpression'
      ) {
        return {
          numberOfParams: node.expression.right.params.length,
        };
      }

      if (node.expression.right.name) {
        return parseFunction(ast, node.expression.right.name);
      }

      const property = node.expression.right?.properties.find(
        (p: any) => p.key.name === name,
      );

      if (property.value.name) {
        return parseFunction(ast, property.value.name);
      }

      if (
        property.value.type === 'FunctionExpression' ||
        property.value.type === 'ArrowFunctionExpression'
      ) {
        return {
          numberOfParams: property.value.params.length,
        };
      }

      return;
    }

    const property = node.expression.arguments[1].properties.find(
      (p: any) => p.key?.name === name,
    );

    return parseFunction(ast, property.value.body.name);
  } catch (e) {
    return;
  }
};

const parseFunction = (
  ast: any,
  name: string,
): GeneratorMutatorParsingInfo | undefined => {
  const node = ast?.body?.find((childNode: any) => {
    if (childNode.type === 'VariableDeclaration') {
      return childNode.declarations.find((d: any) => d.id.name === name);
    }
    if (
      childNode.type === 'FunctionDeclaration' &&
      childNode.id.name === name
    ) {
      return childNode;
    }
  });

  if (!node) {
    return;
  }

  if (node.type === 'FunctionDeclaration') {
    const returnStatement = node.body?.body?.find(
      (b: any) => b.type === 'ReturnStatement',
    );

    if (returnStatement?.argument?.params) {
      return {
        numberOfParams: node.params.length,
        returnNumberOfParams: returnStatement.argument.params.length,
      };
    }
    return {
      numberOfParams: node.params.length,
    };
  }

  const declaration = node.declarations.find((d: any) => d.id.name === name);

  if (declaration.init.name) {
    return parseFunction(ast, declaration.init.name);
  }

  if (declaration.init.body.type === 'ArrowFunctionExpression') {
    return {
      numberOfParams: declaration.init.params.length,
      returnNumberOfParams: declaration.init.body.params.length,
    };
  }

  const returnStatement = declaration.init.body?.body?.find(
    (b: any) => b.type === 'ReturnStatement',
  );

  if (returnStatement?.argument?.params) {
    return {
      numberOfParams: declaration.init.params.length,
      returnNumberOfParams: returnStatement.argument.params.length,
    };
  }

  return {
    numberOfParams: declaration.init.params.length,
  };
};
