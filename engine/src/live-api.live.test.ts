import { describe, expect, it } from 'vitest';
import { getDefaultConfig } from './config/defaults.js';
import { Agent } from './core/agent.js';
import { FileCache } from './context/file-cache.js';
import { ToolRegistry } from './tools/registry.js';
import { ReadFileTool } from './tools/builtin/read-file.js';
import { GrepTool } from './tools/builtin/grep.js';
import { GlobTool } from './tools/builtin/glob.js';
import { SubAgentsRunTool } from './tools/builtin/sub-agents-run.js';

const liveEnabled = process.env.MIMO_LIVE_TESTS === '1' && !!process.env.MIMO_API_KEY;

function liveConfig() {
  return {
    ...getDefaultConfig(),
    apiKey: process.env.MIMO_API_KEY || '',
    maxTokens: 512,
    maxTurns: 6,
    stream: false,
    permissionMode: 'auto-edit' as const,
    toolPreset: 'act' as const,
    subAgents: { enabled: true, maxConcurrent: 2 },
  };
}

describe.skipIf(!liveEnabled)('live API smoke tests', () => {
  it('runs a normal agent turn and records cached token fields safely', async () => {
    const agent = new Agent(liveConfig(), process.cwd());
    const events = [];

    for await (const event of agent.run('Reply with exactly: live-ok', { streaming: false, maxTurns: 1 })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'text')).toBe(true);
    expect(events.at(-1)?.type).toBe('done');
    expect(agent.getUsageTracker().getSessionStats().sessionCachedTokens).toBeGreaterThanOrEqual(0);
  });

  it('runs reviewer and tester sub-agents through sub_agents_run without shell/write tools', async () => {
    const registry = new ToolRegistry();
    registry.register(new ReadFileTool());
    registry.register(new GrepTool());
    registry.register(new GlobTool());
    registry.setContext({ workingDirectory: process.cwd(), fileCache: new FileCache() });

    const tool = new SubAgentsRunTool({
      mimoConfig: liveConfig(),
      parentRegistry: registry,
    });

    const result = await tool.execute({
      tasks: [
        { agent: 'reviewer', task: 'Read-only smoke test: summarize the repository purpose in one sentence. Do not modify files.' },
        { agent: 'tester', task: 'Read-only smoke test: suggest one test area. Do not modify files or run shell commands.' },
      ],
    }, { workingDirectory: process.cwd(), fileCache: new FileCache() });

    expect(result.isError).toBe(false);
    expect(result.metadata?.results).toMatchObject([
      { agent: 'reviewer', success: true },
      { agent: 'tester', success: true },
    ]);
  });

  it('handles abort without an unhandled exception', async () => {
    const agent = new Agent(liveConfig(), process.cwd());
    const controller = new AbortController();
    controller.abort();
    const events = [];

    for await (const event of agent.run('This should stop immediately.', {
      streaming: false,
      maxTurns: 1,
      abortSignal: controller.signal,
    })) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'error', message: 'Agent run stopped' }]);
  });
});
