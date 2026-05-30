import { resolve, relative, isAbsolute } from 'path';

export function resolvePath(filePath: string, base: string): string {
  if (isAbsolute(filePath)) return filePath;
  return resolve(base, filePath);
}

export function isWithinDirectory(filePath: string, directory: string): boolean {
  const rel = relative(directory, filePath);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
