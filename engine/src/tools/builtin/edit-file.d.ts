import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';
export declare class EditFileTool extends BaseTool {
    readonly name = "edit_file";
    readonly description = "Edit a file by replacing old_string with new_string. The old_string must be unique in the file.";
    readonly riskLevel: "write";
    readonly categories: "file"[];
    readonly parameters: ToolDefinition;
    execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
