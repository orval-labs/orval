import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  type Declaration,
  type ModuleExportName,
  type ParseResult,
  parseSync,
} from 'oxc-parser';

/**
 * Test helpers for compiling and inspecting generated TypeScript without the
 * TypeScript compiler API, which the `typescript` package no longer exposes as
 * of TypeScript 7.
 */

/**
 * Turns generated TypeScript into a script that `vm` can run: types are
 * removed, and `export` keywords are dropped so the declarations are in scope.
 * Throws a `SyntaxError` when the source does not parse.
 */
export const toScript = (source: string): string =>
  stripTypeScriptTypes(source, { mode: 'transform' }).replaceAll(
    /^export (default )?/gm,
    '',
  );

const declaredNames = (declaration: Declaration): string[] => {
  if (declaration.type === 'VariableDeclaration') {
    return declaration.declarations.flatMap((declarator) =>
      declarator.id.type === 'Identifier' ? [declarator.id.name] : [],
    );
  }
  return 'id' in declaration && declaration.id?.type === 'Identifier'
    ? [declaration.id.name]
    : [];
};

const exportName = (name: ModuleExportName): string =>
  name.type === 'Literal' ? name.value : name.name;

/**
 * Turns generated TypeScript into a CommonJS script, as a CommonJS build of the
 * module would run: types are removed, imports read from a `require` function,
 * and exports are assigned to an `exports` object the script is given.
 * Throws a `SyntaxError` when the source does not parse.
 */
export const toCommonJsScript = (source: string): string => {
  const javascript = stripTypeScriptTypes(source, { mode: 'transform' });
  const { program, comments, errors } = parseSync('module.js', javascript, {
    lang: 'js',
    sourceType: 'module',
  });
  if (errors.length > 0) throw new SyntaxError(errors[0].message);

  const edits: { start: number; end: number; text: string }[] = [];
  const exported: string[] = [];
  for (const statement of program.body) {
    switch (statement.type) {
      case 'ImportDeclaration': {
        const required = `require(${JSON.stringify(statement.source.value)})`;
        const named: string[] = [];
        const lines: string[] = [];
        for (const specifier of statement.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') {
            lines.push(`const ${specifier.local.name} = ${required};`);
          } else if (specifier.type === 'ImportDefaultSpecifier') {
            lines.push(`const ${specifier.local.name} = ${required}.default;`);
          } else {
            named.push(
              `${JSON.stringify(exportName(specifier.imported))}: ${specifier.local.name}`,
            );
          }
        }
        if (named.length > 0) {
          lines.push(`const { ${named.join(', ')} } = ${required};`);
        }
        // `import 'x'` runs the module; an import left empty by removing its
        // type-only names is dropped, as the TypeScript compiler drops it.
        // Only a `{` outside comments opens a named-import clause.
        const clause = javascript.slice(
          statement.start,
          statement.source.start,
        );
        const isSideEffectImport = !comments
          .filter(
            ({ start, end }) =>
              start >= statement.start && end <= statement.source.start,
          )
          .reduce(
            (text, { start, end }) =>
              text.slice(0, start - statement.start) +
              ' '.repeat(end - start) +
              text.slice(end - statement.start),
            clause,
          )
          .includes('{');
        if (statement.specifiers.length === 0 && isSideEffectImport) {
          lines.push(`${required};`);
        }
        edits.push({ ...statement, text: lines.join(' ') });
        break;
      }
      case 'ExportNamedDeclaration': {
        if (statement.source) {
          throw new SyntaxError('Re-exports are not supported');
        }
        if (statement.declaration) {
          edits.push({
            start: statement.start,
            end: statement.declaration.start,
            text: '',
          });
          exported.push(...declaredNames(statement.declaration));
        } else {
          edits.push({ ...statement, text: '' });
          for (const specifier of statement.specifiers) {
            exported.push(
              `${JSON.stringify(exportName(specifier.exported))}: ${exportName(specifier.local)}`,
            );
          }
        }
        break;
      }
      case 'ExportDefaultDeclaration': {
        const { declaration } = statement;
        const name =
          'id' in declaration && declaration.id?.type === 'Identifier'
            ? declaration.id.name
            : undefined;
        if (name) {
          edits.push({
            start: statement.start,
            end: declaration.start,
            text: '',
          });
          exported.push(`default: ${name}`);
        } else {
          edits.push({
            start: statement.start,
            end: declaration.start,
            text: 'exports.default = ',
          });
        }
        break;
      }
      case 'ExportAllDeclaration': {
        throw new SyntaxError('Re-exports are not supported');
      }
    }
  }

  let script = javascript;
  for (const { start, end, text } of edits.toSorted(
    (a, b) => b.start - a.start,
  )) {
    script = script.slice(0, start) + text + script.slice(end);
  }
  return exported.length > 0
    ? `${script}\nObject.assign(exports, { ${exported.join(', ')} });`
    : script;
};

/** Parses TypeScript source into an ESTree-compatible AST. */
export const parseTypeScript = (
  source: string,
  { jsx = false }: { jsx?: boolean } = {},
): ParseResult =>
  parseSync(jsx ? 'source.tsx' : 'source.ts', source, {
    lang: jsx ? 'tsx' : 'ts',
    sourceType: 'module',
  });

const require = createRequire(import.meta.url);

const tscPath = (): string => {
  const packageJsonPath = require.resolve('typescript/package.json');
  const { bin } = require(packageJsonPath) as { bin: { tsc: string } };
  return path.join(path.dirname(packageJsonPath), bin.tsc);
};

/**
 * Parses `tsc --pretty false` output into one message per diagnostic, with the
 * lines of a chained message joined by `\n`.
 */
export interface TypeCheckDiagnostic {
  message: string;
  /** The file the diagnostic is in, absent for global diagnostics. */
  file?: string;
  /** 1-based line of the diagnostic within `file`. */
  line?: number;
}

const parseDiagnostics = (output: string): TypeCheckDiagnostic[] => {
  const diagnostics: TypeCheckDiagnostic[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = /^(?:(.+)\((\d+),\d+\): )?error TS\d+: (.*)$/.exec(line);
    const last = diagnostics.at(-1);
    if (match) {
      // The location group is optional: global diagnostics have none.
      const [, file, lineNumber, message] = match as unknown as [
        string,
        string | undefined,
        string | undefined,
        string,
      ];
      diagnostics.push({
        message,
        ...(file === undefined ? {} : { file, line: Number(lineNumber) }),
      });
    } else if (/^\s+\S/.test(line) && last) {
      last.message += `\n${line.trim()}`;
    }
  }
  return diagnostics;
};

export interface TypeCheckOptions {
  /** Compiler options as they would appear in `tsconfig.json`. */
  compilerOptions: Record<string, unknown>;
  /**
   * The directory the files and the tsconfig are written to. Defaults to a
   * fresh temporary directory that is removed afterwards.
   */
  cwd?: string;
  /**
   * Where to create the temporary directory when there is no `cwd`, so that
   * imports resolve from there. Defaults to the system temporary directory.
   */
  tempParent?: string;
}

/**
 * Type-checks files with the `tsc` command and returns its diagnostics.
 * `files` maps paths, relative to `cwd`, to their content; files that already
 * exist on disk can be listed with `undefined` content.
 */
export const typeCheckDiagnostics = (
  files: Record<string, string | undefined>,
  { compilerOptions, cwd, tempParent = tmpdir() }: TypeCheckOptions,
): TypeCheckDiagnostic[] => {
  const dir = cwd ?? mkdtempSync(path.join(tempParent, '.orval-typecheck-'));
  const tsconfigPath = path.join(dir, `tsconfig.orval-typecheck.json`);
  try {
    for (const [name, content] of Object.entries(files)) {
      if (content === undefined) continue;
      const filePath = path.join(dir, name);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, content);
    }
    writeFileSync(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: { ...compilerOptions, noEmit: true },
        files: Object.keys(files).map((name) => path.join(dir, name)),
      }),
    );
    try {
      execFileSync(
        process.execPath,
        [tscPath(), '--project', tsconfigPath, '--pretty', 'false'],
        { encoding: 'utf8', stdio: 'pipe' },
      );
      return [];
    } catch (error) {
      const { stdout = '', stderr = '' } = error as {
        stdout?: string;
        stderr?: string;
      };
      const diagnostics = parseDiagnostics(`${stdout}\n${stderr}`);
      if (diagnostics.length === 0) throw error;
      return diagnostics;
    }
  } finally {
    if (cwd === undefined) {
      rmSync(dir, { recursive: true, force: true });
    } else {
      rmSync(tsconfigPath, { force: true });
    }
  }
};

/** {@link typeCheckDiagnostics}, reduced to the diagnostic messages. */
export const typeCheck = (
  files: Record<string, string | undefined>,
  options: TypeCheckOptions,
): string[] =>
  typeCheckDiagnostics(files, options).map(({ message }) => message);
