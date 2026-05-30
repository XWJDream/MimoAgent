import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';
export declare class ReadFileTool extends BaseTool {
    readonly name = "read_file";
    readonly description = "Read the contents of a file at the given absolute path. Returns content with line numbers.";
    readonly riskLevel: "read";
    readonly categories: "file"[];
    readonly parameters: ToolDefinition;
    execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
