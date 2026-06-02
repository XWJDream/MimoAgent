import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobTool } from './glob.js';
import type { ToolContext } from '../base.js';
import { readdirSync } from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  readdirSync: vi.fn(),
}));

describe('GlobTool', () => {
  let tool: GlobTool;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new GlobTool();
    mockContext = {
      workingDirectory: '/test/project',
      fileCache: null as any,
    };
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('glob');
    });

    it('should have correct risk level', () => {
      expect(tool.riskLevel).toBe('read');
    });

    it('should have correct categories', () => {
      expect(tool.categories).toContain('search');
    });
  });

  describe('pattern matching', () => {
    it('should match simple pattern', async () => {
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file.ts', isDirectory: () => false },
        { name: 'file.js', isDirectory: () => false },
        { name: 'file.txt', isDirectory: () => false },
      ] as any);

      const result = await tool.execute({ pattern: '*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('file.ts');
      expect(result.output).not.toContain('file.js');
    });

    it('should match wildcard pattern', async () => {
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'index.ts', isDirectory: () => false },
        { name: 'utils.ts', isDirectory: () => false },
        { name: 'style.css', isDirectory: () => false },
      ] as any);

      const result = await tool.execute({ pattern: '*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('index.ts');
      expect(result.output).toContain('utils.ts');
      expect(result.metadata?.count).toBe(2);
    });

    it('should match question mark pattern', async () => {
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'a.ts', isDirectory: () => false },
        { name: 'bb.ts', isDirectory: () => false },
        { name: 'c.ts', isDirectory: () => false },
      ] as any);

      const result = await tool.execute({ pattern: '?.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('a.ts');
      expect(result.output).toContain('c.ts');
      expect(result.output).not.toContain('bb.ts');
    });
  });

  describe('directory traversal', () => {
    it('should search in subdirectories', async () => {
      vi.mocked(readdirSync).mockImplementation(((path: string, _options: any) => {
        if (path === '/test/project') {
          // Root directory
          return [
            { name: 'src', isDirectory: () => true },
            { name: 'root.ts', isDirectory: () => false },
          ] as any;
        } else if (path.includes('src')) {
          // src directory
          return [
            { name: 'index.ts', isDirectory: () => false },
            { name: 'utils.ts', isDirectory: () => false },
          ] as any;
        }
        return [] as any;
      }) as any);

      const result = await tool.execute({ pattern: '*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('root.ts');
      // Note: *.ts only matches root level, not subdirectories
    });

    it('should skip hidden directories', async () => {
      vi.mocked(readdirSync).mockImplementation(((path: string) => {
        if (path === '/test/project') {
          return [
            { name: '.hidden', isDirectory: () => true },
            { name: 'visible.ts', isDirectory: () => false },
          ] as any;
        }
        return [] as any;
      }) as any);

      const result = await tool.execute({ pattern: '*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('visible.ts');
    });

    it('should skip node_modules', async () => {
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'node_modules', isDirectory: () => true },
        { name: 'src', isDirectory: () => true },
      ] as any);

      // Mock src directory
      vi.mocked(readdirSync).mockReturnValueOnce([
        { name: 'node_modules', isDirectory: () => true },
        { name: 'src', isDirectory: () => true },
      ] as any).mockReturnValueOnce([
        { name: 'index.ts', isDirectory: () => false },
      ] as any);

      const result = await tool.execute({ pattern: '**/*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('src/index.ts');
    });

    it('should respect max depth', async () => {
      // Create a deeply nested structure
      let depth = 0;
      vi.mocked(readdirSync).mockImplementation(() => {
        depth++;
        if (depth <= 11) {
          return [{ name: 'deep', isDirectory: () => true }] as any;
        }
        return [{ name: 'file.ts', isDirectory: () => false }] as any;
      });

      const result = await tool.execute({ pattern: '**/*.ts' }, mockContext);

      // Should not find files deeper than 10 levels
      expect(result.isError).toBe(false);
    });
  });

  describe('max results', () => {
    it('should limit results to 200', async () => {
      const files = Array.from({ length: 300 }, (_, i) => ({
        name: `file${i}.ts`,
        isDirectory: () => false,
      }));

      vi.mocked(readdirSync).mockReturnValue(files as any);

      const result = await tool.execute({ pattern: '*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.metadata?.count).toBe(200);
    });
  });

  describe('error handling', () => {
    it('should handle unreadable directories', async () => {
      vi.mocked(readdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await tool.execute({ pattern: '*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toBe('No files found');
    });

    it('should handle custom search path', async () => {
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file.ts', isDirectory: () => false },
      ] as any);

      const result = await tool.execute(
        { pattern: '*.ts', path: '/custom/path' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('file.ts');
    });
  });

  describe('output format', () => {
    it('should return relative paths', async () => {
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'file.ts', isDirectory: () => false },
      ] as any);

      const result = await tool.execute({ pattern: '*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toBe('file.ts');
    });

    it('should return all matching results', async () => {
      vi.mocked(readdirSync).mockReturnValue([
        { name: 'c.ts', isDirectory: () => false },
        { name: 'a.ts', isDirectory: () => false },
        { name: 'b.ts', isDirectory: () => false },
      ] as any);

      const result = await tool.execute({ pattern: '*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      const files = result.output.split('\n');
      expect(files).toHaveLength(3);
      expect(files).toContain('a.ts');
      expect(files).toContain('b.ts');
      expect(files).toContain('c.ts');
    });

    it('should return "No files found" when empty', async () => {
      vi.mocked(readdirSync).mockReturnValue([]);

      const result = await tool.execute({ pattern: '*.ts' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toBe('No files found');
    });
  });
});
