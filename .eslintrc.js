module.exports = {
  root: true,
  extends: ['prettier', 'turbo'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      modules: true,
    },
  },
  rules: {
    'turbo/no-undeclared-env-vars': 'off',
  },
};
