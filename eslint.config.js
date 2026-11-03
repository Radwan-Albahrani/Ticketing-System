import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.turbo/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/api/*/*.controller', '**/api/*/*.router'],
              message: 'Feature entry points belong in routers and application composition only.',
            },
          ],
        },
      ],
    },
  },
  { files: ['**/*.router.ts', '**/app.ts'], rules: { 'no-restricted-imports': 'off' } },
);
