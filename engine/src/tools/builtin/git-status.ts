import { execFile } from 'child_process';
import { promisify } from 'util';
import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

const execFileAsync = promisify(execFile);

export class GitStatusTool extends BaseTool {
  readonly name = 'git_status';
  readonly description = 'Show the working tree status using git status --porcelain -b. Returns branch name, staged files, modified files, and untracked files.';
  readonly riskLevel = 'read' as const;
  readonly categories = ['system' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Show the working tree status.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  };

  async execute(_args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const workspace = context.workingDirectory;

    try {
      const { stdout: output } = await execFileAsync('git', ['status', '--porcelain', '-b'], {
        cwd: workspace,
        encoding: 'utf-8',
        timeout: 10000,
      });

      const lines = output.trim().split('\n').filter(Boolean);
      let branch = '';
      const staged: string[] = [];
      const modified: string[] = [];
      const untracked: string[] = [];

      for (const line of lines) {
        if (line.startsWith('## ')) {
          branch = line.slice(3).split('...')[0].trim();
          continue;
        }
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        const filePath = line.slice(3);

        if (indexStatus === '?' && workTreeStatus === '?') {
          untracked.push(filePath);
        } else if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(filePath);
        } else if (workTreeStatus !== ' ') {
          modified.push(filePath);
        }
      }

      const parts: string[] = [`Branch: ${branch || 'unknown'}`];
      if (staged.length > 0) parts.push(`Staged (${staged.length}): ${staged.join(', ')}`);
      if (modified.length > 0) parts.push(`Modified (${modified.length}): ${modified.join(', ')}`);
      if (untracked.length > 0) parts.push(`Untracked (${untracked.length}): ${untracked.join(', ')}`);
      if (staged.length === 0 && modified.length === 0 && untracked.length === 0) {
        parts.push('Working tree clean');
      }

      return {
        output: parts.join('\n'),
        isError: false,
        metadata: { branch, staged, modified, untracked },
      };
    } catch (error) {
      return {
        output: `git status error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
