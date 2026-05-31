import { darkTheme } from './theme.js';
import { ScreenLayout } from './layout.js';
import { showCursor } from './screen.js';
import type { MimoConfig } from '../config/types.js';
import type { LoopEvent } from '../core/agent-loop.js';
import { Agent } from '../core/agent.js';
import { compactMessages, estimateConversationTokens } from '../context/compaction.js';

const theme = darkTheme;

interface CommandDef {
  description: string;
  handler: (args: string, app: CodexApp) => Promise<void>;
}

export class CodexApp {
  private layout: ScreenLayout;
  private agent: Agent;
  private config: MimoConfig;
  private inputBuffer = '';
  private cursorPos = 0;
  private startTime = 0;
  private turnCount = 0;
  private toolCallCount = 0;
  private currentResponse = '';
  private isActive = false;
  private commands: Record<string, CommandDef> = {};

  constructor(config: MimoConfig) {
    this.config = config;
    this.agent = new Agent(config);
    this.layout = new ScreenLayout();
    this.registerCommands();
  }

  private registerCommands(): void {
    this.commands = {
      '/help': {
        description: 'Show available commands',
        handler: async (_args, app) => {
          app.addOutput('');
          app.addOutput(theme.primary.bold('  Available Commands'));
          app.addOutput(theme.muted('  ─────────────────'));
          for (const [cmd, def] of Object.entries(app.commands)) {
            app.addOutput(
              '  ' + theme.accent(cmd.padEnd(16)) + theme.muted(def.description),
            );
          }
          app.addOutput('');
        },
      },
      '/clear': {
        description: 'Clear conversation',
        handler: async (_args, app) => {
          app.agent.clearConversation();
          app.layout.clearOutput();
          app.addOutput(theme.success('  ✔ Conversation cleared'));
        },
      },
      '/compact': {
        description: 'Compact conversation history',
        handler: async (_args, app) => {
          const conversation = app.agent.getConversation();
          app.addOutput(theme.warning('  ⟳ Compacting...'));
          const result = await compactMessages(conversation, null, {
            maxTokens: app.config.contextWindow * 0.7,
            keepRecentCount: 6,
          });
          app.agent.setConversation(result.messages);
          const saved = result.originalTokens - result.compactedTokens;
          const pct = Math.round((saved / result.originalTokens) * 100);
          app.addOutput(
            theme.success('  ✔ Compacted: ') +
              theme.text(`${result.originalTokens.toLocaleString()}`) +
              theme.muted(' → ') +
              theme.text(`${result.compactedTokens.toLocaleString()}`) +
              theme.muted(` tokens (saved ${pct}%)`),
          );
        },
      },
      '/config': {
        description: 'Show configuration',
        handler: async (_args, app) => {
          const c = app.agent.getConfig();
          app.addOutput('');
          app.addOutput(theme.primary.bold('  Configuration'));
          app.addOutput(theme.muted('  ─────────────'));
          app.addOutput('  ' + theme.muted('Model:           ') + theme.text(c.model));
          app.addOutput('  ' + theme.muted('API Base:        ') + theme.text(c.apiBase));
          app.addOutput('  ' + theme.muted('Permission Mode: ') + theme.text(c.permissionMode));
          app.addOutput('  ' + theme.muted('Max Turns:       ') + theme.text(String(c.maxTurns)));
          app.addOutput('  ' + theme.muted('Temperature:     ') + theme.text(String(c.temperature)));
          app.addOutput('  ' + theme.muted('Context Window:  ') + theme.text(c.contextWindow.toLocaleString()));
          app.addOutput('');
        },
      },
      '/tools': {
        description: 'List tools',
        handler: async (_args, app) => {
          const tools = app.agent.getToolRegistry().getNames();
          app.addOutput('');
          app.addOutput(theme.primary.bold('  Tools'));
          app.addOutput(theme.muted('  ─────'));
          for (const t of tools) {
            app.addOutput('  ' + theme.accent('• ') + theme.text(t));
          }
          app.addOutput('');
        },
      },
      '/usage': {
        description: 'Show usage stats',
        handler: async (_args, app) => {
          const stats = app.agent.getUsageTracker().getStats();
          app.addOutput('');
          app.addOutput(theme.primary.bold('  Usage Statistics'));
          app.addOutput(theme.muted('  ────────────────'));
          app.addOutput('  ' + theme.muted('Session: ') + theme.text(`${stats.sessionRecords} calls, ${stats.sessionTokens.toLocaleString()} tokens, $${stats.sessionEstimatedCost.toFixed(4)}`));
          app.addOutput('  ' + theme.muted('Total:   ') + theme.text(`${stats.totalRecords} calls, ${stats.totalTokens.toLocaleString()} tokens, $${stats.totalEstimatedCost.toFixed(4)}`));
          app.addOutput('');
        },
      },
      '/memory': {
        description: 'Show project memory',
        handler: async (_args, app) => {
          const content = app.agent.getMemory().getContent();
          if (content) {
            app.addOutput('');
            app.addOutput(theme.primary.bold('  Project Memory'));
            app.addOutput(theme.muted('  ──────────────'));
            for (const line of content.split('\n')) {
              app.addOutput('  ' + theme.muted(line));
            }
            app.addOutput('');
          } else {
            app.addOutput(theme.muted('  No project memory saved yet.'));
          }
        },
      },
      '/model': {
        description: 'Switch model',
        handler: async (args, app) => {
          if (args) {
            app.addOutput(theme.success(`  ✔ Model set to: ${args}`));
          } else {
            app.addOutput(theme.muted('  Usage: /model <model-name>'));
          }
        },
      },
      '/permissions': {
        description: 'Change permission mode',
        handler: async (args, app) => {
          const modes = ['suggest', 'auto-edit', 'full-auto'];
          if (modes.includes(args)) {
            app.addOutput(theme.success(`  ✔ Permission mode: ${args}`));
          } else {
            app.addOutput(theme.muted(`  Usage: /permissions <${modes.join('|')}>`));
          }
        },
      },
      '/quit': {
        description: 'Exit',
        handler: async (_args, app) => {
          app.destroy();
          process.exit(0);
        },
      },
    };
  }

  async start(): Promise<void> {
    await this.agent.initialize();
    this.layout.initialize();
    this.isActive = true;

    // Show welcome
    this.addOutput('');
    this.addOutput(theme.primary.bold('  MimoAgent') + theme.muted(' v0.1.0'));
    this.addOutput(theme.muted('  Model: ') + theme.text(this.config.model));
    this.addOutput(theme.muted('  Type ') + theme.accent('/help') + theme.muted(' for commands'));
    this.addOutput('');

    this.layout.renderHeader();
    this.layout.renderOutput();
    this.layout.renderFooter();
    this.layout.renderInputArea('', 0);

    this.setupInput();
  }

  private setupInput(): void {
    if (!process.stdin.isTTY) return;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');

    let escapeBuffer = '';

    process.stdin.on('data', (data: string) => {
      if (!this.isActive) return;

      // Handle escape sequences
      if (data === '\x1B') {
        escapeBuffer = data;
        return;
      }
      if (escapeBuffer) {
        escapeBuffer += data;
        if (escapeBuffer.length >= 3) {
          this.handleEscapeSequence(escapeBuffer);
          escapeBuffer = '';
        }
        return;
      }

      this.handleKeyInput(data);
    });
  }

  private handleEscapeSequence(seq: string): void {
    // Arrow keys
    if (seq === '\x1B[A') this.scrollUp(); // Up
    else if (seq === '\x1B[B') this.scrollDown(); // Down
    else if (seq === '\x1B[C') this.moveCursorRight(); // Right
    else if (seq === '\x1B[D') this.moveCursorLeft(); // Left
    else if (seq === '\x1B[H') this.cursorPos = 0; // Home
    else if (seq === '\x1B[F') this.cursorPos = this.inputBuffer.length; // End
  }

  private handleKeyInput(data: string): void {
    const code = data.charCodeAt(0);

    // Ctrl+C
    if (code === 3) {
      this.destroy();
      process.exit(0);
    }

    // Enter
    if (data === '\r' || data === '\n') {
      this.handleSubmit();
      return;
    }

    // Backspace
    if (code === 127 || code === 8) {
      if (this.cursorPos > 0) {
        this.inputBuffer =
          this.inputBuffer.slice(0, this.cursorPos - 1) +
          this.inputBuffer.slice(this.cursorPos);
        this.cursorPos--;
        this.refreshInput();
      }
      return;
    }

    // Tab
    if (code === 9) {
      this.handleTabCompletion();
      return;
    }

    // Ctrl+U - clear line
    if (code === 21) {
      this.inputBuffer = '';
      this.cursorPos = 0;
      this.refreshInput();
      return;
    }

    // Ctrl+W - delete word
    if (code === 23) {
      const before = this.inputBuffer.slice(0, this.cursorPos);
      const after = this.inputBuffer.slice(this.cursorPos);
      const newBefore = before.replace(/\S+\s*$/, '');
      this.inputBuffer = newBefore + after;
      this.cursorPos = newBefore.length;
      this.refreshInput();
      return;
    }

    // Regular character
    if (code >= 32) {
      this.inputBuffer =
        this.inputBuffer.slice(0, this.cursorPos) +
        data +
        this.inputBuffer.slice(this.cursorPos);
      this.cursorPos++;
      this.refreshInput();
    }
  }

  private handleTabCompletion(): void {
    const input = this.inputBuffer;
    if (input.startsWith('/')) {
      const matches = Object.keys(this.commands).filter((c) => c.startsWith(input));
      if (matches.length === 1) {
        this.inputBuffer = matches[0] + ' ';
        this.cursorPos = this.inputBuffer.length;
        this.refreshInput();
      } else if (matches.length > 1) {
        this.addOutput('');
        for (const m of matches) {
          this.addOutput('  ' + theme.accent(m));
        }
      }
    }
  }

  private async handleSubmit(): Promise<void> {
    const input = this.inputBuffer.trim();
    this.inputBuffer = '';
    this.cursorPos = 0;

    if (!input) {
      this.refreshInput();
      return;
    }

    // Show user input
    this.addOutput(theme.success.bold('  ❯ ') + theme.text(input));
    this.addOutput('');

    // Handle commands
    if (input.startsWith('/')) {
      const [cmd, ...argsParts] = input.split(' ');
      const args = argsParts.join(' ');
      const command = this.commands[cmd];
      if (command) {
        await command.handler(args, this);
      } else {
        this.addOutput(theme.error(`  Unknown command: ${cmd}`));
      }
      this.refreshOutput();
      return;
    }

    // Run agent
    await this.runAgent(input);
  }

  private async runAgent(prompt: string): Promise<void> {
    this.startTime = Date.now();
    this.turnCount++;
    this.toolCallCount = 0;
    this.currentResponse = '';

    // Auto-compact check
    const conversation = this.agent.getConversation();
    const tokens = estimateConversationTokens(conversation);
    if (tokens > this.config.contextWindow * 0.7) {
      this.addOutput(theme.warning('  ⟳ Auto-compacting...'));
      const result = await compactMessages(conversation, null, {
        maxTokens: this.config.contextWindow * 0.5,
        keepRecentCount: 6,
      });
      this.agent.setConversation(result.messages);
      const saved = result.originalTokens - result.compactedTokens;
      this.addOutput(theme.muted(`  Compacted: saved ${saved.toLocaleString()} tokens`));
      this.addOutput('');
    }

    // Stream response
    try {
      const stream = this.agent.run(prompt);

      for await (const event of stream) {
        this.handleEvent(event);
      }

      // Flush remaining response
      if (this.currentResponse) {
        this.flushResponse();
      }

      // Show usage
      const stats = this.agent.getUsageTracker().getStats();
      const duration = (Date.now() - this.startTime) / 1000;
      this.layout.renderFooter({
        tokens: stats.sessionTokens,
        cost: stats.sessionEstimatedCost,
        tools: stats.sessionToolCalls,
        duration,
      });

    } catch (error) {
      this.addOutput(theme.error(`  Error: ${error instanceof Error ? error.message : String(error)}`));
    }

    this.refreshOutput();
  }

  private handleEvent(event: LoopEvent): void {
    switch (event.type) {
      case 'text':
        this.currentResponse += event.content;
        // Flush on newlines for real-time display
        if (this.currentResponse.includes('\n')) {
          this.flushResponse();
        }
        break;

      case 'tool_start':
        // Flush any pending response first
        if (this.currentResponse) {
          this.flushResponse();
        }
        this.toolCallCount++;
        this.addOutput(
          theme.muted('  ┌ ') +
            theme.accent('tool') +
            ' ' +
            theme.primary(event.name) +
            theme.muted(` ${this.formatArgs(event.args)}`),
        );
        this.refreshOutput();
        break;

      case 'tool_result':
        this.addOutput(
          theme.muted('  │ ') +
            (event.result.isError
              ? theme.error(event.result.output.slice(0, 120))
              : theme.muted(this.truncateOutput(event.result.output, 120))),
        );
        this.addOutput(
          theme.muted('  └ ') +
            (event.result.isError ? theme.error('✖') : theme.success('✔')) +
            theme.muted(` ${event.name}`),
        );
        this.refreshOutput();
        break;

      case 'done':
        break;

      case 'error':
        this.addOutput(theme.error(`  ✖ ${event.message}`));
        this.refreshOutput();
        break;
    }
  }

  private flushResponse(): void {
    const lines = this.currentResponse.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        this.addOutput('  ' + theme.text(line));
      }
    }
    this.currentResponse = '';
    this.refreshOutput();
  }

  private formatArgs(args: Record<string, unknown>): string {
    const str = JSON.stringify(args);
    return str.length > 50 ? str.slice(0, 50) + '…' : str;
  }

  private truncateOutput(output: string, maxLen: number): string {
    const lines = output.split('\n');
    if (lines.length === 1) {
      return output.length > maxLen ? output.slice(0, maxLen) + '…' : output;
    }
    return lines[0].slice(0, maxLen) + (lines.length > 1 ? theme.muted(` (${lines.length} lines)`) : '');
  }

  addOutput(line: string): void {
    this.layout.addOutputLine(line);
  }

  refreshOutput(): void {
    this.layout.renderOutput();
    this.refreshInput();
  }

  refreshInput(): void {
    this.layout.renderInputArea(this.inputBuffer, this.cursorPos);
  }

  scrollUp(): void {
    this.layout.scrollUp(5);
    this.refreshOutput();
  }

  scrollDown(): void {
    this.layout.scrollDown(5);
    this.refreshOutput();
  }

  moveCursorLeft(): void {
    if (this.cursorPos > 0) {
      this.cursorPos--;
      this.refreshInput();
    }
  }

  moveCursorRight(): void {
    if (this.cursorPos < this.inputBuffer.length) {
      this.cursorPos++;
      this.refreshInput();
    }
  }

  destroy(): void {
    this.isActive = false;
    this.layout.destroy();
    process.stdout.write(showCursor());
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }
}
