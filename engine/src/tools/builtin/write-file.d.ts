import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';
export declare class WriteFileTool extends BaseTool {
    readonly name = "write_file";
    readonly description = "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Creates parent directories as needed.";
    readonly riskLevel: "write";
    readonly categories: "file"[];
    readonly parameters: ToolDefinition;
    execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
