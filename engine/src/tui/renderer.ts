import { darkTheme } from './theme.js';
import { renderBox, renderStatusBar, renderProgressBar } from './box.js';
import type { ToolResult } from '../tools/base.js';
import type { UsageStats } from '../context/usage-tracker.js';

const theme = darkTheme;

export class CodexRenderer {
  private streamingBuffer = '';
  private isStreaming = false;
  private startTime = 0;
  private turnCount = 0;

  renderWelcome(model: string): void {
    const lines = [
      theme.primary.bold('MimoAgent') + theme.muted(' v0.1.0'),
      '',
      theme.muted('Model: ') + theme.text(model),
      theme.muted('Type ') + theme.accent('/help') + theme.muted(' for commands, ') + theme.accent('/quit') + theme.muted(' to exit'),
      '',
      theme.muted('Powered by ') + theme.primary('mimo-v2.5-pro'),
    ];
    console.log(renderBox(lines, { title: 'Welcome', padding: 1 }));
    console.log();
  }

  renderUserPrompt(): string {
    return theme.success.bold('❯ ');
  }

  renderUserInput(input: string): void {
    console.log(theme.success.bold('❯ ') + theme.text(input));
    console.log();
  }

  startAssistantTurn(): void {
    this.streamingBuffer = '';
    this.isStreaming = true;
    this.startTime = Date.now();
    this.turnCount++;
    process.stdout.write(theme.primary.bold('▎ '));
  }

  streamToken(token: string): void {
    this.streamingBuffer += token;
    process.stdout.write(theme.text(token));
  }

  endAssistantTurn(): void {
    if (this.isStreaming) {
      this.isStreaming = false;
      process.stdout.write('\n');
    }
  }

  renderToolStart(name: string, args: Record<string, unknown>): void {
    const argsStr = JSON.stringify(args);
    const preview = argsStr.length > 60 ? argsStr.slice(0, 60) + '...' : argsStr;

    console.log();
    console.log(
      theme.border.color('╭─') +
        theme.accent.bold(' tool ') +
        theme.primary(name) +
        theme.muted(` ${preview}`),
    );
  }

  renderToolResult(name: string, result: ToolResult): void {
    const icon = result.isError ? theme.error('✖') : theme.success('✔');
    const output = result.output;
    const maxPreview = 300;

    if (result.isError) {
      console.log(theme.border.color('│ ') + theme.error(output.slice(0, maxPreview)));
    } else {
      const preview = output.length > maxPreview ? output.slice(0, maxPreview) + theme.muted('...') : output;
      const lines = preview.split('\n');
      for (const line of lines.slice(0, 10)) {
        console.log(theme.border.color('│ ') + theme.muted(line));
      }
      if (lines.length > 10) {
        console.log(theme.border.color('│ ') + theme.muted(`... (${lines.length} lines total)`));
      }
    }

    console.log(
      theme.border.color('╰─') +
        icon +
        theme.muted(` ${name} `) +
        theme.muted(result.isError ? 'failed' : 'done'),
    );
  }

  renderError(message: string): void {
    console.log();
    console.log(renderBox([theme.error.bold('Error'), '', theme.error(message)], { title: 'Error' }));
    console.log();
  }

  renderUsageSummary(stats: UsageStats): void {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

    const left =
      theme.muted('Turn ') +
      theme.text(String(this.turnCount)) +
      theme.muted(' │ ') +
      theme.text(String(stats.sessionTokens.toLocaleString())) +
      theme.muted(' tokens') +
      theme.muted(' │ ') +
      theme.text(duration) +
      theme.muted('s');

    const right =
      theme.muted('$') +
      theme.text(stats.sessionEstimatedCost.toFixed(4)) +
      theme.muted(' │ ') +
      theme.text(String(stats.sessionToolCalls)) +
      theme.muted(' tools');

    console.log(renderStatusBar(left, right));
    console.log();
  }

  renderTokenBudget(used: number, total: number): void {
    const pct = Math.round((used / total) * 100);
    const bar = renderProgressBar(used, total, 20);
    console.log(
      theme.muted('  Context: ') +
        bar +
        theme.muted(` ${pct}%`) +
        theme.muted(` (${used.toLocaleString()}/${total.toLocaleString()} tokens)`),
    );
  }

  renderCompactStart(): void {
    console.log();
    console.log(theme.warning('⟳ Compacting conversation history...'));
  }

  renderCompactResult(originalTokens: number, compactedTokens: number): void {
    const saved = originalTokens - compactedTokens;
    const pct = Math.round((saved / originalTokens) * 100);
    console.log(
      theme.success('✔ Compacted: ') +
        theme.text(`${originalTokens.toLocaleString()}`) +
        theme.muted(' → ') +
        theme.text(`${compactedTokens.toLocaleString()}`) +
        theme.muted(` tokens (saved ${pct}%)`),
    );
    console.log();
  }

  renderSubAgentStart(name: string, task: string): void {
    console.log();
    console.log(
      theme.border.color('╭─') +
        theme.accent.bold(' sub-agent ') +
        theme.primary(name) +
        theme.muted(` → ${task.slice(0, 50)}...`),
    );
  }

  renderSubAgentResult(name: string, summary: string): void {
    console.log(theme.border.color('│ ') + theme.muted(summary));
    console.log(theme.border.color('╰─') + theme.success('✔') + theme.muted(` ${name} done`));
  }

  renderCommandOutput(title: string, content: string): void {
    const lines = content.split('\n');
    console.log(renderBox(lines, { title, padding: 1 }));
  }

  clearLine(): void {
    process.stdout.write('\r\x1B[K');
  }

  renderSpinner(text: string): { stop: () => void } {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const interval = setInterval(() => {
      this.clearLine();
      process.stdout.write(theme.primary(frames[i % frames.length]) + ' ' + theme.muted(text));
      i++;
    }, 80);

    return {
      stop: () => {
        clearInterval(interval);
        this.clearLine();
      },
    };
  }
}
