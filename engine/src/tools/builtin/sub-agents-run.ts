import pLimit from 'p-limit';
import { BaseTool, type ToolContext, type ToolResult } from '../base.js';
import type { ToolDefinition } from '../schema.js';
import type { ToolRegistry } from '../registry.js';
import type { MimoConfig } from '../../config/types.js';
import type { PermissionChecker } from '../../permissions/checker.js';
import { buildSystemPrompt } from '../../context/system-prompt.js';
import { getSubAgent, registerDefaultSubAgents } from '../../sub-agents/index.js';
import type { SubAgent, SubAgentResult, SubAgentContext } from '../../core/sub-agent.js';

export type SubAgentName = 'coder' | 'reviewer' | 'tester' | 'docgen' | 'architect';

interface SubAgentTask {
  agent: SubAgentName;
  task: string;
}

interface SubAgentsRunToolOptions {
  mimoConfig: MimoConfig;
  parentRegistry: ToolRegistry;
  getPermissionChecker?: () => PermissionChecker | null;
  resolveSubAgent?: (name: string) => SubAgent | undefined;
  llmClientFactory?: SubAgentContext['llmClientFactory'];
}

interface SubAgentRunRecord {
  index: number;
  agent: string;
  task: string;
  success: boolean;
  result?: SubAgentResult;
  error?: string;
}

export class SubAgentsRunTool extends BaseTool {
  readonly name = 'sub_agents_run';
  readonly description = 'Delegate one or more tasks to specialized sub-agents and return their summaries.';
  readonly riskLevel = 'execute' as const;
  readonly categories = ['task' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'sub_agents_run',
      description: 'Run one or more specialized sub-agents concurrently.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            description: 'Tasks to delegate to specialized sub-agents.',
            items: {
              type: 'object',
              description: 'A single sub-agent task.',
              properties: {
                agent: {
                  type: 'string',
                  enum: ['coder', 'reviewer', 'tester', 'docgen', 'architect'],
                  description: 'The specialized sub-agent to run.',
                },
                task: { type: 'string', description: 'The task prompt for the sub-agent.' },
              },
            },
          },
        },
        required: ['tasks'],
      },
    },
  };

  constructor(private readonly options: SubAgentsRunToolOptions) {
    super();
    registerDefaultSubAgents();
  }

  async execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    if (!this.options.mimoConfig.subAgents?.enabled) {
      return { output: 'Sub-agents are disabled in the current configuration.', isError: true };
    }

    const tasks = this.parseTasks(args.tasks);
    if (tasks.length === 0) {
      return { output: 'No valid sub-agent tasks were provided.', isError: true };
    }

    const limit = pLimit(Math.max(1, this.options.mimoConfig.subAgents.maxConcurrent || 1));
    const baseSystemPrompt = buildSystemPrompt(this.options.mimoConfig, '', context.workingDirectory);

    const records = await Promise.all(
      tasks.map((task, index) =>
        limit(() => this.runTask(task, index, context, baseSystemPrompt)),
      ),
    );

    const lines = records.map((record) => {
      if (!record.success) {
        return `[${record.index + 1}] ${record.agent}: ERROR - ${record.error}`;
      }
      return `[${record.index + 1}] ${record.agent}: ${record.result?.summary || '(no summary)'}`;
    });

    return {
      output: lines.join('\n'),
      isError: records.some((record) => !record.success),
      metadata: { results: records },
    };
  }

  private parseTasks(value: unknown): SubAgentTask[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const { agent, task } = item as { agent?: unknown; task?: unknown };
      if (typeof agent !== 'string' || typeof task !== 'string' || task.trim().length === 0) {
        return [];
      }
      return [{ agent: agent as SubAgentName, task }];
    });
  }

  private async runTask(
    task: SubAgentTask,
    index: number,
    context: ToolContext,
    baseSystemPrompt: string,
  ): Promise<SubAgentRunRecord> {
    const subAgent = (this.options.resolveSubAgent ?? getSubAgent)(task.agent);
    if (!subAgent) {
      return {
        index,
        agent: task.agent,
        task: task.task,
        success: false,
        error: `Unknown sub-agent: ${task.agent}`,
      };
    }

    try {
      const result = await subAgent.run(task.task, {
        baseSystemPrompt,
        toolDefinitions: this.options.parentRegistry
          .getDefinitions()
          .filter((definition) => definition.function.name !== this.name),
        workingDirectory: context.workingDirectory,
        mimoConfig: this.options.mimoConfig,
        toolRegistry: this.options.parentRegistry,
        toolContext: context,
        permissionChecker: this.options.getPermissionChecker?.() ?? null,
        abortSignal: context.abortSignal,
        llmClientFactory: this.options.llmClientFactory,
      });

      return {
        index,
        agent: task.agent,
        task: task.task,
        success: true,
        result,
      };
    } catch (error) {
      return {
        index,
        agent: task.agent,
        task: task.task,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
