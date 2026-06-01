import { writeFile, mkdir, readFile } from 'fs/promises';
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
      // Read existing content for diff if file exists
      let originalContent: string | null = null;
      try {
        originalContent = await readFile(resolved, 'utf-8');
      } catch {
        // File doesn't exist yet, no diff to show
      }

      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, 'utf-8');
      context.fileCache.invalidate(resolved);

      const lines = content.split('\n').length;

      // Generate diff preview when overwriting an existing file
      const diffLines: string[] = [];
      if (originalContent !== null && originalContent !== content) {
        const oldLines = originalContent.split('\n');
        const newLines = content.split('\n');
        let firstChanged = -1;
        let lastChanged = -1;
        const maxLen = Math.max(oldLines.length, newLines.length);
        for (let i = 0; i < maxLen; i++) {
          if ((oldLines[i] || '') !== (newLines[i] || '')) {
            if (firstChanged === -1) firstChanged = i;
            lastChanged = i;
          }
        }
        if (firstChanged !== -1) {
          const start = Math.max(0, firstChanged - 2);
          const end = Math.min(maxLen - 1, lastChanged + 2);
          for (let i = start; i <= end; i++) {
            if ((oldLines[i] || '') !== (newLines[i] || '')) {
              diffLines.push(`- ${i + 1}: ${oldLines[i] || ''}`);
              diffLines.push(`+ ${i + 1}: ${newLines[i] || ''}`);
            }
          }
        }
      }
      const diffPreview = diffLines.length > 0
        ? '\nDiff:\n' + diffLines.slice(0, 50).join('\n')
        : '';

      return {
        output: `File written successfully: ${resolved} (${lines} lines)${diffPreview}`,
        isError: false,
        metadata: diffLines.length > 0 ? { diff: diffLines.slice(0, 50) } : undefined,
      };
    } catch (error) {
      return {
        output: `Error writing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
