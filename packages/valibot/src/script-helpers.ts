import { toScript } from '../../core/src/test-utils/typescript';

// Generated TypeScript as a script `runInNewContext` can run: types removed,
// exports dropped. Throws on a syntax error instead of running repaired code.
export const scriptOf = (code: string) => {
  try {
    return toScript(code);
  } catch (error) {
    throw new Error(
      `Generated code has syntax errors, so it can't run: ${(error as Error).message}\n${code}`,
      { cause: error },
    );
  }
};
