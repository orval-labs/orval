/* eslint-disable @typescript-eslint/no-unused-vars */
// Regression fixture for https://github.com/orval-labs/orval/issues/3402:
// a default export whose initializer is a CallExpression. Bundled output can
// lower `export default <expr>` into a variable declarator + named-export
// specifier, so this exercises the same code path as the named-export variant.
const make = (cfg: object) => (req: object) => Promise.resolve(req);
export default make({});
