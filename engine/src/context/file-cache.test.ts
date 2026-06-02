import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileCache } from './file-cache.js';
import { stat, readFile } from 'fs/promises';

// Mock fs modules
vi.mock('fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

describe('FileCache', () => {
  let cache: FileCache;
  let mockTime: number;

  beforeEach(() => {
    vi.resetAllMocks();
    mockTime = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => mockTime);
    cache = new FileCache(3); // Small cache for testing
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('get()', () => {
    it('should return null for cache miss', async () => {
      const result = await cache.get('/nonexistent.txt');
      expect(result).toBeNull();
    });

    it('should return cached content on hit', async () => {
      // Mock stat to return same mtime as when cached
      vi.mocked(stat).mockResolvedValue({ mtimeMs: mockTime } as any);

      // Set content in cache
      cache.set('/test.txt', 'hello');

      const result = await cache.get('/test.txt');
      expect(result).toBe('hello');
    });

    it('should invalidate cache if file modified', async () => {
      // Set content in cache at time 1000
      cache.set('/test.txt', 'old content');

      // Mock stat to return newer mtime (file was modified after cache)
      vi.mocked(stat).mockResolvedValue({ mtimeMs: 2000 } as any);

      const result = await cache.get('/test.txt');
      expect(result).toBeNull();
    });

    it('should invalidate cache if file not found', async () => {
      // Set content in cache
      cache.set('/test.txt', 'content');

      // Mock stat to throw error
      vi.mocked(stat).mockRejectedValue(new Error('File not found'));

      const result = await cache.get('/test.txt');
      expect(result).toBeNull();
    });
  });

  describe('getOrLoad()', () => {
    it('should load file on cache miss', async () => {
      vi.mocked(readFile).mockResolvedValue('file content');
      vi.mocked(stat).mockResolvedValue({ mtimeMs: mockTime } as any);

      const result = await cache.getOrLoad('/test.txt');
      expect(result).toBe('file content');
      expect(readFile).toHaveBeenCalledWith('/test.txt', 'utf-8');
    });

    it('should return cached content on hit', async () => {
      vi.mocked(stat).mockResolvedValue({ mtimeMs: mockTime } as any);

      // First call loads from file
      vi.mocked(readFile).mockResolvedValue('file content');
      await cache.getOrLoad('/test.txt');

      // Second call should use cache
      const result = await cache.getOrLoad('/test.txt');
      expect(result).toBe('file content');
      expect(readFile).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should reload if file modified', async () => {
      // First call - load file at time 1000
      vi.mocked(readFile).mockResolvedValue('old content');
      // First stat call in get() returns null (cache miss)
      // Then file is loaded and cached
      vi.mocked(stat).mockResolvedValueOnce(null as any);
      await cache.getOrLoad('/test.txt');

      // File modified - advance time and return newer mtime
      mockTime = 2000;
      vi.mocked(readFile).mockResolvedValue('new content');
      // Stat returns newer mtime than cached (1000 < 2000)
      vi.mocked(stat).mockResolvedValueOnce({ mtimeMs: 2000 } as any);

      const result = await cache.getOrLoad('/test.txt');
      expect(result).toBe('new content');
      expect(readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('set()', () => {
    it('should store content in cache', async () => {
      // Set content with mtime = 1000 (mockTime)
      cache.set('/test.txt', 'hello');

      // Stat returns same mtime as when cached (1000)
      vi.mocked(stat).mockResolvedValue({ mtimeMs: 1000 } as any);

      // Call get directly to see what happens
      const entry = (cache as any).cache.get('/test.txt');
      expect(entry).toBeDefined();
      expect(entry.content).toBe('hello');

      // Now call stat
      const stats = await stat('/test.txt');
      expect(stats.mtimeMs).toBe(1000);

      const result = await cache.get('/test.txt');
      expect(result).toBe('hello');
    });

    it('should evict oldest entry when cache is full', async () => {
      vi.mocked(stat).mockResolvedValue({ mtimeMs: mockTime } as any);

      // Fill cache to max (3 entries)
      cache.set('/a.txt', 'a');
      cache.set('/b.txt', 'b');
      cache.set('/c.txt', 'c');

      // Add one more - should evict /a.txt
      cache.set('/d.txt', 'd');

      expect(await cache.get('/a.txt')).toBeNull();
      expect(await cache.get('/b.txt')).toBe('b');
      expect(await cache.get('/c.txt')).toBe('c');
      expect(await cache.get('/d.txt')).toBe('d');
    });

    it('should update existing entry', async () => {
      vi.mocked(stat).mockResolvedValue({ mtimeMs: mockTime } as any);

      cache.set('/test.txt', 'old');
      cache.set('/test.txt', 'new');

      const result = await cache.get('/test.txt');
      expect(result).toBe('new');
    });
  });

  describe('invalidate()', () => {
    it('should remove entry from cache', async () => {
      vi.mocked(stat).mockResolvedValue({ mtimeMs: mockTime } as any);

      cache.set('/test.txt', 'content');
      cache.invalidate('/test.txt');

      const result = await cache.get('/test.txt');
      expect(result).toBeNull();
    });

    it('should handle invalidating non-existent entry', () => {
      // Should not throw
      expect(() => cache.invalidate('/nonexistent.txt')).not.toThrow();
    });
  });

  describe('clear()', () => {
    it('should remove all entries', async () => {
      vi.mocked(stat).mockResolvedValue({ mtimeMs: mockTime } as any);

      cache.set('/a.txt', 'a');
      cache.set('/b.txt', 'b');

      cache.clear();

      expect(await cache.get('/a.txt')).toBeNull();
      expect(await cache.get('/b.txt')).toBeNull();
    });
  });

  describe('maxEntries', () => {
    it('should use default maxEntries of 100', () => {
      const defaultCache = new FileCache();
      // Access private property for testing
      expect((defaultCache as any).maxEntries).toBe(100);
    });

    it('should use custom maxEntries', () => {
      const customCache = new FileCache(50);
      expect((customCache as any).maxEntries).toBe(50);
    });
  });
});
