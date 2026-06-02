import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMClient } from './client.js';

// Mock OpenAI
const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      constructor() {}
    },
  };
});

describe('LLMClient', () => {
  let client: LLMClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();

    client = new LLMClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com/v1',
      model: 'mimo-v2.5-pro',
      maxTokens: 4096,
      temperature: 0.2,
      timeout: 30000,
    });
  });

  describe('chat()', () => {
    it('should make API call with correct parameters', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello, world!',
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await client.chat([
        { role: 'user', content: 'Say hello' },
      ]);

      expect(result.content).toBe('Hello, world!');
      expect(result.toolCalls).toBeNull();
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'read_file',
                    arguments: '{"file_path":"/test.txt"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await client.chat([
        { role: 'user', content: 'Read a file' },
      ]);

      expect(result.content).toBeNull();
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].id).toBe('call_123');
      expect(result.toolCalls![0].name).toBe('read_file');
      expect(result.toolCalls![0].arguments).toEqual({ file_path: '/test.txt' });
    });

    it('should include tools in request when provided', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Done',
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'read_file',
            description: 'Read a file',
            parameters: {
              type: 'object',
              properties: {
                file_path: { type: 'string' },
              },
            },
          },
        },
      ];

      await client.chat([{ role: 'user', content: 'Read a file' }], tools);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: tools,
          tool_choice: 'auto',
        }),
        expect.anything(),
      );
    });

    it('should handle cached tokens in usage', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello',
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_tokens_details: {
            cached_tokens: 30,
          },
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await client.chat([{ role: 'user', content: 'Test' }]);

      expect(result.usage.cachedTokens).toBe(30);
    });
  });

  describe('chatStream()', () => {
    it('should stream content deltas', async () => {
      const mockStream = [
        {
          choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
        },
        {
          choices: [{ delta: { content: ' world' }, finish_reason: null }],
        },
        {
          choices: [{ delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            const item = mockStream.shift();
            return item ? { value: item, done: false } : { done: true };
          },
        }),
      });

      const events = [];
      for await (const event of client.chatStream([{ role: 'user', content: 'Test' }])) {
        events.push(event);
      }

      const contentEvents = events.filter((e) => e.type === 'content_delta');
      expect(contentEvents).toHaveLength(2);
      expect(contentEvents[0].delta).toBe('Hello');
      expect(contentEvents[1].delta).toBe(' world');

      const finishEvent = events.find((e) => e.type === 'finish');
      expect(finishEvent).toBeDefined();
      expect(finishEvent?.reason).toBe('stop');
    });

    it('should stream tool calls', async () => {
      const mockStream = [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_123',
                    function: { name: 'read_file' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: '{"file' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: '_path":"/test.txt"}' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [{ delta: {}, finish_reason: 'tool_calls' }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        },
      ];

      mockCreate.mockResolvedValueOnce({
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            const item = mockStream.shift();
            return item ? { value: item, done: false } : { done: true };
          },
        }),
      });

      const events = [];
      for await (const event of client.chatStream([{ role: 'user', content: 'Test' }])) {
        events.push(event);
      }

      const toolStartEvents = events.filter((e) => e.type === 'tool_call_start');
      expect(toolStartEvents).toHaveLength(1);
      expect(toolStartEvents[0].name).toBe('read_file');

      const toolDeltaEvents = events.filter((e) => e.type === 'tool_call_delta');
      expect(toolDeltaEvents).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      // Mock all retry attempts to fail
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(
        client.chat([{ role: 'user', content: 'Test' }]),
      ).rejects.toThrow('API rate limit exceeded');
    }, 10000); // Increase timeout for retries

    it('should handle invalid JSON in tool arguments', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'test_tool',
                    arguments: 'invalid json',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await client.chat([{ role: 'user', content: 'Test' }]);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls![0].arguments).toEqual({});
    });
  });
});
