/* eslint-disable @typescript-eslint/no-unused-vars */
// Regression fixture for https://github.com/orval-labs/orval/issues/3402:
// a named export whose initializer is a CallExpression (factory pattern,
// e.g. `axios.create({...})`). Kept dependency-free so the bundle is
// self-contained.
const make = (cfg: object) => (req: object) => Promise.resolve(req);
export const customInstance = make({});
