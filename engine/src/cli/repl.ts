import * as readline from 'readline';
import type { MimoConfig } from '../config/types.js';
import { Agent } from '../core/agent.js';
import type { LoopEvent } from '../core/agent-loop.js';
import { CodexRenderer } from '../tui/renderer.js';
import { renderBox } from '../tui/box.js';
import { compactMessages, estimateConversationTokens } from '../context/compaction.js';
import { darkTheme as theme } from '../tui/theme.js';

const renderer = new CodexRenderer();

const SLASH_COMMANDS: Record<
  string,
  { description: string; handler: (args: string, agent: Agent, config: MimoConfig) => Promise<void> }
> = {
  '/help': {
    description: 'Show available commands',
    handler: async () => {
      const lines = [
        theme.accent('/help') + theme.muted('        Show this help message'),
        theme.accent('/clear') + theme.muted('       Clear conversation history'),
        theme.accent('/compact') + theme.muted('      Manually compact conversation history'),
        theme.accent('/config') + theme.muted('       Show current configuration'),
        theme.accent('/tools') + theme.muted('        List available tools'),
        theme.accent('/usage') + theme.muted('        Show token usage statistics'),
        theme.accent('/memory') + theme.muted('       Show project memory'),
        theme.accent('/model') + theme.muted('        Switch model'),
        theme.accent('/permissions') + theme.muted('  Change permission mode'),
        theme.accent('/quit') + theme.muted('         Exit MimoAgent'),
      ];
      console.log(renderBox(lines, { title: 'Commands', padding: 1 }));
    },
  },
  '/clear': {
    description: 'Clear conversation history',
    handler: async (_args, agent) => {
      agent.clearConversation();
      console.log(theme.success('\n✔ Conversation cleared.\n'));
    },
  },
  '/compact': {
    description: 'Compact conversation history',
    handler: async (_args, agent) => {
      const conversation = agent.getConversation();
      const config = agent.getConfig();

      renderer.renderCompactStart();

      const result = await compactMessages(conversation, null, {
        maxTokens: config.contextWindow * 0.7,
        keepRecentCount: 6,
      });

      agent.setConversation(result.messages);

      renderer.renderCompactResult(result.originalTokens, result.compactedTokens);
    },
  },
  '/config': {
    description: 'Show current configuration',
    handler: async (_args, agent) => {
      const config = agent.getConfig();
      const lines = [
        theme.muted('Model:            ') + theme.text(config.model),
        theme.muted('API Base:         ') + theme.text(config.apiBase),
        theme.muted('Permission Mode:  ') + theme.text(config.permissionMode),
        theme.muted('Max Turns:        ') + theme.text(String(config.maxTurns)),
        theme.muted('Temperature:      ') + theme.text(String(config.temperature)),
        theme.muted('Context Window:   ') + theme.text(config.contextWindow.toLocaleString() + ' tokens'),
        theme.muted('Max Output:       ') + theme.text(config.maxTokens.toLocaleString() + ' tokens'),
        theme.muted('Stream:           ') + theme.text(config.stream ? 'on' : 'off'),
      ];
      console.log(renderBox(lines, { title: 'Configuration', padding: 1 }));
    },
  },
  '/tools': {
    description: 'List available tools',
    handler: async (_args, agent) => {
      const tools = agent.getToolRegistry().getNames();
      const lines = tools.map((t) => theme.accent('• ') + theme.text(t));
      console.log(renderBox(lines, { title: 'Tools', padding: 1 }));
    },
  },
  '/usage': {
    description: 'Show token usage statistics',
    handler: async (_args, agent) => {
      const tracker = agent.getUsageTracker();
      const stats = tracker.getStats();
      const lines = [
        theme.primary.bold('Session'),
        theme.muted('  API Calls:      ') + theme.text(String(stats.sessionRecords)),
        theme.muted('  Prompt Tokens:  ') + theme.text(stats.sessionPromptTokens.toLocaleString()),
        theme.muted('  Output Tokens:  ') + theme.text(stats.sessionCompletionTokens.toLocaleString()),
        theme.muted('  Total Tokens:   ') + theme.text(stats.sessionTokens.toLocaleString()),
        theme.muted('  Tool Calls:     ') + theme.text(String(stats.sessionToolCalls)),
        theme.muted('  Est. Cost:      ') + theme.text('$' + stats.sessionEstimatedCost.toFixed(4)),
        '',
        theme.primary.bold('All Time'),
        theme.muted('  API Calls:      ') + theme.text(String(stats.totalRecords)),
        theme.muted('  Prompt Tokens:  ') + theme.text(stats.totalPromptTokens.toLocaleString()),
        theme.muted('  Output Tokens:  ') + theme.text(stats.totalCompletionTokens.toLocaleString()),
        theme.muted('  Total Tokens:   ') + theme.text(stats.totalTokens.toLocaleString()),
        theme.muted('  Tool Calls:     ') + theme.text(String(stats.totalToolCalls)),
        theme.muted('  Est. Cost:      ') + theme.text('$' + stats.totalEstimatedCost.toFixed(4)),
      ];

      if (Object.keys(stats.byModel).length > 0) {
        lines.push('', theme.primary.bold('By Model'));
        for (const [model, data] of Object.entries(stats.byModel)) {
          lines.push(
            theme.muted('  ') +
              theme.text(model) +
              theme.muted(': ') +
              theme.text(data.tokens.toLocaleString()) +
              theme.muted(' tokens, ') +
              theme.text('$' + data.cost.toFixed(4)),
          );
        }
      }

      console.log(renderBox(lines, { title: 'Usage Statistics', padding: 1 }));
    },
  },
  '/memory': {
    description: 'Show project memory',
    handler: async (_args, agent) => {
      const memory = agent.getMemory();
      const content = memory.getContent();
      if (content) {
        console.log(renderBox(content.split('\n'), { title: 'Project Memory', padding: 1 }));
      } else {
        console.log(theme.muted('\nNo project memory saved yet.\n'));
      }
    },
  },
  '/model': {
    description: 'Switch model',
    handler: async (args) => {
      if (args) {
        console.log(theme.success(`\n✔ Model set to: ${args}\n`));
      } else {
        console.log(theme.muted('\nUsage: /model <model-name>\n'));
      }
    },
  },
  '/permissions': {
    description: 'Change permission mode',
    handler: async (args) => {
      const modes = ['suggest', 'auto-edit', 'full-auto'];
      if (modes.includes(args)) {
        console.log(theme.success(`\n✔ Permission mode set to: ${args}\n`));
      } else {
        console.log(theme.muted(`\nUsage: /permissions <${modes.join('|')}>\n`));
      }
    },
  },
  '/quit': {
    description: 'Exit MimoAgent',
    handler: async () => {
      console.log(theme.muted('\nGoodbye!\n'));
      process.exit(0);
    },
  },
};

export async function runREPL(config: MimoConfig): Promise<void> {
  const agent = new Agent(config);
  await agent.initialize();

  renderer.renderWelcome(config.model);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: renderer.renderUserPrompt(),
  });

  let messageCount = 0;

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith('/')) {
      const [cmd, ...argsParts] = input.split(' ');
      const args = argsParts.join(' ');
      const command = SLASH_COMMANDS[cmd];
      if (command) {
        await command.handler(args, agent, config);
      } else {
        console.log(theme.error(`\nUnknown command: ${cmd}. Type /help for available commands.\n`));
      }
      rl.prompt();
      return;
    }

    // Render user input
    renderer.renderUserInput(input);

    // Auto-compact check
    messageCount++;
    if (messageCount % 20 === 0) {
      const conversation = agent.getConversation();
      const tokens = estimateConversationTokens(conversation);
      if (tokens > config.contextWindow * 0.7) {
        renderer.renderCompactStart();
        const result = await compactMessages(conversation, null, {
          maxTokens: config.contextWindow * 0.5,
          keepRecentCount: 6,
        });
        agent.setConversation(result.messages);
        renderer.renderCompactResult(result.originalTokens, result.compactedTokens);
      }
    }

    // Run agent
    let fullResponse = '';
    try {
      const stream = agent.run(input);
      renderer.startAssistantTurn();

      for await (const event of stream) {
        handleEvent(event);
        if (event.type === 'text') {
          fullResponse += event.content;
        }
      }

      renderer.endAssistantTurn();

      // Show usage summary
      const tracker = agent.getUsageTracker();
      renderer.renderUsageSummary(tracker.getStats());
    } catch (error) {
      renderer.endAssistantTurn();
      renderer.renderError(error instanceof Error ? error.message : String(error));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(theme.muted('\nGoodbye!\n'));
    process.exit(0);
  });
}

function handleEvent(event: LoopEvent): void {
  switch (event.type) {
    case 'text':
      renderer.streamToken(event.content);
      break;
    case 'tool_start':
      renderer.renderToolStart(event.name, event.args);
      break;
    case 'tool_result':
      renderer.renderToolResult(event.name, event.result);
      break;
    case 'done':
      break;
    case 'error':
      renderer.renderError(event.message);
      break;
  }
}
