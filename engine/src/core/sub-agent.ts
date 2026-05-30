import type { ToolCategory } from '../tools/base.js';
import type { ToolDefinition } from '../tools/schema.js';
import type { MimoConfig } from '../config/types.js';
import { LLMClient } from '../llm/client.js';
import { agentLoop } from './agent-loop.js';
import { buildSystemPrompt } from '../context/system-prompt.js';
import type { ChatMessage } from '../llm/types.js';
import { ToolRegistry } from '../tools/registry.js';

export interface SubAgentConfig {
  name: string;
  description: string;
  systemPromptSuffix: string;
  allowedToolCategories: ToolCategory[];
  allowedTools?: string[];
  maxTurns: number;
  temperature?: number;
}

export interface SubAgentResult {
  summary: string;
  details: string;
  artifacts: Array<{ path: string; action: 'created' | 'modified' | 'deleted' }>;
}

export interface SubAgentContext {
  baseSystemPrompt: string;
  toolDefinitions: ToolDefinition[];
  workingDirectory: string;
  mimoConfig: MimoConfig;
  toolRegistry?: ToolRegistry;
}

export abstract class SubAgent {
  abstract readonly config: SubAgentConfig;

  async run(task: string, context: SubAgentContext): Promise<SubAgentResult> {
    const systemPrompt =
      buildSystemPrompt(context.mimoConfig, '', context.workingDirectory) +
      '\n\n' +
      this.config.systemPromptSuffix;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task },
    ];

    const llmClient = new LLMClient({
      apiKey: context.mimoConfig.apiKey,
      baseUrl: context.mimoConfig.apiBase,
      model: context.mimoConfig.model,
      maxTokens: context.mimoConfig.maxTokens,
      temperature: this.config.temperature ?? context.mimoConfig.temperature,
      timeout: 60000,
    });

    // Build a real tool registry from the parent's registry, filtered by allowed categories
    const toolRegistry = new ToolRegistry();
    if (context.toolRegistry) {
      for (const tool of context.toolRegistry.getAll()) {
        if (
          this.config.allowedToolCategories.length === 0 ||
          this.config.allowedToolCategories.some((cat) => tool.categories.includes(cat))
        ) {
          toolRegistry.register(tool);
        }
      }
    }

    let fullOutput = '';
    const stream = agentLoop(
      messages,
      context.toolDefinitions,
      llmClient,
      toolRegistry,
      null,
      {
        maxTurns: this.config.maxTurns,
        streaming: false,
      },
    );

    for await (const event of stream) {
      if (event.type === 'text') {
        fullOutput += event.content;
      }
    }

    return {
      summary: fullOutput.split('\n').slice(0, 3).join(' ').slice(0, 200),
      details: fullOutput,
      artifacts: [],
    };
  }
}

// Built-in sub-agent: Coder
export class CoderSubAgent extends SubAgent {
  readonly config: SubAgentConfig = {
    name: 'coder',
    description: 'Code writing specialist',
    systemPromptSuffix:
      'You are a code-writing specialist. Write clean, well-structured code. Always read existing files before modifying them. Follow the project\'s coding style and conventions.',
    allowedToolCategories: ['file', 'search'],
    maxTurns: 30,
    temperature: 0.2,
  };
}

// Built-in sub-agent: Reviewer
export class ReviewerSubAgent extends SubAgent {
  readonly config: SubAgentConfig = {
    name: 'reviewer',
    description: 'Code review specialist',
    systemPromptSuffix:
      'You are a code review specialist. Analyze code for bugs, style issues, security vulnerabilities, and improvements. Read files but do not modify them. Provide specific, actionable feedback.',
    allowedToolCategories: ['file', 'search'],
    maxTurns: 10,
    temperature: 0.1,
  };
}

// Built-in sub-agent: Tester
export class TesterSubAgent extends SubAgent {
  readonly config: SubAgentConfig = {
    name: 'tester',
    description: 'Test generation specialist',
    systemPromptSuffix:
      'You are a test generation specialist. Write comprehensive unit and integration tests. Use the project\'s existing test framework. Aim for high coverage of edge cases.',
    allowedToolCategories: ['file', 'search', 'shell'],
    maxTurns: 20,
    temperature: 0.3,
  };
}

// Built-in sub-agent: DocGen
export class DocGenSubAgent extends SubAgent {
  readonly config: SubAgentConfig = {
    name: 'docgen',
    description: 'Documentation generation specialist',
    systemPromptSuffix:
      'You are a documentation specialist. Generate clear, accurate documentation. Read code to understand functionality. Write README, API docs, and inline comments where needed.',
    allowedToolCategories: ['file', 'search'],
    maxTurns: 15,
    temperature: 0.4,
  };
}

// Built-in sub-agent: Architect
export class ArchitectSubAgent extends SubAgent {
  readonly config: SubAgentConfig = {
    name: 'architect',
    description: 'Architecture design specialist',
    systemPromptSuffix:
      'You are an architecture design specialist. Analyze codebases, design system structures, and propose improvements. Focus on modularity, scalability, and maintainability.',
    allowedToolCategories: ['file', 'search', 'task'],
    maxTurns: 15,
    temperature: 0.5,
  };
}
