import chalk from 'chalk';
import { darkTheme } from './theme.js';

const theme = darkTheme;

export interface BoxOptions {
  title?: string;
  padding?: number;
  width?: number;
  titleColor?: typeof chalk;
  dim?: boolean;
}

function getTerminalWidth(): number {
  return Math.min(process.stdout.columns || 80, 120);
}

function stripAnsi(str: string): number {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '').length;
}

function padLine(content: string, width: number, padding: number): string {
  const contentWidth = stripAnsi(content);
  const innerWidth = width - 2 - padding * 2;
  const remaining = Math.max(0, innerWidth - contentWidth);
  return ' '.repeat(padding) + content + ' '.repeat(remaining) + ' '.repeat(padding);
}

export function renderBox(lines: string[], options: BoxOptions = {}): string {
  const width = options.width || getTerminalWidth();
  const padding = options.padding ?? 1;
  const titleColor = options.titleColor || theme.primary;
  const dim = options.dim ?? false;

  const innerWidth = width - 2;
  const result: string[] = [];

  // Top border with optional title
  if (options.title) {
    const titleStr = ` ${options.title} `;
    const titleLen = stripAnsi(titleStr);
    const leftDash = Math.max(2, Math.floor((innerWidth - titleLen) / 2));
    const rightDash = innerWidth - leftDash - titleLen;
    result.push(
      theme.border.color(theme.border.topLeft) +
        theme.border.color(theme.border.horizontal.repeat(leftDash)) +
        titleColor.bold(titleStr) +
        theme.border.color(theme.border.horizontal.repeat(Math.max(0, rightDash))) +
        theme.border.color(theme.border.topRight),
    );
  } else {
    result.push(
      theme.border.color(theme.border.topLeft) +
        theme.border.color(theme.border.horizontal.repeat(innerWidth)) +
        theme.border.color(theme.border.topRight),
    );
  }

  // Empty line for top padding
  for (let i = 0; i < padding; i++) {
    result.push(theme.border.color(theme.border.vertical) + ' '.repeat(innerWidth) + theme.border.color(theme.border.vertical));
  }

  // Content lines
  for (const line of lines) {
    const subLines = line.split('\n');
    for (const subLine of subLines) {
      const padded = padLine(subLine, width, padding);
      const paddedLen = stripAnsi(padded);
      const remaining = innerWidth - paddedLen;
      const prefix = dim ? theme.muted(theme.border.color(theme.border.vertical)) : theme.border.color(theme.border.vertical);
      const suffix = dim
        ? theme.muted(theme.border.color(theme.border.vertical))
        : theme.border.color(theme.border.vertical);
      result.push(prefix + padded + ' '.repeat(Math.max(0, remaining)) + suffix);
    }
  }

  // Empty line for bottom padding
  for (let i = 0; i < padding; i++) {
    result.push(theme.border.color(theme.border.vertical) + ' '.repeat(innerWidth) + theme.border.color(theme.border.vertical));
  }

  // Bottom border
  result.push(
    theme.border.color(theme.border.bottomLeft) +
      theme.border.color(theme.border.horizontal.repeat(innerWidth)) +
      theme.border.color(theme.border.bottomRight),
  );

  return result.join('\n');
}

export function renderStatusBar(left: string, right: string): string {
  const width = getTerminalWidth();
  const innerWidth = width - 2;
  const leftLen = stripAnsi(left);
  const rightLen = stripAnsi(right);
  const gap = Math.max(1, innerWidth - leftLen - rightLen);

  return (
    theme.border.color(theme.border.teeLeft) +
    theme.muted(left) +
    ' '.repeat(gap) +
    theme.muted(right) +
    theme.border.color(theme.border.teeRight)
  );
}

export function renderSeparator(title?: string): string {
  const width = getTerminalWidth();
  if (!title) {
    return theme.muted('─'.repeat(width));
  }
  const titleStr = ` ${title} `;
  const titleLen = stripAnsi(titleStr);
  const leftDash = Math.max(2, Math.floor((width - titleLen) / 2));
  const rightDash = width - leftDash - titleLen;
  return (
    theme.muted('─'.repeat(leftDash)) +
    theme.primary(titleStr) +
    theme.muted('─'.repeat(Math.max(0, rightDash)))
  );
}

export function renderProgressBar(value: number, max: number, width = 20): string {
  const ratio = Math.min(1, value / max);
  const filled = Math.round(ratio * width);
  const empty = width - filled;

  let color: typeof chalk;
  if (ratio < 0.5) color = theme.success;
  else if (ratio < 0.8) color = theme.warning;
  else color = theme.error;

  return color('█'.repeat(filled)) + theme.muted('░'.repeat(empty));
}
