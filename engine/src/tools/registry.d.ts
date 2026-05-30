import type { BaseTool, ToolResult, ToolContext, ToolCategory } from './base.js';
import type { ToolDefinition } from './schema.js';
export declare class ToolRegistry {
    private tools;
    private context;
    setContext(context: ToolContext): void;
    register(tool: BaseTool): void;
    registerAll(tools: BaseTool[]): void;
    get(name: string): BaseTool | undefined;
    getDefinitions(categories?: ToolCategory[]): ToolDefinition[];
    getNames(): string[];
    execute(name: string, args: Record<string, unknown>): Promise<ToolResult>;
    getSubset(categories: ToolCategory[], specificTools?: string[]): ToolDefinition[];
}
