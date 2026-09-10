import path from 'node:path';

import { Parser, type Program } from 'acorn';
import { isArray } from 'remeda';
import { rolldown } from 'rolldown';

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

  const code = await bundleFile(
    root,
    filePath,
    alias,
    external,
    tsconfig?.compilerOptions,
  );

  return parseFile(code, namedExport);
}

/**
 * True for node-style bare specifiers (`@scope/pkg`, `pkg`, `pkg/sub`)
 * that must reach rolldown untouched so node_modules resolution applies.
 */
function isBareSpecifier(value: string): boolean {
  return (
    !!value &&
    value.trim() === value &&
    !value.startsWith('.') &&
    !value.startsWith('/') &&
    !value.startsWith('\\\\') &&
    !path.isAbsolute(value) &&
    !/^[A-Za-z]:[\\/]/.test(value)
  );
}

async function bundleFile(
  root: string,
  fileName: string,
  alias?: Record<string, string>,
  external?: string[],
  _compilerOptions?: Tsconfig['compilerOptions'],
): Promise<string> {
  const build = await rolldown({
    cwd: root,
    // Rolldown cannot resolve *relative* entry paths the way esbuild did;
    // resolve them against `root` up front.  Bare package specifiers
    // (`@foo/bar`, `pkg`) must pass through untouched so node resolution
    // can find them from `cwd`.
    input: isBareSpecifier(fileName)
      ? fileName
      : path.isAbsolute(fileName)
        ? fileName
        : path.resolve(root, fileName),
    platform: 'node',
    resolve: { alias },
    // Externals arrive as esbuild-style globs (e.g. `*.scss`); rolldown
    // matches exact IDs, so translate `*` → `.*` before testing.
    external: external
      ? external.map((pattern) => {
          const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
        })
      : () => true,
  });
  const { output } = await build.generate({ format: 'esm' });
  const first = output[0];

  return first.type === 'chunk' ? first.code : '';
}

function parseFile(
  file: string,
  name: string,
): GeneratorMutatorParsingInfo | undefined {
  try {
    // `file` is the bundler's output, not the user's source. The bundler may
    // emit any modern syntax (notably dynamic `import()`, which it preserves
    // even when targeting es6 in ESM mode), so we parse with the latest
    // ecmaVersion to avoid spurious SyntaxErrors that would mask the export
    // we are looking for. See https://github.com/orval-labs/orval/issues/1634.
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
