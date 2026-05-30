import type { SandboxConfig } from '../config/types.js';
import { DockerSandbox, type SandboxResult } from './docker.js';
import { executeLocal } from './process.js';

export class SandboxManager {
  private sandbox: DockerSandbox | null = null;
  private enabled: boolean;
  private fallbackToLocal: boolean;

  constructor(config: SandboxConfig, fallbackToLocal = true) {
    this.enabled = config.enabled;
    this.fallbackToLocal = fallbackToLocal;
    if (this.enabled) {
      this.sandbox = new DockerSandbox(config);
    }
  }

  async initialize(): Promise<void> {
    if (!this.sandbox) return;
    try {
      await this.sandbox.ensureImage();
    } catch {
      if (this.fallbackToLocal) {
        console.warn('Docker sandbox unavailable, falling back to local execution.');
        this.sandbox = null;
      } else {
        throw new Error('Sandbox image not available and fallback disabled');
      }
    }
  }

  async execute(command: string, options?: { timeout?: number; workingDir?: string }): Promise<SandboxResult> {
    if (this.sandbox) {
      return this.sandbox.execute(command, options);
    }
    if (this.fallbackToLocal) {
      return executeLocal(command, options);
    }
    throw new Error('No sandbox available');
  }

  isEnabled(): boolean {
    return this.enabled && this.sandbox !== null;
  }
}
