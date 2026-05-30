import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';
export declare class GlobTool extends BaseTool {
    readonly name = "glob";
    readonly description = "Find files matching a glob pattern. Returns sorted file paths.";
    readonly riskLevel: "read";
    readonly categories: "search"[];
    readonly parameters: ToolDefinition;
    execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
