import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';
export declare class GrepTool extends BaseTool {
    readonly name = "grep";
    readonly description = "Search for a pattern in files using ripgrep. Returns matching lines with file paths and line numbers.";
    readonly riskLevel: "read";
    readonly categories: "search"[];
    readonly parameters: ToolDefinition;
    execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
