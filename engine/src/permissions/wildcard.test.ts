import { describe, it, expect, afterEach } from 'vitest';
import { wildcardMatch, clearWildcardCache } from './wildcard.js';

describe('wildcardMatch', () => {
  afterEach(() => {
    clearWildcardCache();
  });

  describe('exact match', () => {
    it('should match identical strings', () => {
      expect(wildcardMatch('hello', 'hello')).toBe(true);
    });

    it('should not match different strings', () => {
      expect(wildcardMatch('hello', 'world')).toBe(false);
    });
  });

  describe('* (single star)', () => {
    it('should match any non-slash characters', () => {
      expect(wildcardMatch('file.txt', '*.txt')).toBe(true);
      expect(wildcardMatch('.env', '*.env')).toBe(true);
      expect(wildcardMatch('test.env', '*.env')).toBe(true);
      expect(wildcardMatch('deep/path/file.txt', '*.txt')).toBe(false);
    });

    it('should match empty string', () => {
      expect(wildcardMatch('', '*')).toBe(true);
    });

    it('should match all non-slash characters', () => {
      expect(wildcardMatch('abc123', '*')).toBe(true);
    });

    it('should not cross path boundaries', () => {
      // * only matches non-slash characters
      expect(wildcardMatch('a/b', '*')).toBe(false);
      expect(wildcardMatch('a\\b', '*')).toBe(false);
    });
  });

  describe('** (double star)', () => {
    it('should match anything including slashes', () => {
      expect(wildcardMatch('src/a.ts', 'src/**')).toBe(true);
      expect(wildcardMatch('src/b/c.ts', 'src/**')).toBe(true);
      expect(wildcardMatch('src/deep/nested/file.ts', 'src/**')).toBe(true);
    });

    it('should match with leading pattern', () => {
      expect(wildcardMatch('test.env', '**/.env*')).toBe(false);
      expect(wildcardMatch('.env', '**/.env*')).toBe(true);
      expect(wildcardMatch('dir/.env', '**/.env*')).toBe(true);
      expect(wildcardMatch('dir/.env.local', '**/.env*')).toBe(true);
    });

    it('should match everything with standalone **', () => {
      expect(wildcardMatch('any/path/file.txt', '**')).toBe(true);
      expect(wildcardMatch('', '**')).toBe(true);
    });
  });

  describe('? (question mark)', () => {
    it('should match single character', () => {
      expect(wildcardMatch('a', '?')).toBe(true);
      expect(wildcardMatch('ab', '?')).toBe(false);
      expect(wildcardMatch('', '?')).toBe(false);
    });

    it('should not match slash', () => {
      expect(wildcardMatch('/', '?')).toBe(false);
    });
  });

  describe('case insensitivity', () => {
    it('should match case-insensitively', () => {
      expect(wildcardMatch('FILE.TXT', '*.txt')).toBe(true);
      expect(wildcardMatch('file.txt', '*.TXT')).toBe(true);
      expect(wildcardMatch('File.TXT', '*.txt')).toBe(true);
    });
  });

  describe('Windows path handling', () => {
    it('should normalize backslashes', () => {
      expect(wildcardMatch('src\\a.ts', 'src/**')).toBe(true);
      expect(wildcardMatch('src\\a.ts', 'src/*')).toBe(true);
    });

    it('should handle mixed separators', () => {
      expect(wildcardMatch('src\\nested/file.ts', 'src/**')).toBe(true);
    });
  });

  describe('complex patterns', () => {
    it('should match .env patterns', () => {
      expect(wildcardMatch('.env', '*.env')).toBe(true);
      expect(wildcardMatch('.env.local', '*.env.*')).toBe(true);
      expect(wildcardMatch('.env.example', '*.env.example')).toBe(true);
    });

    it('should match git paths', () => {
      expect(wildcardMatch('.git/config', '**/.git/**')).toBe(true);
      expect(wildcardMatch('project/.git/objects/abc', '**/.git/**')).toBe(true);
      expect(wildcardMatch('gitignore', '**/.git/**')).toBe(false);
    });

    it('should match node_modules paths', () => {
      expect(wildcardMatch('node_modules/package/index.js', '**/node_modules/**')).toBe(true);
      expect(wildcardMatch('project/node_modules/lib.js', '**/node_modules/**')).toBe(true);
    });

    it('should match src/** patterns', () => {
      expect(wildcardMatch('src/index.ts', 'src/**')).toBe(true);
      expect(wildcardMatch('src/utils/helper.ts', 'src/**')).toBe(true);
      expect(wildcardMatch('lib/index.ts', 'src/**')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty pattern', () => {
      expect(wildcardMatch('', '')).toBe(true);
      expect(wildcardMatch('a', '')).toBe(false);
    });

    it('should handle special regex characters in text', () => {
      expect(wildcardMatch('file.ts', 'file.ts')).toBe(true);
      expect(wildcardMatch('file+plus', 'file+plus')).toBe(true);
      expect(wildcardMatch('file[0]', 'file[0]')).toBe(true);
      expect(wildcardMatch('file(1)', 'file(1)')).toBe(true);
    });

    it('should handle multiple wildcards', () => {
      expect(wildcardMatch('src/components/Button.tsx', 'src/*/Button.*')).toBe(true);
      expect(wildcardMatch('src/components/Button.tsx', 'src/*/*.tsx')).toBe(true);
      expect(wildcardMatch('src/deep/path/Button.tsx', 'src/*/*.tsx')).toBe(false);
    });
  });
});
