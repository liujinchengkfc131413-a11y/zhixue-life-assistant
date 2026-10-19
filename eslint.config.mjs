import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const restrictedInfrastructureImports = [
  '@life-assistant/database',
  '@life-assistant/scheduler',
  '@life-assistant/ai-adapters',
  '@life-assistant/file-storage',
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '.codex/tmp/**',
      'distribution/**',
      'packages/contracts/src/generated/**',
      'scripts/release/**/*.d.mts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['packages/kernel/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@life-assistant/*', 'fastify', 'react', 'drizzle-orm'] },
      ],
    },
  },
  {
    files: ['packages/domain/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@life-assistant/application',
            ...restrictedInfrastructureImports,
            'fastify',
            'react',
            'drizzle-orm',
          ],
        },
      ],
    },
  },
  {
    files: ['packages/application/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [...restrictedInfrastructureImports, 'fastify', 'react', 'drizzle-orm'],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@life-assistant/domain',
            '@life-assistant/application',
            ...restrictedInfrastructureImports,
            'node:*',
          ],
        },
      ],
    },
  },
);
