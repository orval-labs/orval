import { defineConfig } from 'vite-plus';

// All fmt + lint config lives here (Vite+ recommends the config blocks over
// .oxfmtrc.json / .oxlintrc.json).
export default defineConfig({
  fmt: {
    singleQuote: true,
    printWidth: 80,
    sortImports: true,
    ignorePatterns: [
      '**/dist',
      '**/node_modules',
      '**/__snapshots__',
      '**/*.timestamp*',
      'samples',
      'docs',
      'tests/generated',
      '**/*.yaml',
      '**/*.yml',
      'packages/hono/src/zValidator.ts',
      'bun.lock',
    ],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
      reportUnusedDisableDirectives: 'error',
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
      'packages/hono/src/zValidator.ts',
      // MSW's generated worker starts with a blanket eslint-disable.
      '**/mockServiceWorker.js',
      // Committed TypeDoc bundles: minified vendor output, not lintable source.
      'samples/react-app/docs-html/assets',
      'samples/react-app/docs-html-plugin/assets',
      'samples/**/.svelte-kit/**',
      'samples/**/*.test-d.ts',
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
      'eslint/no-empty-function': 'error',
      'eslint/no-new-func': 'error',
      'typescript/no-non-null-assertion': 'error',
      'typescript/no-unnecessary-condition': 'error',
      'typescript/no-unnecessary-type-parameters': 'error',
      'typescript/no-unsafe-argument': 'error',
      'typescript/no-unsafe-assignment': 'error',
      'typescript/no-unsafe-call': 'error',
      'typescript/no-unsafe-member-access': 'error',
      'typescript/no-unsafe-return': 'error',
      'unicorn/new-for-builtins': 'error',
      'unicorn/no-anonymous-default-export': 'error',
      'unicorn/no-array-reduce': 'error',
      'unicorn/prefer-native-coercion-functions': 'error',
      // `disallowTypeAnnotations: false` keeps `typeof import('x')` legal; the
      // test files need it for `vi.importOriginal<typeof import('@orval/core')>()`.
      'typescript/consistent-type-imports': [
        'error',
        { disallowTypeAnnotations: false },
      ],
    },
    overrides: [
      {
        // Samples and generated orval output — relax the rules
        files: ['samples/**', 'tests/generated/**'],
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
          'typescript/no-useless-default-assignment': 'off',
          'typescript/no-floating-promises': 'off',
          'typescript/no-misused-spread': 'off',
          'typescript/unbound-method': 'off',
          // Constraint-only allOf members are emitted as `unknown`, and
          // distinct schema aliases can expand to the same primitive
          // (`NullEnum` is `null`, two id refs are both `number`).
          'typescript/no-redundant-type-constituents': 'off',
          'typescript/no-duplicate-type-constituents': 'off',
          // Generated clients use empty callbacks, `!`, and `reduce`.
          'eslint/no-empty-function': 'off',
          'typescript/no-non-null-assertion': 'off',
          'unicorn/no-anonymous-default-export': 'off',
          'unicorn/no-array-reduce': 'off',
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
