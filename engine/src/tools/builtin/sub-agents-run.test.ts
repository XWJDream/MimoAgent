import { describe, expect, it } from 'vitest';
import { getDefaultConfig } from '../../config/defaults.js';
import type { SubAgentResult } from '../../core/sub-agent.js';
import { ToolRegistry } from '../registry.js';
import { SubAgentsRunTool } from './sub-agents-run.js';

function context() {
  return { workingDirectory: process.cwd(), fileCache: {} as never };
}

function config(overrides: Partial<ReturnType<typeof getDefaultConfig>> = {}) {
  return {
    ...getDefaultConfig(),
    subAgents: { enabled: true, maxConcurrent: 2 },
    ...overrides,
  };
}

describe('SubAgentsRunTool', () => {
  it('refuses to run when sub-agents are disabled', async () => {
    const tool = new SubAgentsRunTool({
      mimoConfig: config({ subAgents: { enabled: false, maxConcurrent: 1 } }),
      parentRegistry: new ToolRegistry(),
    });

    const result = await tool.execute({ tasks: [{ agent: 'reviewer', task: 'review' }] }, context());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('disabled');
  });

  it('reports unknown sub-agents in structured metadata', async () => {
    const tool = new SubAgentsRunTool({
      mimoConfig: config(),
      parentRegistry: new ToolRegistry(),
      resolveSubAgent: () => undefined,
    });

    const result = await tool.execute({ tasks: [{ agent: 'missing', task: 'work' }] }, context());

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Unknown sub-agent');
    expect(result.metadata?.results).toMatchObject([
      { index: 0, agent: 'missing', success: false },
    ]);
  });

  it('respects maxConcurrent while preserving result order', async () => {
    let active = 0;
    let maxActive = 0;
    const makeSubAgent = (delay: number, summary: string) => ({
      run: async (): Promise<SubAgentResult> => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, delay));
        active--;
        return { summary, details: summary, artifacts: [] };
      },
    });
    const agents = [
      makeSubAgent(20, 'first'),
      makeSubAgent(1, 'second'),
      makeSubAgent(1, 'third'),
    ];
    const tool = new SubAgentsRunTool({
      mimoConfig: config({ subAgents: { enabled: true, maxConcurrent: 2 } }),
      parentRegistry: new ToolRegistry(),
      resolveSubAgent: () => agents.shift() as never,
    });

    const result = await tool.execute({
      tasks: [
        { agent: 'reviewer', task: 'one' },
        { agent: 'tester', task: 'two' },
        { agent: 'architect', task: 'three' },
      ],
    }, context());

    expect(result.isError).toBe(false);
    expect(maxActive).toBe(2);
    expect(result.output.split('\n')).toEqual([
      '[1] reviewer: first',
      '[2] tester: second',
      '[3] architect: third',
    ]);
    expect(result.metadata?.results).toMatchObject([
      { index: 0, success: true },
      { index: 1, success: true },
      { index: 2, success: true },
    ]);
  });
});
