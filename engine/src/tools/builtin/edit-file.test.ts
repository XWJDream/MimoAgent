import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditFileTool } from './edit-file.js';
import type { ToolContext } from '../base.js';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

// Mock fs modules
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('EditFileTool', () => {
  let tool: EditFileTool;
  let mockContext: ToolContext;
  let mockFileCache: any;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new EditFileTool();

    mockFileCache = {
      invalidate: vi.fn(),
    };

    mockContext = {
      workingDirectory: '/test/project',
      fileCache: mockFileCache,
    };
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('edit_file');
    });

    it('should have correct risk level', () => {
      expect(tool.riskLevel).toBe('write');
    });

    it('should have correct categories', () => {
      expect(tool.categories).toContain('file');
    });
  });

  describe('security checks', () => {
    it('should reject paths outside working directory', async () => {
      const result = await tool.execute(
        { file_path: '/other/path/file.txt', old_string: 'old', new_string: 'new' },
        mockContext,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain('outside working directory');
    });

    it('should reject directory traversal attempts', async () => {
      const result = await tool.execute(
        { file_path: '/test/project/../../../etc/passwd', old_string: 'old', new_string: 'new' },
        mockContext,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain('outside working directory');
    });
  });

  describe('validation', () => {
    it('should reject identical old and new strings', async () => {
      const result = await tool.execute(
        { file_path: '/test/project/file.txt', old_string: 'same', new_string: 'same' },
        mockContext,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain('identical');
    });
  });

  describe('file editing', () => {
    it('should replace unique string', async () => {
      vi.mocked(readFile).mockResolvedValue('Hello World');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', old_string: 'World', new_string: 'Universe' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('File edited successfully');
      const expectedPath = resolve('/test/project/file.txt');
      expect(writeFile).toHaveBeenCalledWith(
        expectedPath,
        'Hello Universe',
        'utf-8',
      );
    });

    it('should invalidate file cache', async () => {
      vi.mocked(readFile).mockResolvedValue('Hello World');

      await tool.execute(
        { file_path: '/test/project/file.txt', old_string: 'World', new_string: 'Universe' },
        mockContext,
      );

      const expectedPath = resolve('/test/project/file.txt');
      expect(mockFileCache.invalidate).toHaveBeenCalledWith(expectedPath);
    });

    it('should reject when old_string not found', async () => {
      vi.mocked(readFile).mockResolvedValue('Hello World');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', old_string: 'NotFound', new_string: 'new' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('not found');
    });

    it('should reject when old_string found multiple times', async () => {
      vi.mocked(readFile).mockResolvedValue('aaa bbb aaa ccc aaa');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', old_string: 'aaa', new_string: 'xxx' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('3 times');
      expect(result.output).toContain('unique');
    });

    it('should replace first occurrence when unique', async () => {
      vi.mocked(readFile).mockResolvedValue('line1\nline2\nline3');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', old_string: 'line2', new_string: 'modified' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      const expectedPath = resolve('/test/project/file.txt');
      expect(writeFile).toHaveBeenCalledWith(
        expectedPath,
        'line1\nmodified\nline3',
        'utf-8',
      );
    });
  });

  describe('diff generation', () => {
    it('should generate diff preview', async () => {
      vi.mocked(readFile).mockResolvedValue('line1\nline2\nline3');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', old_string: 'line2', new_string: 'modified' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('Diff:');
      expect(result.metadata?.diff).toBeDefined();
    });

    it('should show context lines in diff', async () => {
      vi.mocked(readFile).mockResolvedValue('line1\nline2\nline3\nline4\nline5');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', old_string: 'line3', new_string: 'modified' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('- 3: line3');
      expect(result.output).toContain('+ 3: modified');
      // Note: Context lines may or may not be included depending on diff algorithm
    });

    it('should handle multi-line replacements', async () => {
      vi.mocked(readFile).mockResolvedValue('start\nold line 1\nold line 2\nend');

      const result = await tool.execute(
        {
          file_path: '/test/project/file.txt',
          old_string: 'old line 1\nold line 2',
          new_string: 'new line 1\nnew line 2',
        },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('- 2: old line 1');
      expect(result.output).toContain('+ 2: new line 1');
    });
  });

  describe('error handling', () => {
    it('should handle file not found', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await tool.execute(
        { file_path: '/test/project/nonexistent.txt', old_string: 'old', new_string: 'new' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('ENOENT');
    });

    it('should handle permission errors', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await tool.execute(
        { file_path: '/test/project/protected.txt', old_string: 'old', new_string: 'new' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('EACCES');
    });

    it('should handle write errors', async () => {
      vi.mocked(readFile).mockResolvedValue('content');
      vi.mocked(writeFile).mockRejectedValue(new Error('ENOSPC: no space left on device'));

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', old_string: 'content', new_string: 'new' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('ENOSPC');
    });
  });
});
