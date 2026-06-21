import path from 'node:path';

import { Parser, type Program } from 'acorn';
import { isArray } from 'remeda';
import { type ExternalOption, rolldown } from 'rolldown';

import type { GeneratorMutatorParsingInfo, Tsconfig } from '../types';

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

  const code = await bundleFile(root, filePath, alias, external);

  return parseFile(code, namedExport);
}

async function bundleFile(
  root: string,
  fileName: string,
  alias?: Record<string, string>,
  external?: string[],
): Promise<string> {
  const bundle = await rolldown({
    cwd: root,
    input: fileName,
    platform: 'node',
    external: getExternalOption(fileName, external, alias),
    resolve: alias ? { alias } : undefined,
    treeshake: false,
    transform: {
      target: 'esnext',
    },
  });

  try {
    const result = await bundle.generate({
      format: 'esm',
      sourcemap: false,
    });
    const chunk = result.output.find((output) => output.type === 'chunk');

    if (!chunk) {
      throw new Error(`Rolldown did not generate a chunk for ${fileName}`);
    }

    return chunk.code;
  } finally {
    await bundle.close();
  }
}

function getExternalOption(
  entry: string,
  external?: string[],
  alias?: Record<string, string>,
): ExternalOption {
  if (external) {
    const matchers = external.map((pattern) => {
      if (isPackagePattern(pattern)) {
        return (id: string) => id === pattern || id.startsWith(`${pattern}/`);
      }

      if (!pattern.includes('*')) {
        return (id: string) => id === pattern;
      }

      const regex = new RegExp(
        `^${pattern.replaceAll(/[$()+./?[\\\]^{|}]/g, String.raw`\$&`).replaceAll('*', '.*')}$`,
      );
      return (id: string) => regex.test(id);
    });

    return (id) => matchers.some((match) => match(id));
  }

  const aliasKeys = Object.keys(alias ?? {});

  return (id, _parentId, isResolved) =>
    !isResolved &&
    id !== entry &&
    !aliasKeys.some((key) => id === key || id.startsWith(`${key}/`));
}

function isPackagePattern(pattern: string): boolean {
  return (
    !pattern.startsWith('.') &&
    !path.isAbsolute(pattern) &&
    !pattern.includes('*')
  );
}

function parseFile(
  file: string,
  name: string,
): GeneratorMutatorParsingInfo | undefined {
  try {
    // `file` is bundled output, not the user's source. The bundler may emit
    // modern syntax, so we parse with the latest ecmaVersion to avoid spurious
    // SyntaxErrors that would mask the export we are looking for.
    // See https://github.com/orval-labs/orval/issues/1634.
    const ast = Parser.parse(file, {
      ecmaVersion: 'latest',
      sourceType: 'module',
    });

    const foundExport = ast.body
      .filter((x) => x.type === 'ExportNamedDeclaration')
      .map((declaration) => ({
        declaration,
        specifier: declaration.specifiers.find(
          (specifier) =>
            specifier.exported.type === 'Identifier' &&
            specifier.exported.name === name &&
            specifier.local.type === 'Identifier',
        ),
      }))
      .find((item) => item.specifier);

    const foundSpecifier = foundExport?.specifier;

    if (foundExport && foundSpecifier && 'name' in foundSpecifier.local) {
      const exportedFuncName = foundSpecifier.local.name;

      const mutatorInfo = parseFunction(ast, exportedFuncName);
      if (mutatorInfo) {
        return mutatorInfo;
      }

      if (
        foundExport.declaration.source ||
        isImportedBinding(ast, exportedFuncName)
      ) {
        return standardMutatorInfo();
      }
    }
  } catch {
    return;
  }
}

function isImportedBinding(ast: Program, name: string): boolean {
  return ast.body.some((node) => {
    if (node.type !== 'ImportDeclaration') {
      return false;
    }

    return node.specifiers.some(
      (specifier) => 'name' in specifier.local && specifier.local.name === name,
    );
  });
}

// Default for mutator exports where arity cannot be inspected:
// factory-pattern CallExpression initializers (e.g. `axios.create({...})`)
// and external re-exports. In both cases, the AST cannot reveal the returned
// callable's arity, so we assume the orval standard contract:
// a single-arg mutator invoked as `customInstance({ url, method, data, ... })`.
// See https://github.com/orval-labs/orval/issues/3402 and
// https://github.com/orval-labs/orval/issues/2342.
function standardMutatorInfo(): GeneratorMutatorParsingInfo {
  return { numberOfParams: 1 };
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

    // Init is a factory CallExpression — see standardMutatorInfo() above.
    if (declaration.init.type === 'CallExpression') {
      return standardMutatorInfo();
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
