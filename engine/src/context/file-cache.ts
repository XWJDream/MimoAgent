import { stat, readFile } from 'fs/promises';

interface CacheEntry {
  content: string;
  mtime: number;
}

export class FileCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
  }

  async get(filePath: string): Promise<string | null> {
    const entry = this.cache.get(filePath);
    if (!entry) return null;

    try {
      const stats = await stat(filePath);
      if (stats.mtimeMs > entry.mtime) {
        this.cache.delete(filePath);
        return null;
      }
      return entry.content;
    } catch {
      this.cache.delete(filePath);
      return null;
    }
  }

  async getOrLoad(filePath: string): Promise<string> {
    const cached = await this.get(filePath);
    if (cached !== null) return cached;

    const content = await readFile(filePath, 'utf-8');
    this.set(filePath, content);
    return content;
  }

  set(filePath: string, content: string): void {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(filePath, { content, mtime: Date.now() });
  }

  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  clear(): void {
    this.cache.clear();
  }
}
