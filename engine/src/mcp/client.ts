import type { McpServerConfig, McpTool, McpToolResult } from './types.js';

/**
 * MCP JSON-RPC 2.0 client
 * Supports HTTP/SSE and stdio transport modes
 */
export class McpClient {
  private config: McpServerConfig;
  private requestId = 0;

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  /**
   * Send a JSON-RPC request to the MCP server
   */
  private async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId;
    const body = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    if (this.config.url) {
      return this.httpRequest(body);
    } else if (this.config.command) {
      return this.stdioRequest(body);
    }

    throw new Error('MCP server must have url or command configured');
  }

  /**
   * HTTP/SSE transport: send JSON-RPC via POST
   */
  private async httpRequest(body: Record<string, unknown>): Promise<unknown> {
    const controller = new AbortController();
    const timeoutMs = this.config.timeout || 30000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.config.url!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`MCP HTTP error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        result?: unknown;
        error?: { code: number; message: string };
      };

      if (data.error) {
        throw new Error(`MCP error (${data.error.code}): ${data.error.message}`);
      }

      return data.result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`MCP request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * stdio transport: spawn child process and communicate via stdin/stdout
   */
  private async stdioRequest(body: Record<string, unknown>): Promise<unknown> {
    const { spawn } = await import('node:child_process');

    return new Promise((resolve, reject) => {
      if (!this.config.command) {
        reject(new Error('stdio mode requires a command'));
        return;
      }

      const timeoutMs = this.config.timeout || 30000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const proc = spawn(this.config.command, this.config.args || [], {
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (!proc.killed) {
          try { proc.kill(); } catch { /* ignore */ }
        }
      };

      timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`MCP stdio request timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`MCP stdio process error: ${err.message}`));
        }
      });

      proc.on('close', (code) => {
        if (settled) return;
        settled = true;
        cleanup();

        if (code !== 0 && !stdout.trim()) {
          reject(new Error(`MCP stdio process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // MCP stdio uses newline-delimited JSON
          const lines = stdout.trim().split('\n').filter(Boolean);
          const lastLine = lines[lines.length - 1];
          const data = JSON.parse(lastLine) as {
            result?: unknown;
            error?: { code: number; message: string };
          };

          if (data.error) {
            reject(new Error(`MCP error (${data.error.code}): ${data.error.message}`));
            return;
          }

          resolve(data.result);
        } catch (err) {
          reject(new Error(`MCP stdio parse error: ${(err as Error).message}\nRaw output: ${stdout.slice(0, 500)}`));
        }
      });

      // Send the request as newline-delimited JSON
      proc.stdin.write(JSON.stringify(body) + '\n');
      proc.stdin.end();
    });
  }

  /**
   * Initialize the MCP connection (handshake)
   */
  async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: 'mimo-desktop',
        version: '1.0.0',
      },
    });
  }

  /**
   * List available tools from the MCP server
   */
  async listTools(): Promise<McpTool[]> {
    const result = (await this.request('tools/list')) as { tools?: McpTool[] };
    return result?.tools || [];
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    return this.request('tools/call', {
      name,
      arguments: args,
    }) as Promise<McpToolResult>;
  }

  /**
   * Close the connection and release resources
   */
  async close(): Promise<void> {
    // HTTP mode has no persistent connection to close
    // stdio mode processes are cleaned up per-request
  }
}
