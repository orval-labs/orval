// Regression fixture for https://github.com/orval-labs/orval/issues/2342:
// the configured mutator file can re-export the named mutator from an
// external package.
// @ts-expect-error External package is intentionally unresolved in this fixture.
export { customInstance } from '@orval-external/custom-instance';
