import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

const execAsync = promisify(exec);

export class GrepTool extends BaseTool {
  readonly name = 'grep';
  readonly description = 'Search for a pattern in files using ripgrep. Returns matching lines with file paths and line numbers.';
  readonly riskLevel = 'read' as const;
  readonly categories = ['search' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search for a pattern in files using ripgrep.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'The regex pattern to search for' },
          path: { type: 'string', description: 'Directory or file to search in (defaults to working directory)' },
          glob: { type: 'string', description: 'File glob pattern to filter (e.g., "*.ts")' },
          case_insensitive: { type: 'boolean', description: 'Case insensitive search' },
        },
        required: ['pattern'],
      },
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { pattern, path, glob, case_insensitive } = args as {
      pattern: string;
      path?: string;
      glob?: string;
      case_insensitive?: boolean;
    };

    const searchPath = path || context.workingDirectory;
    const flags: string[] = ['--no-heading', '--line-number'];

    if (case_insensitive) flags.push('--ignore-case');
    if (glob) flags.push('--glob', glob);

    // Limit output to prevent overwhelming
    flags.push('--max-count', '100');

    const cmd = `rg ${flags.map((f) => `'${f}'`).join(' ')} '${pattern.replace(/'/g, "'\\''")}' '${searchPath}'`;

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: context.workingDirectory,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });

      if (stderr && !stdout) {
        return { output: `grep: ${stderr}`, isError: true };
      }

      return {
        output: stdout || 'No matches found.',
        isError: false,
      };
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 1) {
        return { output: 'No matches found.', isError: false };
      }
      return {
        output: `grep error: ${err.message || String(error)}`,
        isError: true,
      };
    }
  }
}
