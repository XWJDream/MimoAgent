import { BaseTool, type ToolResult, type ToolContext, type RiskLevel, type ToolCategory } from './base.js';
import type { ToolDefinition } from './schema.js';
import type { McpManager, McpTool } from '../mcp/index.js';

/**
 * Adapts an MCP tool into the native BaseTool interface
 * so it can be registered and executed like any built-in tool
 */
export class McpToolAdapter extends BaseTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolDefinition;
  readonly riskLevel: RiskLevel = 'execute';
  readonly categories: ToolCategory[] = ['system' as ToolCategory];

  private mcpTool: McpTool;
  private manager: McpManager;

  constructor(mcpTool: McpTool, manager: McpManager) {
    super();
    this.mcpTool = mcpTool;
    this.manager = manager;
    this.name = mcpTool.name;
    this.description = `[MCP:${mcpTool.serverName}] ${mcpTool.description}`;

    // Build a ToolDefinition from the MCP tool's inputSchema
    const schemaProps = (mcpTool.inputSchema?.properties || {}) as Record<string, { type: string; description?: string; enum?: string[] }>;
    const schemaRequired = (mcpTool.inputSchema?.required || []) as string[];

    const properties: Record<string, { type: 'string' | 'number' | 'boolean' | 'array' | 'object'; description: string; enum?: string[] }> = {};
    for (const [key, prop] of Object.entries(schemaProps)) {
      properties[key] = {
        type: (prop.type as 'string' | 'number' | 'boolean' | 'array' | 'object') || 'string',
        description: prop.description || '',
        ...(prop.enum ? { enum: prop.enum } : {}),
      };
    }

    this.parameters = {
      type: 'function',
      function: {
        name: mcpTool.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties,
          required: schemaRequired,
        },
      },
    };
  }

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    try {
      const result = await this.manager.callTool(this.name, args);

      // Extract text content from MCP result
      const textParts = result.content
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text!)
        .join('\n');

      const output = textParts || '(MCP tool returned no text content)';

      return {
        output,
        isError: result.isError || false,
        metadata: {
          mcpServer: this.mcpTool.serverName,
          mcpTool: this.mcpTool.name,
          contentTypes: result.content.map((c) => c.type),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        output: `MCP tool error (${this.mcpTool.serverName}:${this.mcpTool.name}): ${message}`,
        isError: true,
        metadata: {
          mcpServer: this.mcpTool.serverName,
          mcpTool: this.mcpTool.name,
        },
      };
    }
  }
}
