/* eslint-disable @typescript-eslint/no-unused-vars */
// Mutator that performs a dynamic import in its body.
// Regression fixture for https://github.com/orval-labs/orval/issues/1634:
// esbuild preserves dynamic `import()` in ESM output even when targeting es6,
// so the bundled code parsed by acorn contains an `import()` expression.
export const customInstance = async <T>(_config: {
  url: string;
}): Promise<T> => {
  const mod = await import('node:os');
  return mod as unknown as T;
};
