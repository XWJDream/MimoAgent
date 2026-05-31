import type { ToolRegistry } from '../registry.js';
import { ReadFileTool } from './read-file.js';
import { WriteFileTool } from './write-file.js';
import { EditFileTool } from './edit-file.js';
import { GrepTool } from './grep.js';
import { GlobTool } from './glob.js';
import { ShellTool } from './shell.js';
import { TaskCreateTool, TaskUpdateTool, TaskListTool } from './task.js';
import { GitStatusTool } from './git-status.js';
import { GitCommitTool } from './git-commit.js';
import { WebFetchTool } from './web-fetch.js';

export function registerBuiltinTools(registry: ToolRegistry, preset: string = 'act'): void {
  const allTools = [
    new ReadFileTool(),
    new WriteFileTool(),
    new EditFileTool(),
    new GrepTool(),
    new GlobTool(),
    new ShellTool(),
    new TaskCreateTool(),
    new TaskUpdateTool(),
    new TaskListTool(),
    new GitStatusTool(),
    new GitCommitTool(),
    new WebFetchTool(),
  ];

  if (preset === 'plan') {
    // Read-only tools only (web_fetch is read-only, included in plan)
    const planTools = allTools.filter(t =>
      ['read_file', 'grep', 'glob', 'git_status', 'task_create', 'task_update', 'task_list', 'web_fetch'].includes(t.name)
    );
    registry.registerAll(planTools);
  } else {
    registry.registerAll(allTools);
  }
}

export { ReadFileTool } from './read-file.js';
export { WriteFileTool } from './write-file.js';
export { EditFileTool } from './edit-file.js';
export { GrepTool } from './grep.js';
export { GlobTool } from './glob.js';
export { ShellTool } from './shell.js';
export { TaskCreateTool, TaskUpdateTool, TaskListTool } from './task.js';
export { GitStatusTool } from './git-status.js';
export { GitCommitTool } from './git-commit.js';
export { WebFetchTool } from './web-fetch.js';
