import { describe, it, expect } from 'vitest';
import { PromptCacheManager } from './cache.js';
import type { ChatMessage } from './types.js';

describe('PromptCacheManager', () => {
  describe('insertCacheBreakpoints()', () => {
    it('should return empty array for empty input', () => {
      expect(PromptCacheManager.insertCacheBreakpoints([])).toEqual([]);
    });

    it('should add cache control to system message', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      const result = PromptCacheManager.insertCacheBreakpoints(messages);

      // System message should have cache control
      expect(result[0].cacheControl).toEqual({ type: 'ephemeral' });
      // First user message should not have cache control
      expect(result[1].cacheControl).toBeUndefined();
    });

    it('should add cache control to last user message', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];

      const result = PromptCacheManager.insertCacheBreakpoints(messages);

      // Find last user message manually
      let lastUserIdx = -1;
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].role === 'user') {
          lastUserIdx = i;
          break;
        }
      }
      expect(result[lastUserIdx].cacheControl).toEqual({ type: 'ephemeral' });
    });

    it('should add cache control to midpoint for long conversations', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'Q2' },
        { role: 'assistant', content: 'A2' },
        { role: 'user', content: 'Q3' },
        { role: 'assistant', content: 'A3' },
        { role: 'user', content: 'Q4' },
        { role: 'assistant', content: 'A4' },
        { role: 'user', content: 'Q5' },
      ];

      const result = PromptCacheManager.insertCacheBreakpoints(messages);

      // Should have cache control on system, midpoint, and last user
      const cachedMessages = result.filter(m => m.cacheControl);
      expect(cachedMessages.length).toBeGreaterThanOrEqual(2);
      expect(cachedMessages.length).toBeLessThanOrEqual(3);
    });

    it('should not exceed 3 cache breakpoints', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'Q2' },
        { role: 'assistant', content: 'A2' },
        { role: 'user', content: 'Q3' },
        { role: 'assistant', content: 'A3' },
        { role: 'user', content: 'Q4' },
      ];

      const result = PromptCacheManager.insertCacheBreakpoints(messages);
      const cachedCount = result.filter(m => m.cacheControl).length;
      expect(cachedCount).toBeLessThanOrEqual(3);
    });

    it('should not mutate original messages', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Hello' },
      ];

      PromptCacheManager.insertCacheBreakpoints(messages);

      expect(messages[0].cacheControl).toBeUndefined();
      expect(messages[1].cacheControl).toBeUndefined();
    });

    it('should handle conversation with no system message', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'How are you?' },
      ];

      const result = PromptCacheManager.insertCacheBreakpoints(messages);
      // Find last user message manually
      let lastUserIdx = -1;
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].role === 'user') {
          lastUserIdx = i;
          break;
        }
      }
      expect(result[lastUserIdx].cacheControl).toEqual({ type: 'ephemeral' });
    });

    it('should handle single message', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ];

      const result = PromptCacheManager.insertCacheBreakpoints(messages);
      // Last user message should be cached
      expect(result[0].cacheControl).toEqual({ type: 'ephemeral' });
    });
  });

  describe('supportsCaching()', () => {
    it('should return true for Claude models', () => {
      expect(PromptCacheManager.supportsCaching('claude-sonnet-4-20250514')).toBe(true);
      expect(PromptCacheManager.supportsCaching('claude-3-5-haiku-20241022')).toBe(true);
      expect(PromptCacheManager.supportsCaching('claude-3-opus-20240229')).toBe(true);
    });

    it('should return false for DeepSeek models (auto-cache)', () => {
      expect(PromptCacheManager.supportsCaching('deepseek-chat')).toBe(false);
      expect(PromptCacheManager.supportsCaching('deepseek-coder')).toBe(false);
    });

    it('should return false for MiMo models', () => {
      expect(PromptCacheManager.supportsCaching('mimo-v2.5-pro')).toBe(false);
      expect(PromptCacheManager.supportsCaching('mimo-v2.5')).toBe(false);
    });

    it('should return false for OpenAI models', () => {
      expect(PromptCacheManager.supportsCaching('gpt-4o')).toBe(false);
      expect(PromptCacheManager.supportsCaching('gpt-4o-mini')).toBe(false);
    });
  });

  describe('calculateCacheHitRate()', () => {
    it('should return 0 when no cached tokens', () => {
      expect(PromptCacheManager.calculateCacheHitRate({ promptTokens: 100 })).toBe(0);
    });

    it('should return 0 when promptTokens is 0', () => {
      expect(PromptCacheManager.calculateCacheHitRate({ cachedTokens: 50, promptTokens: 0 })).toBe(0);
    });

    it('should calculate correct hit rate', () => {
      expect(PromptCacheManager.calculateCacheHitRate({ cachedTokens: 50, promptTokens: 100 })).toBe(0.5);
      expect(PromptCacheManager.calculateCacheHitRate({ cachedTokens: 100, promptTokens: 100 })).toBe(1);
      expect(PromptCacheManager.calculateCacheHitRate({ cachedTokens: 0, promptTokens: 100 })).toBe(0);
    });
  });

  describe('formatCacheHitRate()', () => {
    it('should format as percentage string', () => {
      expect(PromptCacheManager.formatCacheHitRate({ cachedTokens: 50, promptTokens: 100 })).toBe('50.0%');
      expect(PromptCacheManager.formatCacheHitRate({ cachedTokens: 33, promptTokens: 100 })).toBe('33.0%');
      expect(PromptCacheManager.formatCacheHitRate({ promptTokens: 100 })).toBe('0.0%');
    });
  });

  describe('estimateSavedTokens()', () => {
    it('should return cached tokens count', () => {
      expect(PromptCacheManager.estimateSavedTokens({ cachedTokens: 500, promptTokens: 1000 })).toBe(500);
    });

    it('should return 0 when no cached tokens', () => {
      expect(PromptCacheManager.estimateSavedTokens({ promptTokens: 1000 })).toBe(0);
    });
  });
});
