import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';
import { executeLocal } from '../../sandbox/process.js';

export class ShellTool extends BaseTool {
  readonly name = 'shell';
  readonly description = 'Execute a shell command and return its output. Use with caution.';
  readonly riskLevel = 'execute' as const;
  readonly categories = ['shell' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'shell',
      description: 'Execute a shell command and return stdout/stderr.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' },
        },
        required: ['command'],
      },
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { command, timeout } = args as { command: string; timeout?: number };
    if (context.abortSignal?.aborted) {
      return { output: 'Command cancelled before execution', isError: true };
    }

    // Safety: block obviously destructive commands
    // Normalize command for detection (remove extra spaces, handle variations)
    const normalizedCmd = command.replace(/\s+/g, ' ').trim().toLowerCase();

    const dangerousPatterns = [
      // Unix destructive commands
      { pattern: /rm\s+(-[a-z]*f[a-z]*\s+)?(-[a-z]*r[a-z]*\s+)?\/(\s|$|\*)/, desc: 'rm on root' },
      { pattern: /rm\s+(-[a-z]*r[a-z]*\s+)?(-[a-z]*f[a-z]*\s+)?\/(\s|$|\*)/, desc: 'rm on root' },
      { pattern: /rm\s+-rf\s+~|rm\s+-rf\s+\$HOME/, desc: 'rm on home' },
      { pattern: /mkfs/, desc: 'mkfs' },
      { pattern: /dd\s+if=/, desc: 'dd' },
      { pattern: /:\(\)\{.*\|.*&\}/, desc: 'fork bomb' },
      { pattern: /(curl|wget)\s+.*\|\s*(sh|bash|zsh)/, desc: 'pipe to shell' },
      { pattern: /(curl|wget)\s+.*\|\s*(sh|bash|zsh)/, desc: 'pipe to shell' },
      { pattern: /chmod\s+-[a-z]*R\s+777\s+\//, desc: 'chmod 777 on root' },
      { pattern: />\s*\/dev\/sd[a-z]/, desc: 'write to disk' },
      { pattern: /mv\s+\/\s+/, desc: 'mv root' },

      // Windows destructive commands
      { pattern: /format\s+[a-z]:/, desc: 'format drive' },
      { pattern: /del\s+\/[a-z]*\s+[a-z]:\\(\s|\*)/, desc: 'del drive root' },
      { pattern: /rd\s+\/[a-z]*\s+[a-z]:\\/, desc: 'rd drive root' },
      { pattern: /rmdir\s+\/[a-z]*\s+[a-z]:\\/, desc: 'rmdir drive root' },
      { pattern: /shutdown\s+\/[a-z]*\s/, desc: 'shutdown' },
      { pattern: /taskkill\s+\/[a-z]*\s+\/[a-z]*\s+system/, desc: 'kill system process' },
      { pattern: /reg\s+delete\s+hklm\\/, desc: 'registry delete HKLM' },
      { pattern: /cipher\s+\/[a-z]*:.*c:/, desc: 'cipher wipe' },

      // Generic dangerous patterns
      { pattern: />\s*\/dev\/null\s+2>&1\s*&/, desc: 'background redirect' },
      { pattern: /\|\s*sudo/, desc: 'pipe to sudo' },
    ];

    for (const { pattern, desc } of dangerousPatterns) {
      if (pattern.test(command) || pattern.test(normalizedCmd)) {
        return { output: `Error: Blocked dangerous command (${desc}): ${command}`, isError: true };
      }
    }

    // Use sandbox if available, otherwise local execution
    let result: { stdout: string; stderr: string; exitCode: number; timedOut: boolean; duration: number };

    if (context.sandboxManager) {
      try {
        result = await context.sandboxManager.execute(command, {
          workingDir: context.workingDirectory,
          timeout: timeout || 30000,
        });
      } catch (err) {
        // Sandbox failed, fallback to local
        result = await executeLocal(command, {
          workingDir: context.workingDirectory,
          timeout: timeout || 30000,
        });
      }
    } else {
      result = await executeLocal(command, {
        workingDir: context.workingDirectory,
        timeout: timeout || 30000,
      });
    }

    if (result.exitCode === 0) {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
      return {
        output: output || '(no output)',
        isError: false,
        metadata: { duration: result.duration, sandbox: !!context.sandboxManager },
      };
    }

    return {
      output: [
        result.stdout && `stdout: ${result.stdout}`,
        result.stderr && `stderr: ${result.stderr}`,
        `Error: Command exited with code ${result.exitCode}${result.timedOut ? ' (timed out)' : ''}`,
      ]
        .filter(Boolean)
        .join('\n'),
      isError: true,
      metadata: { duration: result.duration, sandbox: !!context.sandboxManager },
    };
  }
}
