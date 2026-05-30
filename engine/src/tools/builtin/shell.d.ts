import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';
export declare class ShellTool extends BaseTool {
    readonly name = "shell";
    readonly description = "Execute a shell command and return its output. Use with caution.";
    readonly riskLevel: "execute";
    readonly categories: "shell"[];
    readonly parameters: ToolDefinition;
    execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
