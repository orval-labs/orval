import ts from 'typescript';

// Generated TypeScript as a script `runInNewContext` can run: types removed,
// exports dropped. Throws on a syntax error, which TypeScript would repair.
export const scriptOf = (code: string) => {
  const { outputText, diagnostics = [] } = ts.transpileModule(code, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.Preserve,
    },
  });
  if (diagnostics.length > 0) {
    const messages = diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );
    throw new Error(
      `Generated code has syntax errors, so it can't run: ${messages.join('; ')}\n${code}`,
    );
  }
  return outputText.replaceAll(/^export /gm, '');
};
