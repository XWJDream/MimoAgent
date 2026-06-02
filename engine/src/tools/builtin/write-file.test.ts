import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriteFileTool } from './write-file.js';
import type { ToolContext } from '../base.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { resolve } from 'path';

// Mock fs modules
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
}));

describe('WriteFileTool', () => {
  let tool: WriteFileTool;
  let mockContext: ToolContext;
  let mockFileCache: any;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new WriteFileTool();

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
      expect(tool.name).toBe('write_file');
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
        { file_path: '/other/path/file.txt', content: 'test' },
        mockContext,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain('outside working directory');
    });

    it('should reject directory traversal attempts', async () => {
      const result = await tool.execute(
        { file_path: '/test/project/../../../etc/passwd', content: 'test' },
        mockContext,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain('outside working directory');
    });

    it('should allow paths within working directory', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await tool.execute(
        { file_path: '/test/project/src/file.txt', content: 'test' },
        mockContext,
      );
      expect(result.isError).toBe(false);
    });
  });

  describe('file writing', () => {
    it('should write content to file', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', content: 'Hello World' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('File written successfully');
      const expectedPath = resolve('/test/project/file.txt');
      expect(writeFile).toHaveBeenCalledWith(
        expectedPath,
        'Hello World',
        'utf-8',
      );
    });

    it('should create parent directories', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      await tool.execute(
        { file_path: '/test/project/src/deep/file.txt', content: 'test' },
        mockContext,
      );

      const expectedDir = resolve('/test/project/src/deep');
      expect(mkdir).toHaveBeenCalledWith(
        expectedDir,
        { recursive: true },
      );
    });

    it('should invalidate file cache', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      await tool.execute(
        { file_path: '/test/project/file.txt', content: 'test' },
        mockContext,
      );

      const expectedPath = resolve('/test/project/file.txt');
      expect(mockFileCache.invalidate).toHaveBeenCalledWith(expectedPath);
    });

    it('should count lines correctly', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', content: 'line1\nline2\nline3' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('3 lines');
    });

    it('should handle single line file', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', content: 'single line' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('1 lines');
    });

    it('should handle empty content', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', content: '' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('1 lines'); // Empty string has 1 line
    });
  });

  describe('diff generation', () => {
    it('should generate diff when overwriting existing file', async () => {
      vi.mocked(readFile).mockResolvedValue('old content');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', content: 'new content' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('Diff:');
      expect(result.metadata?.diff).toBeDefined();
    });

    it('should not generate diff for new file', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

      const result = await tool.execute(
        { file_path: '/test/project/new-file.txt', content: 'content' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).not.toContain('Diff:');
      expect(result.metadata?.diff).toBeUndefined();
    });

    it('should not generate diff when content is same', async () => {
      vi.mocked(readFile).mockResolvedValue('same content');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', content: 'same content' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).not.toContain('Diff:');
    });

    it('should show context lines in diff', async () => {
      vi.mocked(readFile).mockResolvedValue('line1\nline2\nline3\nline4\nline5');

      const result = await tool.execute(
        {
          file_path: '/test/project/file.txt',
          content: 'line1\nline2\nmodified\nline4\nline5',
        },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('- 3: line3');
      expect(result.output).toContain('+ 3: modified');
    });

    it('should limit diff output', async () => {
      // Create a file with many changed lines
      const oldContent = Array.from({ length: 100 }, (_, i) => `old line ${i}`).join('\n');
      const newContent = Array.from({ length: 100 }, (_, i) => `new line ${i}`).join('\n');

      vi.mocked(readFile).mockResolvedValue(oldContent);

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', content: newContent },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect((result.metadata?.diff as string[])?.length).toBeLessThanOrEqual(50);
    });
  });

  describe('error handling', () => {
    it('should handle write permission errors', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));
      vi.mocked(writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await tool.execute(
        { file_path: '/test/project/protected.txt', content: 'test' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('EACCES');
    });

    it('should handle mkdir permission errors', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));
      vi.mocked(mkdir).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await tool.execute(
        { file_path: '/test/project/protected/file.txt', content: 'test' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('EACCES');
    });
  });
});
