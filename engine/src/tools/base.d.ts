import type { ToolDefinition } from './schema.js';
import type { FileCache } from '../context/file-cache.js';
export interface ToolResult {
    output: string;
    displayOutput?: string;
    isError: boolean;
    metadata?: Record<string, unknown>;
}
export interface ToolContext {
    workingDirectory: string;
    fileCache: FileCache;
    abortSignal?: AbortSignal;
}
export type RiskLevel = 'read' | 'write' | 'execute' | 'destructive';
export type ToolCategory = 'file' | 'search' | 'shell' | 'web' | 'task' | 'system';
export declare abstract class BaseTool {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly parameters: ToolDefinition;
    abstract readonly riskLevel: RiskLevel;
    abstract readonly categories: ToolCategory[];
    abstract execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}
