import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShellTool } from './shell.js';
import type { ToolContext } from '../base.js';

// Mock the process execution
vi.mock('../../sandbox/process.js', () => ({
  executeLocal: vi.fn(),
}));

describe('ShellTool', () => {
  let tool: ShellTool;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ShellTool();
    mockContext = {
      workingDirectory: '/test/dir',
      fileCache: null as any,
    };
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('shell');
    });

    it('should have correct risk level', () => {
      expect(tool.riskLevel).toBe('execute');
    });

    it('should have correct categories', () => {
      expect(tool.categories).toContain('shell');
    });
  });

  describe('dangerous command detection', () => {
    it('should block rm -rf /', async () => {
      const result = await tool.execute({ command: 'rm -rf /' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block rm -rf /*', async () => {
      const result = await tool.execute({ command: 'rm -rf /*' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block mkfs', async () => {
      const result = await tool.execute({ command: 'mkfs.ext4 /dev/sda1' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block dd if=', async () => {
      const result = await tool.execute({ command: 'dd if=/dev/zero of=/dev/sda' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block fork bomb', async () => {
      const result = await tool.execute({ command: ':(){:|:&};:' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block curl | sh', async () => {
      const result = await tool.execute({ command: 'curl | sh' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block wget | bash', async () => {
      const result = await tool.execute({ command: 'wget | bash' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block chmod -R 777 /', async () => {
      const result = await tool.execute({ command: 'chmod -R 777 /' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block > /dev/sda', async () => {
      const result = await tool.execute({ command: 'echo "data" > /dev/sda' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block rm -rf ~', async () => {
      const result = await tool.execute({ command: 'rm -rf ~' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should block rm -rf $HOME', async () => {
      const result = await tool.execute({ command: 'rm -rf $HOME' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Blocked dangerous command');
    });

    it('should allow safe commands', async () => {
      const { executeLocal } = await import('../../sandbox/process.js');
      vi.mocked(executeLocal).mockResolvedValue({
        stdout: 'file.txt',
        stderr: '',
        exitCode: 0,
        timedOut: false,
        duration: 100,
      });

      const result = await tool.execute({ command: 'ls -la' }, mockContext);
      expect(result.isError).toBe(false);
      expect(result.output).toBe('file.txt');
    });
  });

  describe('command execution', () => {
    it('should return success for exit code 0', async () => {
      const { executeLocal } = await import('../../sandbox/process.js');
      vi.mocked(executeLocal).mockResolvedValue({
        stdout: 'Hello World',
        stderr: '',
        exitCode: 0,
        timedOut: false,
        duration: 50,
      });

      const result = await tool.execute({ command: 'echo "Hello World"' }, mockContext);
      expect(result.isError).toBe(false);
      expect(result.output).toBe('Hello World');
      expect(result.metadata?.duration).toBe(50);
    });

    it('should return error for non-zero exit code', async () => {
      const { executeLocal } = await import('../../sandbox/process.js');
      vi.mocked(executeLocal).mockResolvedValue({
        stdout: '',
        stderr: 'No such file or directory',
        exitCode: 1,
        timedOut: false,
        duration: 30,
      });

      const result = await tool.execute({ command: 'cat /nonexistent' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('stderr: No such file or directory');
      expect(result.output).toContain('exited with code 1');
    });

    it('should handle timeout', async () => {
      const { executeLocal } = await import('../../sandbox/process.js');
      vi.mocked(executeLocal).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 124,
        timedOut: true,
        duration: 30000,
      });

      const result = await tool.execute({ command: 'sleep 100', timeout: 1000 }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('timed out');
    });

    it('should combine stdout and stderr', async () => {
      const { executeLocal } = await import('../../sandbox/process.js');
      vi.mocked(executeLocal).mockResolvedValue({
        stdout: 'output line',
        stderr: 'warning line',
        exitCode: 0,
        timedOut: false,
        duration: 20,
      });

      const result = await tool.execute({ command: 'some-command' }, mockContext);
      expect(result.isError).toBe(false);
      expect(result.output).toContain('output line');
      expect(result.output).toContain('warning line');
    });

    it('should return (no output) for empty output', async () => {
      const { executeLocal } = await import('../../sandbox/process.js');
      vi.mocked(executeLocal).mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
        duration: 10,
      });

      const result = await tool.execute({ command: 'true' }, mockContext);
      expect(result.isError).toBe(false);
      expect(result.output).toBe('(no output)');
    });
  });

  describe('abort signal', () => {
    it('should cancel if abort signal is already aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const contextWithAbort: ToolContext = {
        ...mockContext,
        abortSignal: abortController.signal,
      };

      const result = await tool.execute({ command: 'echo test' }, contextWithAbort);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('cancelled');
    });
  });

  describe('sandbox support', () => {
    it('should use sandbox if available', async () => {
      const { executeLocal } = await import('../../sandbox/process.js');
      const mockSandbox = {
        execute: vi.fn().mockResolvedValue({
          stdout: 'sandbox output',
          stderr: '',
          exitCode: 0,
          timedOut: false,
          duration: 25,
        }),
        isEnabled: () => true,
      };

      const contextWithSandbox: ToolContext = {
        ...mockContext,
        sandboxManager: mockSandbox as any,
      };

      const result = await tool.execute({ command: 'echo test' }, contextWithSandbox);
      expect(result.isError).toBe(false);
      expect(result.output).toBe('sandbox output');
      expect(mockSandbox.execute).toHaveBeenCalled();
      expect(executeLocal).not.toHaveBeenCalled();
    });

    it('should fallback to local if sandbox fails', async () => {
      const { executeLocal } = await import('../../sandbox/process.js');
      const mockSandbox = {
        execute: vi.fn().mockRejectedValue(new Error('Sandbox error')),
        isEnabled: () => true,
      };

      vi.mocked(executeLocal).mockResolvedValue({
        stdout: 'local output',
        stderr: '',
        exitCode: 0,
        timedOut: false,
        duration: 30,
      });

      const contextWithSandbox: ToolContext = {
        ...mockContext,
        sandboxManager: mockSandbox as any,
      };

      const result = await tool.execute({ command: 'echo test' }, contextWithSandbox);
      expect(result.isError).toBe(false);
      expect(result.output).toBe('local output');
      expect(executeLocal).toHaveBeenCalled();
    });

    it('should indicate sandbox usage in metadata', async () => {
      const mockSandbox = {
        execute: vi.fn().mockResolvedValue({
          stdout: 'output',
          stderr: '',
          exitCode: 0,
          timedOut: false,
          duration: 20,
        }),
        isEnabled: () => true,
      };

      const contextWithSandbox: ToolContext = {
        ...mockContext,
        sandboxManager: mockSandbox as any,
      };

      const result = await tool.execute({ command: 'echo test' }, contextWithSandbox);
      expect(result.metadata?.sandbox).toBe(true);
    });
  });
});
