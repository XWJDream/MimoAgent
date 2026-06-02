import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeLocal } from './process.js';
import { exec } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('executeLocal', () => {
  let mockExec: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExec = vi.fn();
    vi.mocked(exec).mockImplementation(mockExec);
  });

  describe('successful execution', () => {
    it('should return stdout on success', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        cb(null, { stdout: 'Hello World', stderr: '' });
      });

      const result = await executeLocal('echo "Hello World"');

      expect(result.stdout).toBe('Hello World');
      expect(result.stderr).toBe('');
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
    });

    it('should return stderr on success', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        cb(null, { stdout: '', stderr: 'warning message' });
      });

      const result = await executeLocal('some-command');

      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('warning message');
      expect(result.exitCode).toBe(0);
    });

    it('should include duration', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        setTimeout(() => cb(null, { stdout: 'done', stderr: '' }), 50);
      });

      const result = await executeLocal('slow-command');

      expect(result.duration).toBeGreaterThanOrEqual(40);
    });
  });

  describe('failed execution', () => {
    it('should return non-zero exit code', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        const error: any = new Error('Command failed');
        error.code = 1;
        error.stdout = '';
        error.stderr = 'Error: command not found';
        cb(error);
      });

      const result = await executeLocal('nonexistent-command');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('Error: command not found');
    });

    it('should handle timeout', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        const error: any = new Error('Command timed out');
        error.killed = true;
        error.code = 124;
        error.stdout = 'partial';
        error.stderr = '';
        cb(error);
      });

      const result = await executeLocal('sleep 100', { timeout: 1000 });

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
    });

    it('should default to exit code 1 when no code provided', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        const error: any = new Error('Unknown error');
        cb(error);
      });

      const result = await executeLocal('failing-command');

      expect(result.exitCode).toBe(1);
    });
  });

  describe('options', () => {
    it('should use custom working directory', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        expect(_opts.cwd).toBe('/custom/dir');
        cb(null, { stdout: 'done', stderr: '' });
      });

      await executeLocal('ls', { workingDir: '/custom/dir' });
    });

    it('should use custom timeout', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        expect(_opts.timeout).toBe(5000);
        cb(null, { stdout: 'done', stderr: '' });
      });

      await executeLocal('command', { timeout: 5000 });
    });

    it('should use default timeout of 30000', async () => {
      mockExec.mockImplementation((_cmd: string, opts: any, cb: Function) => {
        expect(opts.timeout).toBe(30000);
        cb(null, { stdout: 'done', stderr: '' });
      });

      await executeLocal('command');
    });

    it('should use default working directory', async () => {
      mockExec.mockImplementation((_cmd: string, opts: any, cb: Function) => {
        expect(opts.cwd).toBe(process.cwd());
        cb(null, { stdout: 'done', stderr: '' });
      });

      await executeLocal('command');
    });

    it('should set max buffer to 5MB', async () => {
      mockExec.mockImplementation((_cmd: string, opts: any, cb: Function) => {
        expect(opts.maxBuffer).toBe(5 * 1024 * 1024);
        cb(null, { stdout: 'done', stderr: '' });
      });

      await executeLocal('command');
    });
  });

  describe('error handling', () => {
    it('should handle missing stdout in error', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        const error: any = new Error('Error message');
        cb(error);
      });

      const result = await executeLocal('failing-command');

      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('Error message');
    });

    it('should handle missing stderr in error', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        const error: any = new Error('Error message');
        error.stdout = 'output';
        cb(error);
      });

      const result = await executeLocal('failing-command');

      expect(result.stdout).toBe('output');
      expect(result.stderr).toBe('Error message');
    });

    it('should handle non-Error thrown values', async () => {
      mockExec.mockImplementation((_cmd: string, _opts: any, cb: Function) => {
        cb('string error');
      });

      const result = await executeLocal('failing-command');

      expect(result.stderr).toBe('string error');
    });
  });
});
