import path from 'node:path';

import { type ecmaVersion, Parser, type Program } from 'acorn';
import { build, type BuildOptions } from 'esbuild';
import { isArray } from 'remeda';

import type {
  GeneratorMutatorParsingInfo,
  Tsconfig,
  TsConfigTarget,
} from '../types';

export async function getMutatorInfo(
  filePath: string,
  options?: {
    root?: string;
    namedExport?: string;
    alias?: Record<string, string>;
    external?: string[];
    tsconfig?: Tsconfig;
  },
): Promise<GeneratorMutatorParsingInfo | undefined> {
  const {
    root = process.cwd(),
    namedExport = 'default',
    alias,
    external,
    tsconfig,
  } = options ?? {};

  const code = await bundleFile(
    root,
    path.resolve(filePath),
    alias,
    external,
    tsconfig?.compilerOptions,
  );

  return parseFile(
    code,
    namedExport,
    getEcmaVersion(tsconfig?.compilerOptions?.target),
  );
}

async function bundleFile(
  root: string,
  fileName: string,
  alias?: Record<string, string>,
  external?: string[],
  compilerOptions?: Tsconfig['compilerOptions'],
): Promise<string> {
  const result = await build({
    absWorkingDir: root,
    entryPoints: [fileName],
    write: false,
    platform: 'node',
    bundle: true,
    format: 'esm',
    metafile: false,
    target: compilerOptions?.target ?? 'es6',
    minify: false,
    minifyIdentifiers: false,
    minifySyntax: false,
    minifyWhitespace: false,
    treeShaking: false,
    keepNames: false,
    alias,
    external: external ? ['*', ...external] : ['*'],
  } satisfies BuildOptions);
  const { text } = result.outputFiles[0];

  return text;
}

function parseFile(
  file: string,
  name: string,
  ecmaVersion: ecmaVersion = 6,
): GeneratorMutatorParsingInfo | undefined {
  try {
    const ast = Parser.parse(file, { ecmaVersion, sourceType: 'module' });

    const foundSpecifier = ast.body
      .filter((x) => x.type === 'ExportNamedDeclaration')
      .flatMap((x) => x.specifiers)
      .find(
        (x) =>
          x.exported.type === 'Identifier' &&
          x.exported.name === name &&
          x.local.type === 'Identifier',
      );

    if (foundSpecifier && 'name' in foundSpecifier.local) {
      const exportedFuncName = foundSpecifier.local.name;

      return parseFunction(ast, exportedFuncName);
    }
  } catch {
    return;
  }
}

function parseFunction(
  ast: Program,
  funcName: string,
): GeneratorMutatorParsingInfo | undefined {
  const node = ast.body.find((childNode) => {
    if (childNode.type === 'VariableDeclaration') {
      return childNode.declarations.find(
        (d) => d.id.type === 'Identifier' && d.id.name === funcName,
      );
    }
    if (
      childNode.type === 'FunctionDeclaration' &&
      childNode.id.name === funcName
    ) {
      return childNode;
    }
  });

  if (!node) {
    return;
  }

  if (node.type === 'FunctionDeclaration') {
    const returnStatement = node.body.body.find(
      (b) => b.type === 'ReturnStatement',
    );

    // If the function directly returns an arrow function
    if (returnStatement?.argument && 'params' in returnStatement.argument) {
      return {
        numberOfParams: node.params.length,
        returnNumberOfParams: returnStatement.argument.params.length,
      };
      // If the function returns a CallExpression (e.g., return useCallback(...))
    } else if (returnStatement?.argument?.type === 'CallExpression') {
      const arrowFn = returnStatement.argument.arguments.at(0);
      if (arrowFn?.type === 'ArrowFunctionExpression') {
        return {
          numberOfParams: node.params.length,
          returnNumberOfParams: arrowFn.params.length,
        };
      }
    }
    return {
      numberOfParams: node.params.length,
    };
  }

  const declaration =
    'declarations' in node
      ? node.declarations.find(
          (d) => d.id.type === 'Identifier' && d.id.name === funcName,
        )
      : undefined;

  if (declaration?.init) {
    if ('name' in declaration.init) {
      return parseFunction(ast, declaration.init.name);
    }

    if (
      'body' in declaration.init &&
      'params' in declaration.init &&
      declaration.init.body.type === 'ArrowFunctionExpression'
    ) {
      return {
        numberOfParams: declaration.init.params.length,
        returnNumberOfParams: declaration.init.body.params.length,
      };
    }

    const returnStatement =
      'body' in declaration.init &&
      'body' in declaration.init.body &&
      isArray(declaration.init.body.body)
        ? declaration.init.body.body.find((b) => b.type === 'ReturnStatement')
        : undefined;

    if ('params' in declaration.init) {
      if (returnStatement?.argument && 'params' in returnStatement.argument) {
        return {
          numberOfParams: declaration.init.params.length,
          returnNumberOfParams: returnStatement.argument.params.length,
        };
      } else if (
        returnStatement?.argument?.type === 'CallExpression' &&
        returnStatement.argument.arguments[0]?.type ===
          'ArrowFunctionExpression'
      ) {
        const arrowFn = returnStatement.argument.arguments[0];
        return {
          numberOfParams: declaration.init.params.length,
          returnNumberOfParams: arrowFn.params.length,
        };
      }

      return {
        numberOfParams: declaration.init.params.length,
      };
    }
  }
}

function getEcmaVersion(target?: TsConfigTarget): ecmaVersion | undefined {
  if (!target) {
    return;
  }

  if (target.toLowerCase() === 'esnext') {
    return 'latest';
  }

  try {
    return Number(target.toLowerCase().replace('es', '')) as ecmaVersion;
  } catch {
    return;
  }
}
