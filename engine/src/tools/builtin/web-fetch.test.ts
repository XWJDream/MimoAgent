import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebFetchTool } from './web-fetch.js';
import type { ToolContext } from '../base.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WebFetchTool', () => {
  let tool: WebFetchTool;
  let mockContext: ToolContext;

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new WebFetchTool();
    mockContext = {
      workingDirectory: '/test/project',
      fileCache: null as any,
    };
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('web_fetch');
    });

    it('should have correct risk level', () => {
      expect(tool.riskLevel).toBe('read');
    });

    it('should have correct categories', () => {
      expect(tool.categories).toContain('web');
    });
  });

  describe('URL validation', () => {
    it('should reject invalid URL format', async () => {
      const result = await tool.execute({ url: 'not-a-url' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Invalid URL');
    });

    it('should reject non-http protocols', async () => {
      const result = await tool.execute({ url: 'ftp://example.com' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Only HTTP and HTTPS');
    });

    it('should reject file:// protocol', async () => {
      const result = await tool.execute({ url: 'file:///etc/passwd' }, mockContext);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('Only HTTP and HTTPS');
    });

    it('should accept http:// URLs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('content'),
      });

      const result = await tool.execute({ url: 'http://example.com' }, mockContext);
      expect(result.isError).toBe(false);
    });

    it('should accept https:// URLs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('content'),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);
      expect(result.isError).toBe(false);
    });
  });

  describe('content fetching', () => {
    it('should fetch plain text content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('Hello World'),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('Hello World');
      expect(result.metadata?.contentType).toBe('text/plain');
    });

    it('should fetch and parse JSON content', async () => {
      const jsonData = { name: 'test', value: 123 };
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(JSON.stringify(jsonData)),
      });

      const result = await tool.execute({ url: 'https://api.example.com' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('"name": "test"');
      expect(result.output).toContain('"value": 123');
    });

    it('should fetch and extract HTML content', async () => {
      const html = '<html><body><h1>Title</h1><p>Content</p></body></html>';
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('Title');
      expect(result.output).toContain('Content');
      // HTML tags should be stripped
      expect(result.output).not.toContain('<h1>');
      expect(result.output).not.toContain('<p>');
    });

    it('should strip script tags from HTML', async () => {
      const html = '<html><body><script>alert("xss")</script><p>Safe</p></body></html>';
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('Safe');
      expect(result.output).not.toContain('alert');
    });

    it('should strip style tags from HTML', async () => {
      const html = '<html><head><style>body { color: red; }</style></head><body><p>Content</p></body></html>';
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).toContain('Content');
      expect(result.output).not.toContain('color: red');
    });

    it('should include URL in output header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('content'),
      });

      const result = await tool.execute({ url: 'https://example.com/page' }, mockContext);

      expect(result.output).toContain('https://example.com/page');
    });
  });

  describe('error handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await tool.execute({ url: 'https://example.com/missing' }, mockContext);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('404');
      expect(result.output).toContain('Not Found');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('Network error');
    });

    it('should handle timeout', async () => {
      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Aborted')), 100);
        });
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.isError).toBe(true);
      // The error message could be 'timed out' or just 'Aborted'
      expect(result.isError).toBe(true);
    });
  });

  describe('content truncation', () => {
    it('should truncate large content', async () => {
      const largeContent = 'x'.repeat(100000);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve(largeContent),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.metadata?.truncated).toBe(true);
      expect(result.output).toContain('truncated');
    });

    it('should not truncate small content', async () => {
      const smallContent = 'x'.repeat(1000);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve(smallContent),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.metadata?.truncated).toBe(false);
    });
  });

  describe('prompt handling', () => {
    it('should include prompt in output', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('content'),
      });

      const result = await tool.execute(
        { url: 'https://example.com', prompt: 'What is this about?' },
        mockContext,
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('What is this about?');
    });

    it('should not include prompt section when no prompt', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('content'),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.isError).toBe(false);
      expect(result.output).not.toContain('User\'s question');
    });
  });

  describe('metadata', () => {
    it('should include URL in metadata', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('content'),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.metadata?.url).toBe('https://example.com');
    });

    it('should include content type in metadata', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve('{}'),
      });

      const result = await tool.execute({ url: 'https://api.example.com' }, mockContext);

      expect(result.metadata?.contentType).toBe('application/json');
    });

    it('should include content length in metadata', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/plain' },
        text: () => Promise.resolve('Hello'),
      });

      const result = await tool.execute({ url: 'https://example.com' }, mockContext);

      expect(result.metadata?.contentLength).toBe(5);
    });
  });
});
