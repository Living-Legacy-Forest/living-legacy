import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const sharedRules = {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_$|^e$' },
  ],
  'no-console': ['warn', { allow: ['error', 'warn'] }],
  'prefer-const': 'error',
  eqeqeq: ['error', 'always'],
  'no-var': 'error',
};

export default [
  // Generated files, plus the editorcn editor and extensions and the mapcn map,
  // which are vendored as-is from their registry (still type-checked). components/ui and the
  // editor template are edited here, so they stay linted.
  {
    ignores: [
      'dist/**',
      '.wrangler/**',
      'src/routeTree.gen.ts',
      'worker-configuration.d.ts',
      'src/components/editor/**',
      'src/components/extensions/**',
      'src/components/ui/map.tsx',
    ],
  },
  {
    files: ['**/*.ts'],
    plugins: { '@typescript-eslint': tseslint },
    languageOptions: { parser: tsParser },
    rules: sharedRules,
  },
  {
    files: ['**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint, 'jsx-a11y': jsxA11y },
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Same reason as apps/web: Base UI passes elements through `render`.
      'jsx-a11y/anchor-has-content': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      ...sharedRules,
    },
  },
  // Toasts go through lib/notify, which requires a heading and a description.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/notify.ts', 'src/components/ui/sonner.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'sonner',
              importNames: ['toast'],
              message:
                'Use notify from @/lib/notify, so every toast has a heading and a description.',
            },
          ],
        },
      ],
    },
  },
];
