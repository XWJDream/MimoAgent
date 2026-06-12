/**
 * MCP (Model Context Protocol) type definitions
 * Supports JSON-RPC 2.0 over HTTP/SSE and stdio transports
 */

/** Configuration for connecting to an MCP server */
export interface McpServerConfig {
  name: string;
  url?: string;           // HTTP/SSE mode endpoint
  command?: string;       // stdio mode command
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  timeout?: number;       // request timeout in milliseconds
}

/** A tool exposed by an MCP server */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

/** A tool call request to an MCP server */
export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** Result returned from an MCP tool call */
export interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/** Runtime state of an MCP server connection */
export interface McpServer {
  config: McpServerConfig;
  tools: McpTool[];
  connected: boolean;
  lastError?: string;
}

/** Status summary for UI display */
export interface McpServerStatus {
  name: string;
  connected: boolean;
  toolCount: number;
  error?: string;
}
