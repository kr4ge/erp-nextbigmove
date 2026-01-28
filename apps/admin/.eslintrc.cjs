module.exports = {
  extends: ['next/core-web-vitals', '@erp/eslint-config'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
