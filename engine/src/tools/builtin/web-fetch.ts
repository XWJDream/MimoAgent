import { BaseTool, type ToolResult, type ToolContext } from '../base.js';
import type { ToolDefinition } from '../schema.js';

const MAX_CONTENT_LENGTH = 50000; // ~50KB of text
const FETCH_TIMEOUT = 15000; // 15 seconds

/**
 * Extract readable text from HTML content.
 * Strips tags, scripts, styles, and collapses whitespace.
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style blocks
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  return text.trim();
}

export class WebFetchTool extends BaseTool {
  readonly name = 'web_fetch';
  readonly description = 'Fetch content from a URL. Returns the page text content. Useful for reading documentation, API references, and web pages.';
  readonly riskLevel = 'read' as const;
  readonly categories = ['web' as const];

  readonly parameters: ToolDefinition = {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch and read content from a URL. Returns extracted text content from the web page.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' },
          prompt: { type: 'string', description: 'Optional: specific question about the content to focus extraction' },
        },
        required: ['url'],
      },
    },
  };

  async execute(args: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const { url, prompt } = args as { url: string; prompt?: string };

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { output: 'Error: Invalid URL format', isError: true };
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { output: 'Error: Only HTTP and HTTPS URLs are supported', isError: true };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MimoAgent/1.0 (AI coding assistant)',
          'Accept': 'text/html,application/xhtml+xml,text/plain,application/json,*/*',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          output: `Error: HTTP ${response.status} ${response.statusText}`,
          isError: true,
        };
      }

      const contentType = response.headers.get('content-type') || '';
      const rawBody = await response.text();

      let textContent: string;

      if (contentType.includes('application/json')) {
        // Pretty-print JSON
        try {
          const parsed = JSON.parse(rawBody);
          textContent = JSON.stringify(parsed, null, 2);
        } catch {
          textContent = rawBody;
        }
      } else if (contentType.includes('text/html')) {
        textContent = extractTextFromHtml(rawBody);
      } else {
        // Plain text or other
        textContent = rawBody;
      }

      // Truncate if too long
      let truncated = false;
      if (textContent.length > MAX_CONTENT_LENGTH) {
        textContent = textContent.slice(0, MAX_CONTENT_LENGTH);
        truncated = true;
      }

      // Build output
      let output = `## Content from ${url}\n\n${textContent}`;
      if (truncated) {
        output += '\n\n[Content truncated — exceeded 50KB limit]';
      }
      if (prompt) {
        output += `\n\n---\nUser's question about this content: ${prompt}`;
      }

      return {
        output,
        isError: false,
        metadata: {
          url,
          contentType,
          contentLength: textContent.length,
          truncated,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('abort') || message.includes('AbortError')) {
        return { output: `Error: Request timed out after ${FETCH_TIMEOUT / 1000}s`, isError: true };
      }
      return { output: `Error fetching URL: ${message}`, isError: true };
    }
  }
}
