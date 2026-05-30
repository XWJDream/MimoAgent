import type { BaseTool, ToolResult, ToolContext, ToolCategory } from './base.js';
import type { ToolDefinition } from './schema.js';

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();
  private context: ToolContext | null = null;

  setContext(context: ToolContext): void {
    this.context = context;
  }

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: BaseTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getDefinitions(categories?: ToolCategory[]): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const tool of this.tools.values()) {
      if (!categories || tool.categories.some((c) => categories.includes(c))) {
        defs.push(tool.parameters);
      }
    }
    return defs;
  }

  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        output: `Unknown tool: ${name}`,
        isError: true,
      };
    }

    if (!this.context) {
      return {
        output: 'Tool context not initialized',
        isError: true,
      };
    }

    try {
      return await tool.execute(args, this.context);
    } catch (error) {
      return {
        output: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  getSubset(categories: ToolCategory[], specificTools?: string[]): ToolDefinition[] {
    const defs = this.getDefinitions(categories);
    if (specificTools) {
      return defs.filter((d) => specificTools.includes(d.function.name));
    }
    return defs;
  }
}
