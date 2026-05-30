"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileCache = void 0;
const promises_1 = require("fs/promises");
class FileCache {
    cache = new Map();
    maxEntries;
    constructor(maxEntries = 100) {
        this.maxEntries = maxEntries;
    }
    async get(filePath) {
        const entry = this.cache.get(filePath);
        if (!entry)
            return null;
        try {
            const stats = await (0, promises_1.stat)(filePath);
            if (stats.mtimeMs > entry.mtime) {
                this.cache.delete(filePath);
                return null;
            }
            return entry.content;
        }
        catch {
            this.cache.delete(filePath);
            return null;
        }
    }
    async getOrLoad(filePath) {
        const cached = await this.get(filePath);
        if (cached !== null)
            return cached;
        const content = await (0, promises_1.readFile)(filePath, 'utf-8');
        this.set(filePath, content);
        return content;
    }
    set(filePath, content) {
        if (this.cache.size >= this.maxEntries) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey)
                this.cache.delete(firstKey);
        }
        this.cache.set(filePath, { content, mtime: Date.now() });
    }
    invalidate(filePath) {
        this.cache.delete(filePath);
    }
    clear() {
        this.cache.clear();
    }
}
exports.FileCache = FileCache;
//# sourceMappingURL=file-cache.js.map