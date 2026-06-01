import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatResponse } from '../llm/types.js';
import type { ToolDefinition } from '../tools/schema.js';
import { BaseTool, type ToolContext, type ToolResult } from '../tools/base.js';
import { ToolRegistry } from '../tools/registry.js';
import { agentLoop, type LoopEvent } from './agent-loop.js';

class FakeTool extends BaseTool {
  readonly description = 'fake tool';
  readonly riskLevel = 'read' as const;
  readonly categories = ['system' as const];
  readonly parameters: ToolDefinition;

  constructor(readonly name: string, private readonly executeFn: (args: Record<string, unknown>) => ToolResult) {
    super();
    this.parameters = {
      type: 'function',
      function: {
        name,
        description: 'fake tool',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    };
  }

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    return this.executeFn(args);
  }
}

function response(partial: Partial<ChatResponse>): ChatResponse {
  return {
    content: null,
    toolCalls: null,
    usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3, cachedTokens: 0 },
    finishReason: 'stop',
    ...partial,
  };
}

function registry(tool: FakeTool): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(tool);
  registry.setContext({ workingDirectory: process.cwd(), fileCache: {} as never });
  return registry;
}

async function collect(stream: AsyncGenerator<LoopEvent>): Promise<LoopEvent[]> {
  const events: LoopEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('agentLoop', () => {
  it('runs tool calls and reports cached token usage', async () => {
    const onUsage = vi.fn();
    const tool = new FakeTool('lookup', (args) => ({ output: `ok ${args.value}`, isError: false }));
    const llm = {
      chat: vi.fn()
        .mockResolvedValueOnce(response({
          toolCalls: [{ id: 'tc_1', name: 'lookup', arguments: { value: 42 } }],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cachedTokens: 7 },
          finishReason: 'tool_calls',
        }))
        .mockResolvedValueOnce(response({ content: 'done' })),
      chatStream: vi.fn(),
    };

    const messages: ChatMessage[] = [{ role: 'user', content: 'go' }];
    const events = await collect(agentLoop(messages, [tool.parameters], llm, registry(tool), null, {
      maxTurns: 5,
      streaming: false,
      onUsage,
    }));

    expect(events.map((event) => event.type)).toEqual(['tool_start', 'tool_result', 'text', 'done']);
    expect(onUsage).toHaveBeenCalledWith(10, 5, 7);
    expect(messages.at(-1)?.role).toBe('tool');
  });

  it('returns a tool result instead of executing when permission is denied', async () => {
    const executeFn = vi.fn(() => ({ output: 'should not run', isError: false }));
    const tool = new FakeTool('blocked', executeFn);
    const llm = {
      chat: vi.fn().mockResolvedValue(response({
        toolCalls: [{ id: 'tc_1', name: 'blocked', arguments: {} }],
        finishReason: 'tool_calls',
      })),
      chatStream: vi.fn(),
    };
    const permissionChecker = {
      check: vi.fn().mockResolvedValue({ allowed: false, reason: 'nope' }),
    };

    const events = await collect(agentLoop([{ role: 'user', content: 'go' }], [tool.parameters], llm, registry(tool), permissionChecker as never, {
      maxTurns: 1,
      streaming: false,
    }));

    expect(executeFn).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({ type: 'tool_result', result: { isError: true } });
  });

  it('applies beforeTool and afterTool hooks', async () => {
    const tool = new FakeTool('hooked', (args) => ({ output: `value ${args.value}`, isError: false }));
    const llm = {
      chat: vi.fn().mockResolvedValue(response({
        toolCalls: [{ id: 'tc_1', name: 'hooked', arguments: { value: 'old' } }],
        finishReason: 'tool_calls',
      })),
      chatStream: vi.fn(),
    };

    const events = await collect(agentLoop([{ role: 'user', content: 'go' }], [tool.parameters], llm, registry(tool), null, {
      maxTurns: 1,
      streaming: false,
      hooks: {
        beforeTool: async () => ({ modifiedArgs: { value: 'new' } }),
        afterTool: async () => ({ modifiedResult: { output: 'changed', isError: false } }),
      },
    }));

    expect(events[0]).toMatchObject({ type: 'tool_start' });
    expect(events[1]).toMatchObject({ type: 'tool_result', result: { output: 'changed' } });
  });

  it('stops immediately when aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const events = await collect(agentLoop([{ role: 'user', content: 'go' }], [], { chat: vi.fn(), chatStream: vi.fn() }, new ToolRegistry(), null, {
      maxTurns: 1,
      streaming: false,
      abortSignal: controller.signal,
    }));

    expect(events).toEqual([{ type: 'error', message: 'Agent run stopped' }]);
  });

  it('detects repeated identical tool calls', async () => {
    const tool = new FakeTool('repeat', () => ({ output: 'again', isError: false }));
    const llm = {
      chat: vi.fn().mockResolvedValue(response({
        toolCalls: [{ id: 'tc_1', name: 'repeat', arguments: { same: true } }],
        finishReason: 'tool_calls',
      })),
      chatStream: vi.fn(),
    };

    const events = await collect(agentLoop([{ role: 'user', content: 'go' }], [tool.parameters], llm, registry(tool), null, {
      maxTurns: 10,
      streaming: false,
    }));

    expect(events.at(-1)).toMatchObject({ type: 'error', message: expect.stringContaining('loop detected') });
  });

  it('reports max turns when the model keeps requesting different tools', async () => {
    const tool = new FakeTool('turn', () => ({ output: 'ok', isError: false }));
    let count = 0;
    const llm = {
      chat: vi.fn().mockImplementation(() => response({
        toolCalls: [{ id: `tc_${count}`, name: 'turn', arguments: { count: count++ } }],
        finishReason: 'tool_calls',
      })),
      chatStream: vi.fn(),
    };

    const events = await collect(agentLoop([{ role: 'user', content: 'go' }], [tool.parameters], llm, registry(tool), null, {
      maxTurns: 2,
      streaming: false,
    }));

    expect(events.at(-1)).toEqual({ type: 'error', message: 'Max turns (2) exceeded' });
  });
});
