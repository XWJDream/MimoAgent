import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GrepTool } from './grep.js';
import type { ToolContext } from '../base.js';
import { execFile } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

describe('GrepTool', () => {
  let tool: GrepTool;
  let mockContext: ToolContext;
  let mockExecFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new GrepTool();
    mockExecFile = vi.fn();

    // Set up the mock
    vi.mocked(execFile).mockImplementation(mockExecFile);

    mockContext = {
      workingDirectory: '/test/project',
      fileCache: null as any,
    };
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('grep');
    });

    it('should have correct risk level', () => {
      expect(tool.riskLevel).toBe('read');
    });

    it('should have correct categories', () => {
      expect(tool.categories).toContain('search');
    });
  });

  describe('basic search', () => {
    it('should return matching lines', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: 'file.txt:1:Hello World\nfile.txt:3:Hello Again', stderr: '' });
      });

      const result = await tool.execute({ pattern: 'Hello' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('file.txt:1:Hello World');
      expect(result.output).toContain('file.txt:3:Hello Again');
    });

    it('should return "No matches found" when no matches', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        const error: any = new Error('No matches');
        error.code = 1;
        cb(error);
      });

      const result = await tool.execute({ pattern: 'nonexistent' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toBe('No matches found.');
    });

    it('should use working directory as default search path', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: 'match', stderr: '' });
      });

      await tool.execute({ pattern: 'test' }, mockContext);

      expect(mockExecFile).toHaveBeenCalledWith(
        'rg',
        expect.arrayContaining(['/test/project']),
        expect.any(Object),
        expect.any(Function),
      );
    });
  });

  describe('search options', () => {
    it('should use custom search path', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: 'match', stderr: '' });
      });

      await tool.execute({ pattern: 'test', path: '/custom/path' }, mockContext);

      expect(mockExecFile).toHaveBeenCalledWith(
        'rg',
        expect.arrayContaining(['/custom/path']),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should add case insensitive flag', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: 'match', stderr: '' });
      });

      await tool.execute({ pattern: 'test', case_insensitive: true }, mockContext);

      expect(mockExecFile).toHaveBeenCalledWith(
        'rg',
        expect.arrayContaining(['--ignore-case']),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should add glob filter', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: 'match', stderr: '' });
      });

      await tool.execute({ pattern: 'test', glob: '*.ts' }, mockContext);

      expect(mockExecFile).toHaveBeenCalledWith(
        'rg',
        expect.arrayContaining(['--glob', '*.ts']),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should always include --no-heading and --line-number', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: 'match', stderr: '' });
      });

      await tool.execute({ pattern: 'test' }, mockContext);

      expect(mockExecFile).toHaveBeenCalledWith(
        'rg',
        expect.arrayContaining(['--no-heading', '--line-number']),
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should limit max count to 100', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: 'match', stderr: '' });
      });

      await tool.execute({ pattern: 'test' }, mockContext);

      expect(mockExecFile).toHaveBeenCalledWith(
        'rg',
        expect.arrayContaining(['--max-count', '100']),
        expect.any(Object),
        expect.any(Function),
      );
    });
  });

  describe('error handling', () => {
    it('should handle ripgrep not found', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(new Error('rg: command not found'));
      });

      const result = await tool.execute({ pattern: 'test' }, mockContext);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('command not found');
    });

    it('should handle timeout', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(new Error('Command timed out'));
      });

      const result = await tool.execute({ pattern: 'test' }, mockContext);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('timed out');
    });

    it('should handle stderr output', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: '', stderr: 'warning: some warning' });
      });

      const result = await tool.execute({ pattern: 'test' }, mockContext);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('warning');
    });

    it('should handle invalid regex', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(new Error('regex parse error'));
      });

      const result = await tool.execute({ pattern: '[invalid' }, mockContext);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('regex parse error');
    });
  });

  describe('output format', () => {
    it('should return formatted output with file and line numbers', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: 'src/index.ts:10:import { foo } from "bar";\nsrc/utils.ts:5:export function foo() {}', stderr: '' });
      });

      const result = await tool.execute({ pattern: 'foo' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('src/index.ts:10:');
      expect(result.output).toContain('src/utils.ts:5:');
    });

    it('should handle empty stdout with no error', async () => {
      mockExecFile.mockImplementation((_cmd: string, _args: string[], _opts: any, cb: Function) => {
        cb(null, { stdout: '', stderr: '' });
      });

      const result = await tool.execute({ pattern: 'test' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toBe('No matches found.');
    });
  });
});
