import chalk from 'chalk';
import { darkTheme } from './theme.js';

const theme = darkTheme;

/**
 * ANSI escape code helpers for full-screen TUI
 */
export const ESC = '\x1B';
export const CSI = `${ESC}[`;

export function moveTo(row: number, col: number): string {
  return `${CSI}${row};${col}H`;
}

export function clearScreen(): string {
  return `${CSI}2J${CSI}H`;
}

export function clearLine(): string {
  return `${CSI}2K`;
}

export function hideCursor(): string {
  return `${CSI}?25l`;
}

export function showCursor(): string {
  return `${CSI}?25h`;
}

export function saveCursor(): string {
  return `${ESC}7`;
}

export function restoreCursor(): string {
  return `${ESC}8`;
}

export function scrollUp(n: number): string {
  return `${CSI}${n}S`;
}

export function scrollDown(n: number): string {
  return `${CSI}${n}T`;
}

/**
 * Get terminal dimensions
 */
export function getTerminalSize(): { rows: number; cols: number } {
  return {
    rows: process.stdout.rows || 24,
    cols: Math.min(process.stdout.columns || 80, 120),
  };
}

/**
 * Strip ANSI escape codes from string
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Get visible length of string (without ANSI codes)
 */
export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

/**
 * Truncate string to fit width
 */
export function truncate(str: string, width: number): string {
  if (visibleLength(str) <= width) return str;
  let result = '';
  let visible = 0;
  let inEscape = false;

  for (const char of str) {
    if (char === '\x1B') {
      inEscape = true;
      result += char;
      continue;
    }
    if (inEscape) {
      result += char;
      if (/[a-zA-Z]/.test(char)) inEscape = false;
      continue;
    }
    if (visible >= width - 1) {
      result += '…';
      break;
    }
    result += char;
    visible++;
  }
  return result;
}

/**
 * Wrap text to fit width, preserving ANSI codes
 */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    if (visibleLength(para) <= width) {
      lines.push(para);
      continue;
    }

    let line = '';
    let lineVisible = 0;
    let inEscape = false;
    let currentEscape = '';

    for (const char of para) {
      if (char === '\x1B') {
        inEscape = true;
        currentEscape = char;
        continue;
      }
      if (inEscape) {
        currentEscape += char;
        if (/[a-zA-Z]/.test(char)) {
          inEscape = false;
          line += currentEscape;
          currentEscape = '';
        }
        continue;
      }

      if (lineVisible >= width) {
        lines.push(line);
        line = '';
        lineVisible = 0;
      }

      line += char;
      lineVisible++;
    }

    if (line) lines.push(line);
  }

  return lines;
}

/**
 * Render a horizontal line
 */
export function horizontalLine(width: number, char = '─', color?: typeof chalk): string {
  const line = char.repeat(width);
  return color ? color(line) : theme.muted(line);
}

/**
 * Center text within width
 */
export function centerText(text: string, width: number): string {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  const leftPad = Math.floor((width - visible) / 2);
  const rightPad = width - visible - leftPad;
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

/**
 * Right-align text within width
 */
export function rightAlign(text: string, width: number): string {
  const visible = visibleLength(text);
  if (visible >= width) return text;
  return ' '.repeat(width - visible) + text;
}
