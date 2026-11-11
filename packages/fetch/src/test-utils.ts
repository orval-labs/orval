import ts from 'typescript';

export function typeCheckFiles(
  files: Record<string, string>,
  lib = ['lib.es2022.d.ts'],
) {
  const compilerOptions: ts.CompilerOptions = {
    strict: true,
    exactOptionalPropertyTypes: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib,
    types: [],
  };
  const base = ts.createCompilerHost(compilerOptions);
  const host: ts.CompilerHost = {
    ...base,
    getSourceFile: (fileName, languageVersion, ...rest) =>
      fileName in files
        ? ts.createSourceFile(fileName, files[fileName], languageVersion)
        : base.getSourceFile(fileName, languageVersion, ...rest),
    fileExists: (fileName) => fileName in files || base.fileExists(fileName),
    readFile: (fileName) => files[fileName] ?? base.readFile(fileName),
    directoryExists: (name) =>
      Object.keys(files).some((fileName) => fileName.startsWith(`${name}/`)) ||
      (base.directoryExists?.(name) ?? true),
  };
  const program = ts.createProgram(Object.keys(files), compilerOptions, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}
