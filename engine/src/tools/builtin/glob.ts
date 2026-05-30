import { readdirSync } from 'fs';
import { join, relative } from 'path';
import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

export class GlobTool extends BaseTool {
  readonly name = 'glob';
  readonly description = 'Find files matching a glob pattern. Returns sorted file paths.';
  readonly riskLevel = 'read' as const;
  readonly categories = ['search' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files matching a glob pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.test.js")' },
          path: { type: 'string', description: 'Directory to search in (defaults to working directory)' },
        },
        required: ['pattern'],
      },
    },
  };

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { pattern, path: searchPath } = args as { pattern: string; path?: string };
    const rootDir = searchPath || context.workingDirectory;
    const maxResults = 200;

    try {
      // Simple glob matching - convert glob to regex
      const globToRegex = (glob: string) => {
        const escaped = glob
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*/g, '<<GLOBSTAR>>')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '[^/]')
          .replace(/<<GLOBSTAR>>/g, '.*');
        return new RegExp(`^${escaped}$`);
      };

      const regex = globToRegex(pattern);
      const results: string[] = [];

      const walk = (dir: string, depth: number = 0) => {
        if (depth > 10 || results.length >= maxResults) return;
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= maxResults) break;
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = join(dir, entry.name);
            const relPath = relative(rootDir, fullPath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
              walk(fullPath, depth + 1);
            } else if (regex.test(relPath) || regex.test(entry.name)) {
              results.push(relPath);
            }
          }
        } catch { /* skip unreadable dirs */ }
      };

      walk(rootDir);

      return {
        output: results.length > 0 ? results.join('\n') : 'No files found',
        isError: false,
        metadata: { count: results.length },
      };
    } catch (error) {
      return {
        output: `glob error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}
