import type { ToolRegistry } from '../registry.js';
export declare function registerBuiltinTools(registry: ToolRegistry): void;
export { ReadFileTool } from './read-file.js';
export { WriteFileTool } from './write-file.js';
export { EditFileTool } from './edit-file.js';
export { GrepTool } from './grep.js';
export { GlobTool } from './glob.js';
export { ShellTool } from './shell.js';
export { TaskCreateTool, TaskUpdateTool, TaskListTool } from './task.js';
