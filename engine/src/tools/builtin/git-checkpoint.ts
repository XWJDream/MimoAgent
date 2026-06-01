import { execSync } from 'child_process';
import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

export class GitCheckpointTool extends BaseTool {
  readonly name = 'git_checkpoint';
  readonly description = 'Create a git stash checkpoint before making changes. Use this before modifying files to enable rollback.';
  readonly riskLevel = 'read' as const;
  readonly categories = ['system' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'git_checkpoint',
      description: 'Create a git stash checkpoint. Returns the stash hash for later rollback.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'A descriptive label for this checkpoint' },
        },
        required: ['label'],
      },
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { label } = args as { label: string };
    try {
      // Check if it's a git repo
      execSync('git rev-parse --is-inside-work-tree', { cwd: context.workingDirectory, stdio: 'pipe' });

      // Create stash with message
      const message = `mimo-checkpoint: ${label}`;
      const result = execSync(`git stash push -m "${message}" --include-untracked`, {
        cwd: context.workingDirectory,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (result.includes('No local changes')) {
        return { output: 'No changes to checkpoint (working tree clean)', isError: false };
      }

      // Get the stash hash
      const hash = execSync('git rev-parse stash@{0}', {
        cwd: context.workingDirectory,
        encoding: 'utf-8',
      }).trim();

      return {
        output: `Checkpoint created: ${hash.slice(0, 8)} ("${label}")\nTo rollback: git stash pop`,
        isError: false,
        metadata: { hash, label },
      };
    } catch (error) {
      return {
        output: `Checkpoint failed: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
