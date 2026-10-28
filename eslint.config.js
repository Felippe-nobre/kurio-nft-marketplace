import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public/mockServiceWorker.js', 'playwright-report', 'test-results', 'lighthouse/reports'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // `use` das fixtures do Playwright não é um hook do React.
  { files: ['e2e/**/*.ts'], rules: { 'react-hooks/rules-of-hooks': 'off' } },
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
)
