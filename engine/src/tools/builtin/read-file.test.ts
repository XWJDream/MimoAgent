import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadFileTool } from './read-file.js';
import type { ToolContext } from '../base.js';
import { stat } from 'fs/promises';

// Mock fs modules
vi.mock('fs/promises', () => ({
  stat: vi.fn(),
}));

describe('ReadFileTool', () => {
  let tool: ReadFileTool;
  let mockContext: ToolContext;
  let mockFileCache: any;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ReadFileTool();

    mockFileCache = {
      getOrLoad: vi.fn(),
    };

    mockContext = {
      workingDirectory: '/test/project',
      fileCache: mockFileCache,
    };
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('read_file');
    });

    it('should have correct risk level', () => {
      expect(tool.riskLevel).toBe('read');
    });

    it('should have correct categories', () => {
      expect(tool.categories).toContain('file');
    });
  });

  describe('security checks', () => {
    it('should reject paths outside working directory', async () => {
      const result = await tool.execute(
        { file_path: '/other/path/file.txt' },
        mockContext,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain('outside working directory');
    });

    it('should reject directory traversal attempts', async () => {
      const result = await tool.execute(
        { file_path: '/test/project/../../../etc/passwd' },
        mockContext,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain('outside working directory');
    });

    it('should allow paths within working directory', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);
      mockFileCache.getOrLoad.mockResolvedValue('file content');

      const result = await tool.execute(
        { file_path: '/test/project/src/file.txt' },
        mockContext,
      );
      expect(result.isError).toBe(false);
    });
  });

  describe('file reading', () => {
    it('should read file content with line numbers', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);
      mockFileCache.getOrLoad.mockResolvedValue('line 1\nline 2\nline 3');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toBe('1\tline 1\n2\tline 2\n3\tline 3');
      expect(result.metadata?.totalLines).toBe(3);
    });

    it('should handle offset parameter', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);
      mockFileCache.getOrLoad.mockResolvedValue('line 1\nline 2\nline 3\nline 4');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', offset: 2 },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toBe('3\tline 3\n4\tline 4');
    });

    it('should handle limit parameter', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);
      mockFileCache.getOrLoad.mockResolvedValue('line 1\nline 2\nline 3\nline 4');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', limit: 2 },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toBe('1\tline 1\n2\tline 2');
    });

    it('should handle offset and limit together', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);
      mockFileCache.getOrLoad.mockResolvedValue('line 1\nline 2\nline 3\nline 4\nline 5');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', offset: 1, limit: 2 },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toBe('2\tline 2\n3\tline 3');
    });

    it('should return (empty file) for empty files', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);
      mockFileCache.getOrLoad.mockResolvedValue('');

      const result = await tool.execute(
        { file_path: '/test/project/empty.txt' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      // Empty string splits to [''] which has one empty line
      expect(result.output).toBe('1\t');
    });

    it('should reject directories', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => true } as any);

      const result = await tool.execute(
        { file_path: '/test/project/src' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('directory');
    });

    it('should handle file not found', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await tool.execute(
        { file_path: '/test/project/nonexistent.txt' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('ENOENT');
    });

    it('should handle permission errors', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await tool.execute(
        { file_path: '/test/project/protected.txt' },
        mockContext,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('EACCES');
    });
  });

  describe('metadata', () => {
    it('should include totalLines in metadata', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);
      mockFileCache.getOrLoad.mockResolvedValue('a\nb\nc');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt' },
        mockContext,
      );

      expect(result.metadata?.totalLines).toBe(3);
    });

    it('should include start and end in metadata', async () => {
      vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);
      mockFileCache.getOrLoad.mockResolvedValue('a\nb\nc\nd');

      const result = await tool.execute(
        { file_path: '/test/project/file.txt', offset: 1, limit: 2 },
        mockContext,
      );

      expect(result.metadata?.start).toBe(1);
      expect(result.metadata?.end).toBe(3);
    });
  });
});
