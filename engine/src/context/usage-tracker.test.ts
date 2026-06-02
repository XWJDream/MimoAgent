import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsageTracker, createUsageHooks } from './usage-tracker.js';
import { writeFile, readFile, mkdir } from 'fs/promises';

// Mock fs modules
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(new Error('File not found')),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe('UsageTracker', () => {
  let tracker: UsageTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new UsageTracker({ persistencePath: '/tmp/test-usage.json' });
  });

  describe('recordUsage()', () => {
    it('should record token usage correctly', () => {
      const record = tracker.recordUsage('mimo-v2.5-pro', 100, 50);

      expect(record.model).toBe('mimo-v2.5-pro');
      expect(record.promptTokens).toBe(100);
      expect(record.completionTokens).toBe(50);
      expect(record.totalTokens).toBe(150);
      expect(record.cachedTokens).toBe(0);
    });

    it('should record cached tokens', () => {
      const record = tracker.recordUsage('mimo-v2.5-pro', 100, 50, 30);

      expect(record.cachedTokens).toBe(30);
    });

    it('should calculate cost correctly', () => {
      const record = tracker.recordUsage('mimo-v2.5-pro', 1000000, 1000000);

      // mimo-v2.5-pro: input $2/M, output $8/M
      // 1M input = $2, 1M output = $8, total = $10
      expect(record.estimatedCost).toBeCloseTo(10.0, 2);
    });

    it('should use default pricing for unknown models', () => {
      const record = tracker.recordUsage('unknown-model', 1000000, 1000000);

      // default: input $2/M, output $8/M
      expect(record.estimatedCost).toBeCloseTo(10.0, 2);
    });

    it('should accumulate session records', () => {
      tracker.recordUsage('mimo-v2.5-pro', 100, 50);
      tracker.recordUsage('mimo-v2.5-pro', 200, 100);

      const stats = tracker.getSessionStats();
      expect(stats.totalTokens).toBe(450); // 150 + 300
      expect(stats.promptTokens).toBe(300); // 100 + 200
      expect(stats.completionTokens).toBe(150); // 50 + 100
    });
  });

  describe('incrementToolCall()', () => {
    it('should track tool calls in next usage record', () => {
      tracker.incrementToolCall();
      tracker.incrementToolCall();

      // Tool calls are recorded in the next usage record
      tracker.recordUsage('mimo-v2.5-pro', 100, 50);

      const stats = tracker.getSessionStats();
      expect(stats.sessionToolCalls).toBe(2);
    });

    it('should reset tool calls after recording usage', () => {
      tracker.incrementToolCall();
      tracker.recordUsage('mimo-v2.5-pro', 100, 50);

      tracker.incrementToolCall();
      tracker.recordUsage('mimo-v2.5-pro', 200, 100);

      const stats = tracker.getSessionStats();
      expect(stats.sessionToolCalls).toBe(2); // 1 + 1
    });
  });

  describe('getSessionStats()', () => {
    it('should return zero stats for empty tracker', () => {
      const stats = tracker.getSessionStats();

      expect(stats.totalTokens).toBe(0);
      expect(stats.promptTokens).toBe(0);
      expect(stats.completionTokens).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.sessionCachedTokens).toBe(0);
      expect(stats.sessionToolCalls).toBe(0);
    });

    it('should calculate session stats correctly', () => {
      tracker.incrementToolCall();
      tracker.recordUsage('mimo-v2.5-pro', 100, 50, 30);
      tracker.recordUsage('gpt-4o', 200, 100, 0);

      const stats = tracker.getSessionStats();

      expect(stats.totalTokens).toBe(450); // 150 + 300
      expect(stats.promptTokens).toBe(300); // 100 + 200
      expect(stats.completionTokens).toBe(150); // 50 + 100
      expect(stats.sessionCachedTokens).toBe(30);
      expect(stats.sessionToolCalls).toBe(1);
    });
  });

  describe('getStats()', () => {
    it('should return comprehensive stats', () => {
      tracker.incrementToolCall();
      tracker.recordUsage('mimo-v2.5-pro', 100, 50, 30);

      const stats = tracker.getStats();

      expect(stats.totalRecords).toBe(1);
      expect(stats.sessionRecords).toBe(1);
      expect(stats.totalPromptTokens).toBe(100);
      expect(stats.totalCompletionTokens).toBe(50);
      expect(stats.totalTokens).toBe(150);
      expect(stats.totalCachedTokens).toBe(30);
      expect(stats.totalToolCalls).toBe(1);
    });

    it('should group by model', () => {
      tracker.recordUsage('mimo-v2.5-pro', 100, 50);
      tracker.recordUsage('gpt-4o', 200, 100);

      const stats = tracker.getStats();

      expect(stats.byModel['mimo-v2.5-pro']).toBeDefined();
      expect(stats.byModel['gpt-4o']).toBeDefined();
      expect(stats.byModel['mimo-v2.5-pro'].tokens).toBe(150);
      expect(stats.byModel['gpt-4o'].tokens).toBe(300);
    });
  });

  describe('load() and save()', () => {
    it('should save usage data', async () => {
      // Trigger save (happens when sessionRecords.length % 10 === 0)
      // After adding 10 records, sessionRecords.length will be 10, triggering save
      for (let i = 0; i < 10; i++) {
        tracker.recordUsage('mimo-v2.5-pro', 10, 5);
      }

      // Wait for async save to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have saved after 10 records
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
    });

    it('should load existing usage data', async () => {
      const mockData = JSON.stringify([
        {
          timestamp: Date.now(),
          model: 'mimo-v2.5-pro',
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          cachedTokens: 0,
          estimatedCost: 0.0006,
          turnCount: 1,
          toolCalls: 2,
        },
      ]);

      vi.mocked(readFile).mockResolvedValueOnce(mockData);

      const newTracker = new UsageTracker({ persistencePath: '/tmp/test-usage.json' });
      await newTracker.load();

      const stats = newTracker.getStats();
      expect(stats.totalRecords).toBe(1);
      expect(stats.totalTokens).toBe(150);
    });

    it('should handle load errors gracefully', async () => {
      vi.mocked(readFile).mockRejectedValueOnce(new Error('File not found'));

      const newTracker = new UsageTracker({ persistencePath: '/tmp/test-usage.json' });
      await newTracker.load();

      const stats = newTracker.getStats();
      expect(stats.totalRecords).toBe(0);
    });
  });

  describe('getSessionSummary()', () => {
    it('should return formatted summary', () => {
      tracker.recordUsage('mimo-v2.5-pro', 100, 50);

      const summary = tracker.getSessionSummary();

      expect(summary).toContain('1 calls');
      expect(summary).toContain('150 tokens');
      expect(summary).toContain('$');
    });
  });

  describe('formatStats()', () => {
    it('should return formatted stats string', () => {
      tracker.recordUsage('mimo-v2.5-pro', 100, 50, 30);
      tracker.incrementToolCall();

      const formatted = tracker.formatStats();

      expect(formatted).toContain('Usage Statistics');
      expect(formatted).toContain('Current Session');
      expect(formatted).toContain('All Time');
      expect(formatted).toContain('Prompt Tokens:');
      expect(formatted).toContain('Output Tokens:');
      expect(formatted).toContain('Total Tokens:');
      expect(formatted).toContain('Tool Calls:');
    });
  });
});

describe('createUsageHooks()', () => {
  it('should create hooks object', () => {
    const hooks = createUsageHooks();

    expect(hooks.beforeTool).toBeDefined();
    expect(hooks.afterTool).toBeDefined();
  });

  it('should track tool execution time', async () => {
    const hooks = createUsageHooks();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Simulate tool execution
    await hooks.beforeTool!('read_file', {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    await hooks.afterTool!('read_file', { output: 'success', isError: false });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Tool "read_file" completed in'),
    );

    consoleSpy.mockRestore();
  });

  it('should track error status', async () => {
    const hooks = createUsageHooks();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await hooks.beforeTool!('shell', {});
    await hooks.afterTool!('shell', { output: 'error', isError: true });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('(error)'),
    );

    consoleSpy.mockRestore();
  });
});
