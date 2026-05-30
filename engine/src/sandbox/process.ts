import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  duration: number;
}

export async function executeLocal(
  command: string,
  options?: { timeout?: number; workingDir?: string },
): Promise<ProcessResult> {
  const start = Date.now();
  const timeout = options?.timeout || 30000;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: options?.workingDir || process.cwd(),
      timeout,
      maxBuffer: 5 * 1024 * 1024,
      shell: process.env.SHELL || (process.platform === 'win32' ? 'powershell' : 'bash'),
    });

    return {
      stdout,
      stderr,
      exitCode: 0,
      timedOut: false,
      duration: Date.now() - start,
    };
  } catch (error: unknown) {
    const err = error as { code?: number; stdout?: string; stderr?: string; killed?: boolean; message?: string };
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || String(error),
      exitCode: err.code || 1,
      timedOut: err.killed || false,
      duration: Date.now() - start,
    };
  }
}
