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
// `lint:samples` scripts (CI and git hooks are wired accordingly).
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
      'packages/**/__snapshots__',
      'samples/**/__snapshots__',
      '**/.bun',
      '**/*.timestamp*',
      '**/node_modules',
      'docs',
      // Everything under `tests` is ignored except the committed generated
      // output, which `lint:snapshots` lints. Gitignore semantics: a negation
      // can only re-include a child of a directory whose *children* are
      // ignored, hence `tests/*` rather than `tests`.
      'tests/*',
      '!tests/__snapshots__',
      'packages/hono/src/zValidator.ts',
      // Committed TypeDoc bundles: minified vendor output, not lintable source.
      'samples/react-app/docs-html/assets',
      'samples/react-app/docs-html-plugin/assets',
    ],
    rules: {
      'eslint/no-array-constructor': 'error',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-namespace': 'error',
      'typescript/no-require-imports': 'error',
      'typescript/no-unnecessary-type-constraint': 'error',
      'typescript/no-unsafe-function-type': 'error',
      // `disallowTypeAnnotations: false` keeps `typeof import('x')` legal; the
      // test files need it for `vi.importOriginal<typeof import('@orval/core')>()`.
      'typescript/consistent-type-imports': [
        'error',
        { disallowTypeAnnotations: false },
      ],
    },
    overrides: [
      {
        // Samples and snapshots are generated orval output — relax the rules
        // generated code legitimately trips so `lint:samples` and
        // `lint:snapshots` stay useful, looser gates.
        files: ['samples/**', 'tests/__snapshots__/**'],
        rules: {
          'eslint/no-unused-vars': 'off',
          'eslint/no-extra-boolean-cast': 'off',
          'typescript/no-explicit-any': 'off',
          'typescript/no-empty-object-type': 'off',
          'typescript/no-unsafe-function-type': 'off',
          'typescript/no-require-imports': 'off',
          'unicorn/no-useless-spread': 'off',
          'unicorn/no-useless-fallback-in-spread': 'off',
          // Generators emit empty files on purpose (e.g. a client with no
          // operations for a tag).
          'unicorn/no-empty-file': 'off',
          // Generated output must not trip a consumer's linter. Stays `warn`
          // until every generator emits `import type` for type-only imports
          // (tracked per generator from #3931); then it flips to `error`
          // and this entry goes away.
          'typescript/consistent-type-imports': [
            'warn',
            { disallowTypeAnnotations: false },
          ],
        },
      },
    ],
  },
  staged: {
    '*.{ts,tsx,mts,cts,js,mjs,cjs,jsx}':
      'vp fmt --write --no-error-on-unmatched-pattern',
  },
  test: {
    projects: ['packages/*/vite.config.ts'],
  },
});
