import type { McpServerConfig, McpServer, McpTool, McpToolResult, McpServerStatus } from './types.js';
import { McpClient } from './client.js';

/**
 * Manages multiple MCP server connections and their tools
 * Provides unified access to tools across all connected servers
 */
export class McpManager {
  private servers: Map<string, McpServer> = new Map();
  private clients: Map<string, McpClient> = new Map();

  /**
   * Register an MCP server configuration
   */
  addServer(config: McpServerConfig): void {
    this.servers.set(config.name, {
      config,
      tools: [],
      connected: false,
    });
  }

  /**
   * Connect to a specific server and retrieve its tool list
   * Tool names are prefixed with server name to avoid conflicts
   */
  async connect(name: string): Promise<McpTool[]> {
    const server = this.servers.get(name);
    if (!server) {
      throw new Error(`MCP server "${name}" not found`);
    }

    const client = new McpClient(server.config);

    try {
      await client.initialize();
      const tools = await client.listTools();

      // Prefix tool names with server name to prevent conflicts across servers
      const prefixedTools = tools.map((t) => ({
        ...t,
        name: `${name}:${t.name}`,
        serverName: name,
      }));

      server.tools = prefixedTools;
      server.connected = true;
      server.lastError = undefined;
      this.clients.set(name, client);

      console.log(`[MCP] Connected to "${name}": ${prefixedTools.length} tools`);
      return prefixedTools;
    } catch (err) {
      const message = (err as Error).message;
      server.lastError = message;
      server.connected = false;
      console.warn(`[MCP] Failed to connect to "${name}":`, message);
      throw err;
    }
  }

  /**
   * Connect to all enabled servers concurrently
   * Failures are logged but do not block other connections
   */
  async connectAll(): Promise<void> {
    const entries = Array.from(this.servers.entries()).filter(
      ([_, s]) => s.config.enabled,
    );

    if (entries.length === 0) return;

    const results = await Promise.allSettled(
      entries.map(async ([name]) => {
        try {
          await this.connect(name);
        } catch (err) {
          console.warn(`[MCP] connectAll: server "${name}" failed:`, (err as Error).message);
        }
      }),
    );

    const connected = results.filter((r) => r.status === 'fulfilled').length;
    console.log(`[MCP] connectAll: ${connected}/${entries.length} servers connected`);
  }

  /**
   * Call a tool using its qualified name (serverName:toolName)
   */
  async callTool(qualifiedName: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const colonIdx = qualifiedName.indexOf(':');
    if (colonIdx === -1) {
      throw new Error(`Invalid MCP tool name format: "${qualifiedName}" (expected serverName:toolName)`);
    }

    const serverName = qualifiedName.slice(0, colonIdx);
    const toolName = qualifiedName.slice(colonIdx + 1);

    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server "${serverName}" is not connected`);
    }

    return client.callTool(toolName, args);
  }

  /**
   * Get all tools from all connected servers
   */
  getAllTools(): McpTool[] {
    const tools: McpTool[] = [];
    for (const server of this.servers.values()) {
      if (server.connected) {
        tools.push(...server.tools);
      }
    }
    return tools;
  }

  /**
   * Get status of all registered servers
   */
  getServerStatus(): McpServerStatus[] {
    return Array.from(this.servers.values()).map((s) => ({
      name: s.config.name,
      connected: s.connected,
      toolCount: s.tools.length,
      error: s.lastError,
    }));
  }

  /**
   * Disconnect from a specific server
   */
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.close();
      this.clients.delete(name);
    }

    const server = this.servers.get(name);
    if (server) {
      server.connected = false;
      server.tools = [];
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const names = Array.from(this.servers.keys());
    await Promise.allSettled(names.map((name) => this.disconnect(name)));
  }

  /**
   * Check if any servers are connected
   */
  hasConnectedServers(): boolean {
    for (const server of this.servers.values()) {
      if (server.connected) return true;
    }
    return false;
  }

  /**
   * Get a specific server's state
   */
  getServer(name: string): McpServer | undefined {
    return this.servers.get(name);
  }

  /**
   * Remove a server registration
   */
  async removeServer(name: string): Promise<void> {
    await this.disconnect(name);
    this.servers.delete(name);
  }
}
