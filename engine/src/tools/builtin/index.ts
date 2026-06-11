import type { BaseTool } from '../base.js';
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
import { GitCheckpointTool } from './git-checkpoint.js';
import { SubAgentsRunTool } from './sub-agents-run.js';
import { MemorySearchTool } from './memory-search.js';
import { InMemoryTaskStore } from './task.js';
import type { MimoConfig, SubAgentConfig } from '../../config/types.js';
import type { PermissionChecker } from '../../permissions/checker.js';

interface RegisterBuiltinToolsOptions {
  mimoConfig?: MimoConfig;
  subAgents?: SubAgentConfig;
  getPermissionChecker?: () => PermissionChecker | null;
  memorySearchTool?: MemorySearchTool;
}

export function registerBuiltinTools(
  registry: ToolRegistry,
  preset: string = 'act',
  options: RegisterBuiltinToolsOptions = {},
): void {
  const taskStore = new InMemoryTaskStore();
  const allTools: BaseTool[] = [
    new ReadFileTool(),
    new WriteFileTool(),
    new EditFileTool(),
    new GrepTool(),
    new GlobTool(),
    new ShellTool(),
    new TaskCreateTool(taskStore),
    new TaskUpdateTool(taskStore),
    new TaskListTool(taskStore),
    new GitStatusTool(),
    new GitCommitTool(),
    new WebFetchTool(),
    new GitCheckpointTool(),
  ];

  if (preset === 'act' && options.mimoConfig && options.subAgents?.enabled) {
    allTools.push(new SubAgentsRunTool({
      mimoConfig: options.mimoConfig,
      parentRegistry: registry,
      getPermissionChecker: options.getPermissionChecker,
    }));
  }

  // Memory search tool (available in both plan and act presets)
  if (options.memorySearchTool) {
    allTools.push(options.memorySearchTool);
  }

  if (preset === 'plan') {
    // Read-only tools only (web_fetch is read-only, included in plan)
    const planTools = allTools.filter(t =>
      ['read_file', 'grep', 'glob', 'git_status', 'git_checkpoint', 'task_create', 'task_update', 'task_list', 'web_fetch'].includes(t.name)
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
export { GitCheckpointTool } from './git-checkpoint.js';
export { SubAgentsRunTool } from './sub-agents-run.js';
export { MemorySearchTool } from './memory-search.js';
