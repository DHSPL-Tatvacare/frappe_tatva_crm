import js from '@eslint/js'
import ts from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import configPrettier from 'eslint-config-prettier'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/public/dist/**'],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue', '**/*.js', '**/*.ts'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: ts.parser,
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        frappe: 'readonly',
        __: 'readonly',
      },
    },
  },
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/prop-name-casing': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/v-on-event-hyphenation': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // `const { menu, ...card } = x` is how a key is deliberately OMITTED; the discarded sibling is the point, not an oversight.
      '@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true }],
      'no-undef': 'error',
    },
  },
  {
    // The specs run under vitest, whose describe/it/expect are globals — without them every spec is a wall of no-undef.
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.vitest } },
  },
  configPrettier,
]
