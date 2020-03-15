/**
 * Return every params in a path
 *
 * @example
 * ```
 * getParamsInPath("/pet/{category}/{name}/");
 * // => ["category", "name"]
 * ```
 * @param path
 */
export const getParamsInPath = (path: string) => {
  let n;
  const output = [];
  const templatePathRegex = /\{(\w+)}/g;
  // tslint:disable-next-line:no-conditional-assignment
  while ((n = templatePathRegex.exec(path)) !== null) {
    output.push(n[1]);
  }

  return output;
};
