import { defineConfig } from 'vitest/config';
import { resolveJsToTsSource } from './vitest.source-resolve';

export default defineConfig({
  plugins: [resolveJsToTsSource()],
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts', 'src/preload/**/*.test.ts'],
  },
});
