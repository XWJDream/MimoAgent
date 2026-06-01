import { defineConfig } from 'vitest/config';
import { resolveJsToTsSource } from './vitest.source-resolve';

export default defineConfig({
  plugins: [resolveJsToTsSource()],
  test: {
    environment: 'node',
    include: ['engine/src/**/*.live.test.ts'],
    testTimeout: 120000,
  },
});
