import { describe, it, expect } from 'vitest';
import { parseAPIError, isContextOverflow } from './errors.js';

describe('parseAPIError', () => {
  describe('context_overflow', () => {
    it('detects OpenAI maximum context length', () => {
      const error = new Error('This model\'s maximum context length is 128000 tokens');
      const result = parseAPIError(error);
      expect(result.type).toBe('context_overflow');
      expect(result.retryable).toBe(true);
      expect(result.suggestedAction).toBe('compact');
    });

    it('detects context window exceeded', () => {
      const error = new Error('Context window exceeded: 150000 tokens');
      const result = parseAPIError(error);
      expect(result.type).toBe('context_overflow');
    });

    it('detects too many tokens', () => {
      const error = new Error('Too many tokens in the request');
      const result = parseAPIError(error);
      expect(result.type).toBe('context_overflow');
    });

    it('detects Anthropic prompt too long', () => {
      const error = new Error('prompt is too long: 200000 tokens');
      const result = parseAPIError(error);
      expect(result.type).toBe('context_overflow');
    });

    it('detects exceeds context limit', () => {
      const error = new Error('Request exceeds context limit of 200000');
      const result = parseAPIError(error);
      expect(result.type).toBe('context_overflow');
    });

    it('detects generic context overflow', () => {
      const error = new Error('Context overflow detected');
      const result = parseAPIError(error);
      expect(result.type).toBe('context_overflow');
    });

    it('detects input too long', () => {
      const error = new Error('Input too long for model');
      const result = parseAPIError(error);
      expect(result.type).toBe('context_overflow');
    });

    it('detects context full', () => {
      const error = new Error('Context full, cannot add more messages');
      const result = parseAPIError(error);
      expect(result.type).toBe('context_overflow');
    });
  });

  describe('auth_error', () => {
    it('detects 401 status', () => {
      const error = new Error('HTTP 401 Unauthorized');
      const result = parseAPIError(error);
      expect(result.type).toBe('auth_error');
      expect(result.retryable).toBe(false);
      expect(result.suggestedAction).toBe('settings');
    });

    it('detects invalid API key', () => {
      const error = new Error('Invalid API key provided');
      const result = parseAPIError(error);
      expect(result.type).toBe('auth_error');
    });

    it('detects authentication failed', () => {
      const error = new Error('Authentication failed: bad credentials');
      const result = parseAPIError(error);
      expect(result.type).toBe('auth_error');
    });
  });

  describe('rate_limit', () => {
    it('detects 429 status', () => {
      const error = new Error('HTTP 429 Too Many Requests');
      const result = parseAPIError(error);
      expect(result.type).toBe('rate_limit');
      expect(result.retryable).toBe(true);
    });

    it('detects rate limit message', () => {
      const error = new Error('Rate limit exceeded');
      const result = parseAPIError(error);
      expect(result.type).toBe('rate_limit');
    });

    it('detects quota exceeded', () => {
      const error = new Error('Quota exceeded for this month');
      const result = parseAPIError(error);
      expect(result.type).toBe('rate_limit');
    });
  });

  describe('network_error', () => {
    it('detects ECONNREFUSED', () => {
      const error = new Error('connect ECONNREFUSED 127.0.0.1:443');
      const result = parseAPIError(error);
      expect(result.type).toBe('network_error');
      expect(result.retryable).toBe(true);
    });

    it('detects ETIMEDOUT', () => {
      const error = new Error('connect ETIMEDOUT');
      const result = parseAPIError(error);
      expect(result.type).toBe('network_error');
    });

    it('detects fetch failed', () => {
      const error = new Error('fetch failed: network error');
      const result = parseAPIError(error);
      expect(result.type).toBe('network_error');
    });
  });

  describe('unknown', () => {
    it('returns unknown for unrecognized errors', () => {
      const error = new Error('Something went wrong');
      const result = parseAPIError(error);
      expect(result.type).toBe('unknown');
      expect(result.retryable).toBe(false);
    });

    it('preserves original error message', () => {
      const error = new Error('Some specific error');
      const result = parseAPIError(error);
      expect(result.originalError).toBe(error);
      expect(result.message).toBe('Some specific error');
    });
  });
});

describe('isContextOverflow', () => {
  it('returns true for context overflow errors', () => {
    expect(isContextOverflow(new Error('maximum context length exceeded'))).toBe(true);
    expect(isContextOverflow(new Error('Context window exceeded'))).toBe(true);
    expect(isContextOverflow(new Error('prompt is too long'))).toBe(true);
  });

  it('returns false for non-overflow errors', () => {
    expect(isContextOverflow(new Error('401 Unauthorized'))).toBe(false);
    expect(isContextOverflow(new Error('Rate limit exceeded'))).toBe(false);
    expect(isContextOverflow(new Error('ECONNREFUSED'))).toBe(false);
    expect(isContextOverflow(new Error('Unknown error'))).toBe(false);
  });
});
