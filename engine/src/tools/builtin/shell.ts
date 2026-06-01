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
    const dangerous = [
      'rm -rf /', 'rm -rf /*', 'mkfs', 'dd if=', ':(){:|:&};:',
      'curl | sh', 'curl | bash', 'wget | sh', 'wget | bash',
      'wget -O- | bash', 'chmod -R 777 /', '> /dev/sda',
      'mv / ', 'rm -rf ~', 'rm -rf $HOME',
    ];
    for (const pattern of dangerous) {
      if (command.includes(pattern)) {
        return { output: `Error: Blocked dangerous command: ${command}`, isError: true };
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
