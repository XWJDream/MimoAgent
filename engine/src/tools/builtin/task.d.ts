import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';
export declare class TaskCreateTool extends BaseTool {
    readonly name = "task_create";
    readonly description = "Create a new task to track progress on a multi-step operation.";
    readonly riskLevel: "write";
    readonly categories: "task"[];
    readonly parameters: ToolDefinition;
    execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult>;
}
export declare class TaskUpdateTool extends BaseTool {
    readonly name = "task_update";
    readonly description = "Update a task's status or description.";
    readonly riskLevel: "write";
    readonly categories: "task"[];
    readonly parameters: ToolDefinition;
    execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult>;
}
export declare class TaskListTool extends BaseTool {
    readonly name = "task_list";
    readonly description = "List all tasks and their status.";
    readonly riskLevel: "read";
    readonly categories: "task"[];
    readonly parameters: ToolDefinition;
    execute(_args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult>;
}
