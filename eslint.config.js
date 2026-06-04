import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
    },
  },
  {
    ignores: [
      'dist/**',
      'release/**',
      'node_modules/**',
      'engine/**',
      'src/**/*.js',
      'src/**/*.d.ts',
      'src/**/*.map',
    ],
  }
);
