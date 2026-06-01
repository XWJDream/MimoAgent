import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

const execFileAsync = promisify(execFile);

export class GitCommitTool extends BaseTool {
  readonly name = 'git_commit';
  readonly description = 'Create a git commit. Optionally stages specific files before committing, otherwise stages all changes.';
  readonly riskLevel = 'write' as const;
  readonly categories = ['system' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Create a git commit with a message.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The commit message' },
          files: {
            type: 'array',
            description: 'Optional list of file paths to stage. If omitted, all changes are staged.',
            items: { type: 'string', description: 'File path to stage' },
          },
        },
        required: ['message'],
      },
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const workspace = context.workingDirectory;
    const { message, files } = args as { message: string; files?: string[] };

    if (!message || typeof message !== 'string') {
      return { output: 'Error: commit message is required', isError: true };
    }

    try {
      // Stage files
      if (files && Array.isArray(files) && files.length > 0) {
        await execFileAsync('git', ['add', ...files], {
          cwd: workspace,
          timeout: 10000,
        });
      } else {
        await execFileAsync('git', ['add', '-A'], {
          cwd: workspace,
          timeout: 10000,
        });
      }

      // Commit
      const { stdout: commitOutput } = await execFileAsync('git', ['commit', '-m', message], {
        cwd: workspace,
        encoding: 'utf-8',
        timeout: 10000,
      });

      // Extract commit hash
      const hashMatch = commitOutput.match(/\[[\w-]+ ([a-f0-9]+)\]/);
      const commitHash = hashMatch ? hashMatch[1] : 'unknown';

      return {
        output: `Committed successfully: ${commitHash}\n${commitOutput.trim()}`,
        isError: false,
        metadata: { commitHash },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('nothing to commit')) {
        return { output: 'Nothing to commit, working tree clean', isError: false };
      }
      return {
        output: `git commit error: ${msg}`,
        isError: true,
      };
    }
  }
}
