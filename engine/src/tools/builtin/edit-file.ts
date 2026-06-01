import { readFile, writeFile } from 'fs/promises';
import { resolve, relative } from 'path';
import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

export class EditFileTool extends BaseTool {
  readonly name = 'edit_file';
  readonly description = 'Edit a file by replacing old_string with new_string. The old_string must be unique in the file.';
  readonly riskLevel = 'write' as const;
  readonly categories = ['file' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edit a file by replacing old_string with new_string. The old_string must be unique in the file.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Absolute path to the file' },
          old_string: { type: 'string', description: 'The exact string to find and replace' },
          new_string: { type: 'string', description: 'The string to replace old_string with' },
        },
        required: ['file_path', 'old_string', 'new_string'],
      },
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { file_path, old_string, new_string } = args as {
      file_path: string;
      old_string: string;
      new_string: string;
    };
    const resolved = resolve(file_path);

    const rel = relative(context.workingDirectory, resolved);
    if (rel.startsWith('..')) {
      return { output: 'Error: Path is outside working directory', isError: true };
    }

    if (old_string === new_string) {
      return { output: 'Error: old_string and new_string are identical', isError: true };
    }

    try {
      const originalContent = await readFile(resolved, 'utf-8');

      const count = originalContent.split(old_string).length - 1;
      if (count === 0) {
        return { output: 'Error: old_string not found in file', isError: true };
      }
      if (count > 1) {
        return {
          output: `Error: old_string found ${count} times. It must be unique. Provide more context to make it unique.`,
          isError: true,
        };
      }

      const newContent = originalContent.replace(old_string, new_string);
      await writeFile(resolved, newContent, 'utf-8');
      context.fileCache.invalidate(resolved);

      // Generate diff preview
      const oldLines = originalContent.split('\n');
      const updatedLines = newContent.split('\n');
      const diffLines: string[] = [];
      let firstChanged = -1;
      let lastChanged = -1;
      const maxLen = Math.max(oldLines.length, updatedLines.length);
      for (let i = 0; i < maxLen; i++) {
        if ((oldLines[i] || '') !== (updatedLines[i] || '')) {
          if (firstChanged === -1) firstChanged = i;
          lastChanged = i;
        }
      }
      if (firstChanged !== -1) {
        const start = Math.max(0, firstChanged - 2);
        const end = Math.min(maxLen - 1, lastChanged + 2);
        for (let i = start; i <= end; i++) {
          if ((oldLines[i] || '') !== (updatedLines[i] || '')) {
            diffLines.push(`- ${i + 1}: ${oldLines[i] || ''}`);
            diffLines.push(`+ ${i + 1}: ${updatedLines[i] || ''}`);
          }
        }
      }
      const diffPreview = diffLines.length > 0
        ? '\nDiff:\n' + diffLines.slice(0, 50).join('\n')
        : '';

      return {
        output: `File edited successfully: ${resolved}${diffPreview}`,
        isError: false,
        metadata: { diff: diffLines.slice(0, 50) },
      };
    } catch (error) {
      return {
        output: `Error editing file: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
