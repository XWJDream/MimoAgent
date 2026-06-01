import { defineConfig } from 'vitest/config';
import { resolveJsToTsSource } from './vitest.source-resolve';

export default defineConfig({
  plugins: [resolveJsToTsSource()],
  test: {
    environment: 'node',
    include: ['engine/src/**/*.test.ts'],
    exclude: ['engine/src/**/*.live.test.ts'],
  },
});
