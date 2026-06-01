import { describe, expect, it, vi } from 'vitest';
import { getDefaultConfig } from '../config/defaults.js';
import { BaseTool, type ToolContext, type ToolResult } from '../tools/base.js';
import type { ToolDefinition } from '../tools/schema.js';
import { ToolRegistry } from '../tools/registry.js';
import { ReviewerSubAgent } from './sub-agent.js';

class NamedTool extends BaseTool {
  readonly description = 'named tool';
  readonly riskLevel = 'read' as const;
  readonly categories;
  readonly parameters: ToolDefinition;

  constructor(readonly name: string, categories: Array<'file' | 'search' | 'task'>, private readonly output = name) {
    super();
    this.categories = categories;
    this.parameters = {
      type: 'function',
      function: {
        name,
        description: 'named tool',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    };
  }

  async execute(_args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    return { output: this.output, isError: false };
  }
}

function parentRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new NamedTool('read_file', ['file'], 'file content'));
  registry.register(new NamedTool('write_file', ['file']));
  registry.register(new NamedTool('grep', ['search']));
  registry.register(new NamedTool('sub_agents_run', ['task']));
  registry.setContext({ workingDirectory: process.cwd(), fileCache: {} as never });
  return registry;
}

describe('SubAgent', () => {
  it('builds the prompt and filters tools by the sub-agent allowlist', async () => {
    const seen = { systemPrompt: '', toolNames: [] as string[] };
    const fakeLlm = {
      chat: vi.fn(async (messages: { content: string | null }[], tools?: ToolDefinition[]) => {
        seen.systemPrompt = messages[0].content || '';
        seen.toolNames = tools?.map((tool) => tool.function.name) ?? [];
        return {
          content: 'review summary',
          toolCalls: null,
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          finishReason: 'stop' as const,
        };
      }),
      chatStream: vi.fn(),
    };

    const agent = new ReviewerSubAgent();
    const registry = parentRegistry();
    const result = await agent.run('review this', {
      baseSystemPrompt: 'BASE PROMPT',
      toolDefinitions: registry.getDefinitions(),
      workingDirectory: process.cwd(),
      mimoConfig: getDefaultConfig(),
      toolRegistry: registry,
      toolContext: { workingDirectory: process.cwd(), fileCache: {} as never },
      llmClientFactory: () => fakeLlm,
    });

    expect(result.summary).toContain('review summary');
    expect(seen.systemPrompt).toContain('BASE PROMPT');
    expect(seen.systemPrompt).toContain('code review specialist');
    expect(seen.toolNames).toEqual(['read_file', 'grep']);
    expect(seen.toolNames).not.toContain('write_file');
    expect(seen.toolNames).not.toContain('sub_agents_run');
  });

  it('passes permission checks through the child agent loop', async () => {
    const fakeLlm = {
      chat: vi.fn()
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [{ id: 'tc_1', name: 'read_file', arguments: { file_path: 'README.md' } }],
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          finishReason: 'tool_calls',
        })
        .mockResolvedValueOnce({
          content: 'done',
          toolCalls: null,
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          finishReason: 'stop',
        }),
      chatStream: vi.fn(),
    };
    const permissionChecker = {
      check: vi.fn().mockResolvedValue({ allowed: true }),
    };
    const registry = parentRegistry();

    const result = await new ReviewerSubAgent().run('read first', {
      baseSystemPrompt: 'BASE',
      toolDefinitions: registry.getDefinitions(),
      workingDirectory: process.cwd(),
      mimoConfig: getDefaultConfig(),
      toolRegistry: registry,
      toolContext: { workingDirectory: process.cwd(), fileCache: {} as never },
      permissionChecker: permissionChecker as never,
      llmClientFactory: () => fakeLlm,
    });

    expect(permissionChecker.check).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'read_file' }));
    expect(result.details).toContain('done');
  });
});
