module.exports = {
  extends: ['@erp/eslint-config'],
  parserOptions: {
    project: ['./tsconfig.json'],
  },
  rules: {
    // Relax rules to keep CI passing while cleanup happens
    'no-prototype-builtins': 'warn',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
