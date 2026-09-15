/* ESLint flat config.
 *
 * Replaces .eslintrc.cjs, which ESLint 9 no longer reads. The rules are the
 * same ones; what changed is that the config is a module the tool imports
 * rather than a file it searches for, so plugins resolve from here and the
 * `--ext` flag is gone -- the `files` patterns below say what gets linted.
 */

import js from '@eslint/js'
import react from 'eslint-plugin-react'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/lib/fallbackData.js'] },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // No TypeScript and no prop-types dependency here, so this rule can only
      // ask for runtime type declarations the project deliberately omits.
      'react/prop-types': 'off',
    },
  },
]
