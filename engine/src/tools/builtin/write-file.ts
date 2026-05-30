import { writeFile, mkdir } from 'fs/promises';
import { resolve, relative, dirname } from 'path';
import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

export class WriteFileTool extends BaseTool {
  readonly name = 'write_file';
  readonly description = 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does. Creates parent directories as needed.';
  readonly riskLevel = 'write' as const;
  readonly categories = ['file' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file, creating it if it doesn\'t exist.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Absolute path to the file' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['file_path', 'content'],
      },
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { file_path, content } = args as { file_path: string; content: string };
    const resolved = resolve(file_path);

    const rel = relative(context.workingDirectory, resolved);
    if (rel.startsWith('..')) {
      return { output: 'Error: Path is outside working directory', isError: true };
    }

    try {
      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, 'utf-8');
      context.fileCache.invalidate(resolved);

      const lines = content.split('\n').length;
      return {
        output: `File written successfully: ${resolved} (${lines} lines)`,
        isError: false,
      };
    } catch (error) {
      return {
        output: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
