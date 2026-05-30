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

export function registerBuiltinTools(registry: ToolRegistry): void {
  registry.registerAll([
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
  ]);
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
