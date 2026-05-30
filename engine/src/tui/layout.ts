import { darkTheme } from './theme.js';
import {
  getTerminalSize,
  visibleLength,
  truncate,
  moveTo,
  clearScreen,
  hideCursor,
  showCursor,
} from './screen.js';

const theme = darkTheme;

export interface LayoutConfig {
  headerHeight: number;
  footerHeight: number;
  inputHeight: number;
  scrollbarWidth: number;
}

const defaultConfig: LayoutConfig = {
  headerHeight: 3,
  footerHeight: 2,
  inputHeight: 3,
  scrollbarWidth: 0,
};

export class ScreenLayout {
  private config: LayoutConfig;
  private outputLines: string[] = [];
  private scrollOffset = 0;
  private isInitialized = false;

  constructor(config: Partial<LayoutConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  initialize(): void {
    if (this.isInitialized) return;
    process.stdout.write(hideCursor());
    process.stdout.write(clearScreen());
    this.isInitialized = true;

    // Handle terminal resize
    process.stdout.on('resize', () => {
      this.redraw();
    });
  }

  destroy(): void {
    process.stdout.write(showCursor());
    this.isInitialized = false;
  }

  getOutputAreaHeight(): number {
    const { rows } = getTerminalSize();
    return rows - this.config.headerHeight - this.config.footerHeight - this.config.inputHeight;
  }

  renderHeader(): void {
    const { cols } = getTerminalSize();
    const width = cols;

    // Top border
    const border = theme.border.color('╭') +
      theme.border.color('─'.repeat(width - 2)) +
      theme.border.color('╮');

    // Title bar
    const title = theme.primary.bold(' MimoAgent') + theme.muted(' v0.1.0 ');
    const version = theme.muted('mimo-v2.5-pro');
    const padding = width - 2 - visibleLength(title) - visibleLength(version);
    const titleBar = theme.border.color('│') +
      title +
      ' '.repeat(Math.max(1, padding)) +
      version +
      theme.border.color('│');

    // Separator
    const separator = theme.border.color('├') +
      theme.border.color('─'.repeat(width - 2)) +
      theme.border.color('┤');

    process.stdout.write(moveTo(1, 1));
    process.stdout.write(border);
    process.stdout.write(moveTo(2, 1));
    process.stdout.write(titleBar);
    process.stdout.write(moveTo(3, 1));
    process.stdout.write(separator);
  }

  renderFooter(stats?: { tokens: number; cost: number; tools: number; duration?: number }): void {
    const { rows, cols } = getTerminalSize();
    const width = cols;
    const footerRow = rows - this.config.inputHeight;

    // Separator
    const separator = theme.border.color('├') +
      theme.border.color('─'.repeat(width - 2)) +
      theme.border.color('┤');

    // Status bar
    const left = stats
      ? theme.muted(' ') +
        theme.text(String(stats.tokens.toLocaleString())) +
        theme.muted(' tokens') +
        theme.muted(' │ ') +
        theme.text('$' + stats.cost.toFixed(4)) +
        theme.muted(' │ ') +
        theme.text(String(stats.tools)) +
        theme.muted(' tools')
      : theme.muted(' Ready');

    const right = stats?.duration
      ? theme.text(stats.duration.toFixed(1)) + theme.muted('s')
      : theme.muted('');

    const statusPadding = width - 2 - visibleLength(left) - visibleLength(right);
    const statusBar = theme.border.color('│') +
      left +
      ' '.repeat(Math.max(1, statusPadding)) +
      right +
      theme.border.color('│');

    process.stdout.write(moveTo(footerRow, 1));
    process.stdout.write(separator);
    process.stdout.write(moveTo(footerRow + 1, 1));
    process.stdout.write(statusBar);
  }

  renderInputArea(inputBuffer: string, cursorPos: number): void {
    const { rows, cols } = getTerminalSize();
    const width = cols;
    const inputRow = rows - this.config.inputHeight + 2;

    // Input border top
    const inputBorder = theme.border.color('├') +
      theme.border.color('─'.repeat(width - 2)) +
      theme.border.color('┤');

    process.stdout.write(moveTo(inputRow, 1));
    process.stdout.write(inputBorder);

    // Input line
    const prompt = theme.success.bold('❯ ');
    const promptLen = visibleLength(prompt);
    const availableWidth = width - 2 - promptLen - 1;

    // Handle long input with scrolling
    let displayInput = inputBuffer;
    if (visibleLength(inputBuffer) > availableWidth) {
      const start = Math.max(0, cursorPos - availableWidth + 5);
      displayInput = inputBuffer.slice(start, start + availableWidth);
      if (start > 0) displayInput = '…' + displayInput.slice(1);
    }

    const inputLine = theme.border.color('│') +
      ' ' +
      prompt +
      displayInput +
      ' '.repeat(Math.max(0, availableWidth - visibleLength(displayInput))) +
      theme.border.color('│');

    process.stdout.write(moveTo(inputRow + 1, 1));
    process.stdout.write(inputLine);

    // Bottom border
    const bottomBorder = theme.border.color('╰') +
      theme.border.color('─'.repeat(width - 2)) +
      theme.border.color('╯');

    process.stdout.write(moveTo(inputRow + 2, 1));
    process.stdout.write(bottomBorder);
  }

  renderOutput(): void {
    const outputHeight = this.getOutputAreaHeight();
    const { cols } = getTerminalSize();
    const width = cols - 2;
    const startRow = this.config.headerHeight + 1;

    // Calculate visible lines
    const totalLines = this.outputLines.length;
    const visibleStart = Math.max(0, totalLines - outputHeight - this.scrollOffset);
    const visibleEnd = Math.min(totalLines, visibleStart + outputHeight);

    for (let i = 0; i < outputHeight; i++) {
      const lineIdx = visibleStart + i;
      process.stdout.write(moveTo(startRow + i, 1));

      if (lineIdx < visibleEnd) {
        const line = this.outputLines[lineIdx];
        const truncated = truncate(line, width);
        const padding = width - visibleLength(truncated);
        process.stdout.write(
          theme.border.color('│') +
            ' ' +
            truncated +
            ' '.repeat(Math.max(0, padding)) +
            ' ' +
            theme.border.color('│'),
        );
      } else {
        process.stdout.write(
          theme.border.color('│') +
            ' '.repeat(width + 1) +
            theme.border.color('│'),
        );
      }
    }
  }

  addOutputLine(line: string): void {
    this.outputLines.push(line);
  }

  addOutputLines(lines: string[]): void {
    this.outputLines.push(...lines);
  }

  clearOutput(): void {
    this.outputLines = [];
    this.scrollOffset = 0;
  }

  scrollUp(lines: number): void {
    const maxScroll = Math.max(0, this.outputLines.length - this.getOutputAreaHeight());
    this.scrollOffset = Math.min(maxScroll, this.scrollOffset + lines);
  }

  scrollDown(lines: number): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines);
  }

  redraw(): void {
    this.renderHeader();
    this.renderOutput();
    this.renderFooter();
    this.renderInputArea('', 0);
  }
}
