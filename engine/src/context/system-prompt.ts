import fs from 'node:fs';
import path from 'node:path';
import type { MimoConfig } from '../config/types.js';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'release', '.next', '.vite',
]);

function getGitRepoStatus(cwd: string): boolean {
  return fs.existsSync(path.join(cwd, '.git'));
}

function getProjectFileTree(cwd: string, maxEntries = 30): string {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(cwd, { withFileTypes: true });
  } catch {
    return '(unable to read directory)';
  }

  const filtered = entries
    .filter((e) => !SKIP_DIRS.has(e.name))
    .slice(0, maxEntries);

  if (filtered.length === 0) {
    return '(empty directory)';
  }

  const lines = filtered.map((e) => {
    const suffix = e.isDirectory() ? '/' : '';
    return `  ${e.name}${suffix}`;
  });

  const truncated = entries.length > maxEntries ? `\n  ... (${entries.length - maxEntries} more entries)` : '';
  return lines.join('\n') + truncated;
}

function getCurrentDate(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

const PROJECT_CONTEXT_FILES = ['MIMO.md', '.mimo-rules', 'CLAUDE.md', '.clinerules'];

function getProjectContext(cwd: string): string {
  const parts: string[] = [];
  for (const filename of PROJECT_CONTEXT_FILES) {
    const filePath = path.join(cwd, filename);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8').trim();
        if (content) {
          parts.push(`### From ${filename}\n${content}`);
        }
      }
    } catch {
      // Skip unreadable files
    }
  }
  return parts.join('\n\n');
}

export function buildSystemPrompt(config: MimoConfig, memory: string, cwd: string): string {
  const parts: string[] = [];

  parts.push(`You are MimoAgent, an AI coding assistant powered by ${config.model}.
You help users with software engineering tasks: writing code, debugging, testing, refactoring, and understanding codebases.`);

  // --- Environment block ---
  const isGitRepo = getGitRepoStatus(cwd);
  const platform = `${process.platform} ${process.arch}`;
  const currentDate = getCurrentDate();

  parts.push(`## Environment

- **Working directory:** ${cwd}
- **Platform:** ${platform}
- **Git repository:** ${isGitRepo ? 'yes' : 'no'}
- **Current date:** ${currentDate}`);

  // --- Project file tree ---
  const fileTree = getProjectFileTree(cwd);
  parts.push(`## Project File Tree

\`\`\`
${fileTree}
\`\`\``);

  // --- Memory ---
  if (memory) {
    parts.push(`## Project Memory
${memory}`);
  }

  // --- Project context files (MIMO.md, .mimo-rules, etc.) ---
  const projectContext = getProjectContext(cwd);
  if (projectContext) {
    parts.push(`## Project Context
The following project-specific instructions must be followed:
${projectContext}`);
  }

  // --- Coding guidelines ---
  parts.push(`## Coding Guidelines

- **Always use absolute file paths** — never relative paths. Construct them with \`path.resolve\` or \`path.join\` when needed.
- **Read files before modifying them** — always read the current content of a file before making any edits. This prevents accidental data loss and ensures your edits apply cleanly.
- **Make minimal, targeted edits** — change only what is necessary. Do not reformat unrelated code, rename variables you were not asked to touch, or restructure code beyond the scope of the request.
- **Follow existing code conventions** — match the style, naming patterns, import ordering, and formatting already present in the codebase. When in doubt, look at neighboring files for guidance.
- **Do not add unnecessary comments** — only add comments when the logic is genuinely non-obvious. Do not add comments that restate what the code already says.
- **Check git status after changes** — after modifying files, run \`git status\` and \`git diff\` to verify only intended changes were made.
- **If unsure, ask the user for clarification** — do not guess when the requirements are ambiguous. It is better to ask than to implement the wrong thing.
- **Use sub-agents for complex tasks** — delegate work that benefits from specialization or isolation to sub-agents.`);

  // --- Tool usage policy ---
  parts.push(`## Tool Usage Policy

- **Use parallel tool calls when independent** — if you need to read multiple files or run multiple searches that do not depend on each other, invoke them in the same turn rather than sequentially.
- **Search before reading** — use glob and grep tools to locate relevant files before reading them. This is faster than guessing file paths.
- **Explain non-obvious commands** — before running a shell command that is not immediately obvious, briefly explain what it does and why you are running it.
- **Summarize important findings** — the user does not see the full tool output. When you discover something important (an error, a relevant piece of code, a test result), restate it in your own words so the user can follow along.`);

  // --- Permission mode ---
  const permissionDescriptions: Record<string, string> = {
    suggest: 'All file modifications and command executions require user approval.',
    'auto-edit': 'File reads are automatic. File writes are automatic. Shell commands require approval.',
    'full-auto': 'All operations are automatic. Destructive operations still require confirmation.',
  };

  parts.push(`## Permission Mode: ${config.permissionMode}
${permissionDescriptions[config.permissionMode]}`);

  // --- User appends ---
  if (config.systemPromptAppend) {
    parts.push(config.systemPromptAppend);
  }

  return parts.join('\n\n');
}
