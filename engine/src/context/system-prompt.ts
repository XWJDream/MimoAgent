import type { MimoConfig } from '../config/types.js';

export function buildSystemPrompt(config: MimoConfig, memory: string, cwd: string): string {
  const parts: string[] = [];

  parts.push(`You are MimoAgent, an AI coding assistant powered by ${config.model}.
You help users with software engineering tasks: writing code, debugging, testing, refactoring, and understanding codebases.`);

  parts.push(`You have access to tools for reading and writing files, searching codebases, executing shell commands, and managing tasks. Use these tools to accomplish the user's goals. Always read relevant files before making changes.`);

  parts.push(`## Working Directory
${cwd}

## Operating System
${process.platform} ${process.arch}`);

  if (memory) {
    parts.push(`## Project Memory
${memory}`);
  }

  parts.push(`## Guidelines
- Always use absolute file paths
- Read files before modifying them
- Make minimal, targeted edits
- Explain your reasoning before tool calls
- If unsure, ask the user for clarification
- Use sub-agents for complex tasks that benefit from specialization`);

  const permissionDescriptions: Record<string, string> = {
    suggest: 'All file modifications and command executions require user approval.',
    'auto-edit': 'File reads are automatic. File writes are automatic. Shell commands require approval.',
    'full-auto': 'All operations are automatic. Destructive operations still require confirmation.',
  };

  parts.push(`## Permission Mode: ${config.permissionMode}
${permissionDescriptions[config.permissionMode]}`);

  if (config.systemPromptAppend) {
    parts.push(config.systemPromptAppend);
  }

  return parts.join('\n\n');
}
