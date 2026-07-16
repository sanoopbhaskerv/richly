import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        ecmaVersion: 'latest'
      }
    },
    rules: {
      'no-irregular-whitespace': [
        'error',
        { skipComments: true, skipStrings: true, skipTemplates: true, skipRegExps: true }
      ]
    }
  },
  {
    // Maintainability guardrails scoped to the Image Studio packages (see
    // docs/image-studio/ui-handoff.md §7). Warn-level on purpose: they flag
    // files that need decomposition without blocking the wider repository.
    files: [
      'packages/image-core/src/**/*.{ts,tsx}',
      'packages/image-react/src/**/*.{ts,tsx}',
      'packages/image-studio/src/**/*.{ts,tsx}',
      'packages/image-studio-demo/src/**/*.{ts,tsx}',
      'packages/plugin-image-editor/src/**/*.{ts,tsx}'
    ],
    rules: {
      'max-lines': ['warn', { max: 550, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'warn',
        { max: 120, skipBlankLines: true, skipComments: true, IIFEs: true }
      ],
      complexity: ['warn', 15],
      'max-depth': ['warn', 4]
    }
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    }
  },
  prettier
);
