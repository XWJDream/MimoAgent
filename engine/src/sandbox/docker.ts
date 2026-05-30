import Dockerode from 'dockerode';
import type { SandboxConfig } from '../config/types.js';

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  duration: number;
}

export class DockerSandbox {
  private docker: Dockerode;
  private config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.docker = new Dockerode();
    this.config = config;
  }

  async execute(command: string, options?: { timeout?: number; workingDir?: string }): Promise<SandboxResult> {
    const start = Date.now();
    const timeout = options?.timeout || this.config.timeout;

    try {
      const container = await this.docker.createContainer({
        Image: this.config.image,
        Cmd: ['sh', '-c', command],
        HostConfig: {
          Memory: this.parseMemory(this.config.memoryLimit),
          CpuShares: this.config.cpuLimit,
          NetworkMode: this.config.networkEnabled ? 'bridge' : 'none',
          Binds: [`${process.cwd()}:/workspace:ro`],
        },
        WorkingDir: options?.workingDir || '/workspace',
      });

      await container.start();

      const result = await this.collectOutput(container, timeout);
      await container.remove();

      return {
        ...result,
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: `Sandbox error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 1,
        timedOut: false,
        duration: Date.now() - start,
      };
    }
  }

  private async collectOutput(
    container: Dockerode.Container,
    timeout: number,
  ): Promise<Omit<SandboxResult, 'duration'>> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(async () => {
        timedOut = true;
        try {
          await container.kill();
        } catch {}
      }, timeout);

      container.logs({ follow: true, stdout: true, stderr: true }, (err, stream) => {
        if (err || !stream) {
          clearTimeout(timer);
          resolve({ stdout: '', stderr: err?.message || 'No output', exitCode: 1, timedOut });
          return;
        }

        stream.on('data', (chunk: Buffer) => {
          const data = chunk.toString();
          // Docker stream format: first byte is stream type (1=stdout, 2=stderr)
          if (chunk[0] === 1) stdout += data.slice(8);
          else if (chunk[0] === 2) stderr += data.slice(8);
          else stdout += data;
        });

        stream.on('end', async () => {
          clearTimeout(timer);
          try {
            const inspect = await container.inspect();
            resolve({
              stdout,
              stderr,
              exitCode: inspect.State.ExitCode || 0,
              timedOut,
            });
          } catch {
            resolve({ stdout, stderr, exitCode: timedOut ? 124 : 0, timedOut });
          }
        });
      });
    });
  }

  private parseMemory(limit: string): number {
    const match = limit.match(/^(\d+)(m|g)?$/i);
    if (!match) return 512 * 1024 * 1024;
    const value = parseInt(match[1], 10);
    const unit = (match[2] || 'm').toLowerCase();
    return value * (unit === 'g' ? 1024 : 1) * 1024 * 1024;
  }

  async ensureImage(): Promise<void> {
    try {
      await this.docker.getImage(this.config.image).inspect();
    } catch {
      // Image doesn't exist, would need to build it
      console.warn(`Sandbox image '${this.config.image}' not found. Using local execution.`);
      throw new Error('Sandbox image not available');
    }
  }
}
