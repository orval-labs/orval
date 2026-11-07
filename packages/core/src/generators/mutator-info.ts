import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { Parser, type Program } from 'acorn';
import { rolldown } from 'rolldown';

import type { GeneratorMutatorParsingInfo } from '../types';

/**
 * `generateMutator` runs once per operation, and every operation usually shares
 * the same mutator, so without this each one re-bundled the same file (#4222).
 * Holding promises lets concurrent callers share one in-flight bundle.
 */
const mutatorInfoCache = new Map<
  string,
  Promise<GeneratorMutatorParsingInfo | undefined>
>();

export async function getMutatorInfo(
  filePath: string,
  options?: {
    root?: string;
    namedExport?: string;
    alias?: Record<string, string>;
    external?: string[];
  },
): Promise<GeneratorMutatorParsingInfo | undefined> {
  const {
    root = process.cwd(),
    namedExport = 'default',
    alias,
    external,
  } = options ?? {};

  // The default `external: ['*']` keeps every import, relative ones included,
  // out of the bundle, so the entry file is its only input. A custom `external`
  // can inline other files the key below does not track, so it is not cached.
  if (external !== undefined) {
    const code = await bundleFile(root, filePath, alias, external);
    return parseFile(code, namedExport);
  }

  // Keyed on the entry file's contents, so watch mode picks up any edit, even
  // one that leaves its mtime and size unchanged.
  const resolvedPath = path.resolve(root, filePath);
  const key = JSON.stringify([
    root,
    resolvedPath,
    namedExport,
    alias ?? null,
    hashFile(resolvedPath),
  ]);

  let info = mutatorInfoCache.get(key);
  if (!info) {
    info = bundleFile(root, filePath, alias).then((code) =>
      parseFile(code, namedExport),
    );
    mutatorInfoCache.set(key, info);
    // Evict a failed bundle so the next call retries instead of replaying it.
    info.catch(() => mutatorInfoCache.delete(key));
  }

  return info;
}

/** `null` for a missing file, which lets esbuild report the error. */
function hashFile(filePath: string): string | null {
  try {
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
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
): Promise<string> {
  const build = await rolldown({
    cwd: root,
    input: isBareSpecifier(fileName)
      ? fileName
      : path.isAbsolute(fileName)
        ? fileName
        : path.resolve(root, fileName),
    platform: 'node',
    resolve: { alias },
    // Externals arrive as esbuild-style globs (e.g. `*.scss`); rolldown
    // matches exact IDs, so translate `*` → `.*` before testing. A bare
    // package pattern with no wildcard also covers its subpaths, which is what
    // esbuild did: `@scope/pkg` externalises `@scope/pkg/subpath` too.
    external: external
      ? external.map((pattern) => {
          const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
          if (pattern.includes('*')) {
            return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
          }

          return new RegExp(
            `^${escaped}${isBareSpecifier(pattern) ? '(?:/.*)?' : ''}$`,
          );
        })
      : () => true,
  });

  try {
    const { output } = await build.generate({ format: 'esm' });

    // rolldown types `output` as starting with a chunk, so the entry code is
    // always at index 0.
    return output[0].code;
  } finally {
    // rolldown holds native resources until closed; repeated inspections in
    // one process would otherwise leak them. Runs on the throw path too.
    await build.close();
  }
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
      Array.isArray(declaration.init.body.body)
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
