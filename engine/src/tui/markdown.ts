import chalk from 'chalk';

// Simple terminal markdown renderer (no dependency on marked-terminal which has issues)
export function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        result.push(chalk.dim('└' + '─'.repeat(60)));
      } else {
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
        result.push(chalk.dim('┌─ ' + (codeLang || 'code') + ' ' + '─'.repeat(Math.max(0, 55 - codeLang.length))));
      }
      continue;
    }

    if (inCodeBlock) {
      result.push(chalk.dim('│ ') + chalk.white(line));
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      result.push(chalk.cyan.bold(line.slice(4)));
      continue;
    }
    if (line.startsWith('## ')) {
      result.push(chalk.blue.bold(line.slice(3)));
      continue;
    }
    if (line.startsWith('# ')) {
      result.push(chalk.magenta.bold(line.slice(2)));
      continue;
    }

    // Bold
    line = line.replace(/\*\*(.+?)\*\*/g, chalk.bold('$1'));
    line = line.replace(/__(.+?)__/g, chalk.bold('$1'));

    // Italic
    line = line.replace(/\*(.+?)\*/g, chalk.italic('$1'));
    line = line.replace(/_(.+?)_/g, chalk.italic('$1'));

    // Inline code
    line = line.replace(/`([^`]+)`/g, chalk.bgGray.white(' $1 '));

    // Links
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, chalk.blue.underline('$1') + chalk.dim(' ($2)'));

    // Lists
    if (line.match(/^\s*[-*]\s/)) {
      line = line.replace(/^(\s*)([-*])\s/, '$1' + chalk.cyan('•') + ' ');
    }
    if (line.match(/^\s*\d+\.\s/)) {
      line = line.replace(/^(\s*)(\d+)\.\s/, '$1' + chalk.cyan('$2.') + ' ');
    }

    // Horizontal rules
    if (line.match(/^---+$/)) {
      line = chalk.dim('─'.repeat(60));
    }

    result.push(line);
  }

  return result.join('\n');
}
