import { stat } from 'fs/promises';
import { resolve, relative } from 'path';
import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

export class ReadFileTool extends BaseTool {
  readonly name = 'read_file';
  readonly description = 'Read the contents of a file at the given absolute path. Returns content with line numbers.';
  readonly riskLevel = 'read' as const;
  readonly categories = ['file' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the given absolute path.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Absolute path to the file' },
          offset: { type: 'number', description: 'Line number to start from (0-indexed)' },
          limit: { type: 'number', description: 'Max lines to read' },
        },
        required: ['file_path'],
      },
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { file_path, offset, limit } = args as { file_path: string; offset?: number; limit?: number };
    const resolved = resolve(file_path);

    // Security check
    const rel = relative(context.workingDirectory, resolved);
    if (rel.startsWith('..')) {
      return { output: 'Error: Path is outside working directory', isError: true };
    }

    try {
      const stats = await stat(resolved);
      if (stats.isDirectory()) {
        return { output: 'Error: Path is a directory, not a file. Use shell with ls command instead.', isError: true };
      }

      const content = await context.fileCache.getOrLoad(resolved);
      const lines = content.split('\n');
      const start = offset ?? 0;
      const end = limit ? start + limit : lines.length;
      const selected = lines.slice(start, end);

      const formatted = selected.map((line, i) => `${start + i + 1}\t${line}`).join('\n');

      return {
        output: formatted || '(empty file)',
        isError: false,
        metadata: { totalLines: lines.length, start, end: Math.min(end, lines.length) },
      };
    } catch (error) {
      return {
        output: `Error reading file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
