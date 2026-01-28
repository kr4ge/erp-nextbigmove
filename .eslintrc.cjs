module.exports = {
  root: true,
  extends: ['@erp/eslint-config'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  ignorePatterns: ['dist', '.turbo', 'node_modules'],
};
