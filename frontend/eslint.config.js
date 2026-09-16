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
  {
    /* The visual-regression runner (BACKLOG F70) is a node script rather than
       part of the app. Both global sets, because the functions it hands to
       page.evaluate() are serialised and run in the browser, where document
       and XMLSerializer are exactly what they mean. */
    files: ['tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    // The react plugin's config applies to every file it is given; without
    // this it warns that it cannot find a React version to check against, in a
    // file that has no JSX in it at all.
    settings: { react: { version: 'detect' } },
  },
]
