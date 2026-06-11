import type { BaseTool, ToolResult, ToolContext, RiskLevel, ToolCategory } from '../base.js';
import type { ToolDefinition } from '../schema.js';
import type { MemoryService, SearchResult } from '../../memory/service.js';

export class MemorySearchTool implements BaseTool {
  readonly name = 'memory_search';
  readonly description = 'Search through project memories using full-text search. Use this to recall previous decisions, architecture notes, session checkpoints, or any stored knowledge.';
  readonly riskLevel: RiskLevel = 'read';
  readonly categories: ToolCategory[] = ['search'];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'memory_search',
      description: 'Search through project memories using full-text search (FTS5). Returns relevant memory entries ranked by relevance.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query. Can be natural language or keywords.',
          },
          scope: {
            type: 'string',
            description: 'Filter by memory scope: global, project, or session.',
            enum: ['global', 'project', 'session'],
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5).',
          },
        },
        required: ['query'],
      },
    },
  };

  private memoryService: MemoryService | null = null;

  setMemoryService(service: MemoryService): void {
    this.memoryService = service;
  }

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const query = args.query as string;
    const scope = args.scope as string | undefined;
    const limit = (args.limit as number) || 5;

    if (!this.memoryService) {
      return {
        output: 'Memory service is not initialized.',
        isError: true,
      };
    }

    if (!query?.trim()) {
      return {
        output: 'Query is required.',
        isError: true,
      };
    }

    try {
      const results = this.memoryService.search(query, {
        limit,
        scope: scope as 'global' | 'project' | 'session' | undefined,
      });

      if (results.length === 0) {
        return {
          output: 'No matching memories found.',
          isError: false,
        };
      }

      const formatted = results
        .map((r: SearchResult, i: number) => {
          const preview = r.body.length > 300 ? r.body.slice(0, 300) + '...' : r.body;
          return `[${i + 1}] (${r.scope}/${r.type}) score=${r.score.toFixed(2)}\n${preview}`;
        })
        .join('\n\n---\n\n');

      return {
        output: `Found ${results.length} matching memories:\n\n${formatted}`,
        isError: false,
      };
    } catch (err) {
      return {
        output: `Memory search failed: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  }
}
