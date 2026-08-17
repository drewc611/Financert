module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react'],
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react/jsx-runtime'],
  ignorePatterns: ['dist', 'node_modules', 'src/lib/fallbackData.js'],
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // No TypeScript and no prop-types dependency here, so this rule can only
    // ask for runtime type declarations the project deliberately omits.
    'react/prop-types': 'off',
  },
}
