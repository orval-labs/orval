import { defineConfig } from 'vite-plus';

// All fmt + lint config lives here (Vite+ recommends the config blocks over
// .oxfmtrc.json / .oxlintrc.json).
//
// Lint `typeAware`/`typeCheck` are OFF at the config level so the looser default
// works for generated sample code. The `lint` script re-enables them ONLY for
// packages via `vp lint --type-aware --type-check packages` (CLI flags override
// the config). Samples (generated orval output) are linted via `lint:samples`
// with the looser ruleset in the `samples/**` override below.
//
// NOTE: because `samples` is not in the lint `ignorePatterns`, a BARE `vp lint`
// would lint everything WITHOUT type-aware — always use the path-scoped `lint` /
// `lint:samples` scripts (CI and husky are wired accordingly).
export default defineConfig({
  fmt: {
    singleQuote: true,
    printWidth: 80,
    ignorePatterns: [
      '**/dist',
      '**/node_modules',
      '**/__snapshots__',
      '**/*.timestamp*',
      'samples',
      'docs',
      'tests',
      '**/*.yaml',
      '**/*.yml',
      'packages/hono/src/zValidator.ts',
      'bun.lock',
    ],
  },
  lint: {
    options: {
      typeAware: false,
      typeCheck: false,
    },
    plugins: ['oxc', 'typescript', 'unicorn', 'import'],
    categories: {
      correctness: 'error',
    },
    env: {
      builtin: true,
    },
    ignorePatterns: [
      '**/dist',
      '**/__snapshots__',
      '**/.bun',
      '**/*.timestamp*',
      '**/node_modules',
      'docs',
      'tests',
      'packages/hono/src/zValidator.ts',
    ],
    rules: {
      'no-array-constructor': 'error',
      'no-unused-vars': 'error',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-duplicate-enum-values': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-extra-non-null-assertion': 'error',
      'typescript/no-misused-new': 'error',
      'typescript/no-namespace': 'error',
      'typescript/no-non-null-asserted-optional-chain': 'error',
      'typescript/no-require-imports': 'error',
      'typescript/no-this-alias': 'error',
      'typescript/no-unnecessary-type-constraint': 'error',
      'typescript/no-unsafe-declaration-merging': 'error',
      'typescript/no-unsafe-function-type': 'error',
      'typescript/no-wrapper-object-types': 'error',
      'typescript/prefer-as-const': 'error',
      'typescript/prefer-namespace-keyword': 'error',
      'typescript/triple-slash-reference': 'error',
    },
    overrides: [
      {
        // Samples are generated orval output — relax the rules generated code
        // legitimately trips so `lint:samples` stays a useful, looser gate.
        files: ['samples/**'],
        rules: {
          'no-unused-vars': 'off',
          'no-extra-boolean-cast': 'off',
          'typescript/no-explicit-any': 'off',
          'typescript/no-empty-object-type': 'off',
          'typescript/no-unsafe-function-type': 'off',
          'typescript/no-require-imports': 'off',
          'unicorn/no-useless-spread': 'off',
          'unicorn/no-useless-fallback-in-spread': 'off',
        },
      },
    ],
  },
  staged: {
    '*.{ts,tsx,mts,cts,js,mjs,cjs,jsx}': 'vp fmt --write',
  },
});
