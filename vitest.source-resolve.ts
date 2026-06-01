import { existsSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

export function resolveJsToTsSource(): Plugin {
  return {
    name: 'resolve-js-to-ts-source',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.endsWith('.js') || !source.startsWith('.')) return null;

      const tsPath = resolve(importer, '..', source.replace(/\.js$/, '.ts'));
      if (existsSync(tsPath)) {
        return tsPath;
      }

      return null;
    },
  };
}
